const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");
const { safeEdit } = require("../utils/safeEdit");
const { checkMember } = require("../utils/permsManager");

// ─── KEEPALIVE ────────────────────────────────────────────────────────────────
//
// Stores { channelId, guildId, adapterCreator } per guild so we always know
// where to reconnect to, independent of any connection object.
//
const keepaliveTargets = new Map(); // guildId → { channelId, guild }
const connectionWatchers = new Map(); // guildId → { connection, cleanup }

// Nickname applied while keepalive is active. Kept in one place so startup
// recovery (index.js) can spot and clear leftovers after a kill/restart.
const KEEPALIVE_NICKNAME = "Nyako - The VC guard";

// Clear the keepalive nickname on a guild if it still bears it.
// Safe to call any time — no-ops if the nickname was already changed.
async function resetKeepaliveNickname(guild) {
  try {
    const me = guild.members.me;
    if (!me) return;
    if (me.nickname !== KEEPALIVE_NICKNAME) return;
    await me.setNickname(null);
    console.log(`[keepalive] Reset stale nickname in "${guild.name}".`);
  } catch (err) {
    console.error(`[keepalive] Failed to reset nickname in "${guild.name}":`, err.message);
  }
}

// How long to wait before retrying after a failed reconnect (ms).
const RECONNECT_DELAY = 5_000;
// Max consecutive reconnect attempts before giving up for this guild.
const MAX_RECONNECT_ATTEMPTS = 10;

const reconnectAttempts = new Map(); // guildId → consecutive failure count

// Attempt to join a channel and immediately start watching the connection.
// Returns the new VoiceConnection.
async function connectAndWatch(guild, channelId) {
  // Tear down any existing connection cleanly first.
  const existing = getVoiceConnection(guild.id);
  if (existing) {
    try { existing.destroy(); } catch {}
  }

  const connection = joinVoiceChannel({
    channelId,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  // Wait until we're actually ready before attaching the watcher,
  // so we don't bind to a connection that's about to be torn down.
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch {
    // If we can't reach Ready in 15s, destroy and let the caller deal with it.
    try { connection.destroy(); } catch {}
    throw new Error("Could not reach Ready state.");
  }

  // Success — reset the attempt counter.
  reconnectAttempts.delete(guild.id);

  watchConnection(guild, channelId, connection);
  return connection;
}

// Attach a single long-lived stateChange listener to a connection.
// Handles both manual kicks (Disconnected → Destroyed) and network drops
// (Disconnected → recovers on its own or needs a fresh join).
function watchConnection(guild, channelId, connection) {
  // Remove any previous listener on this connection object to avoid doubles.
  connection.removeAllListeners("stateChange");

  const handleStateChange = async (oldState, newState) => {
    // If keepalive was disabled, stop doing anything.
    if (!keepaliveTargets.has(guild.id)) return;

    if (newState.status === VoiceConnectionStatus.Disconnected) {
      // Discord kicks produce Disconnected with a websocket close code.
      // Try to let the library recover on its own (network hiccup) first.
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Library is recovering — let it finish; the Ready handler isn't needed
        // because another stateChange will fire when it gets there.
        return;
      } catch {
        // Didn't recover in 5s — assume we were kicked. Destroy and reconnect.
        try { connection.destroy(); } catch {}
        // Fall through to the Destroyed handler below via the next stateChange,
        // OR reconnect here directly since destroy() fires synchronously.
        scheduleReconnect(guild, channelId);
      }
    }

    if (newState.status === VoiceConnectionStatus.Destroyed) {
      // Could arrive here from a destroy() we triggered above OR from an
      // external destroy (e.g. bot kicked). Either way, reconnect.
      scheduleReconnect(guild, channelId);
    }
  };

  connection.on("stateChange", handleStateChange);

  // Store the watcher for cleanup
  connectionWatchers.set(guild.id, { connection, cleanup: () => connection.removeListener("stateChange", handleStateChange) });
}

// Debounced reconnect: prevents double-reconnect when both Disconnected and
// Destroyed fire in quick succession (which happens on a kick).
const reconnectTimers = new Map(); // guildId → timeout

function scheduleReconnect(guild, channelId) {
  if (!keepaliveTargets.has(guild.id)) return;

  // If a reconnect is already pending, don't stack another one.
  if (reconnectTimers.has(guild.id)) return;

  const attempts = (reconnectAttempts.get(guild.id) || 0) + 1;
  reconnectAttempts.set(guild.id, attempts);

  if (attempts > MAX_RECONNECT_ATTEMPTS) {
    console.error(
      `[keepalive] Giving up reconnect for guild ${guild.id} channel ${channelId} after ${MAX_RECONNECT_ATTEMPTS} failed attempts.`
    );
    cleanupKeepalive(guild.id);
    return;
  }

  const timer = setTimeout(async () => {
    reconnectTimers.delete(guild.id);

    // Still wanted?
    if (!keepaliveTargets.has(guild.id)) return;

    try {
      await connectAndWatch(guild, channelId);
    } catch (err) {
      console.error(
        `[keepalive] Reconnect failed for guild ${guild.id} channel ${channelId} (attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS}):`,
        err.message
      );
      // Retry again after another delay.
      scheduleReconnect(guild, channelId);
    }
  }, RECONNECT_DELAY);

  reconnectTimers.set(guild.id, timer);
}

function cleanupKeepalive(guildId) {
  // Clear reconnect timer
  const timer = reconnectTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(guildId);
  }

  // Clear reconnect attempts counter
  reconnectAttempts.delete(guildId);

  // Clean up connection watcher
  const watcher = connectionWatchers.get(guildId);
  if (watcher) {
    try { watcher.cleanup(); } catch {}
    try { watcher.connection.destroy(); } catch {}
    connectionWatchers.delete(guildId);
  }

  // Remove keepalive target
  keepaliveTargets.delete(guildId);
}

// ─── SLEEP / TIMERS ───────────────────────────────────────────────────────────

let sleepTimers = [];
let sleepMessages = [];

function parseTime(input) {
  if (!input) return 10000;
  if (/^\d+$/.test(input)) return parseInt(input, 10) * 1000;

  let ms = 0;
  for (const match of input.matchAll(/(\d+)([smh])/gi)) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === "s") ms += value * 1000;
    if (unit === "m") ms += value * 60000;
    if (unit === "h") ms += value * 3600000;
  }
  return ms || 10000;
}

function clockTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── CONTEXT HELPER ───────────────────────────────────────────────────────────

function contextFrom(source) {
  const isInteraction = Boolean(source.user);

  if (isInteraction) {
    return {
      channel: source.channel,
      guild: source.guild,
      member: source.member,
      authorId: source.user.id,
      reply: (payload) => {
        const data = typeof payload === "string" ? { content: payload, flags: MessageFlags.Ephemeral } : payload;
        return source.replied || source.deferred ? source.followUp(data) : source.reply(data);
      },
    };
  }

  return {
    channel: source.channel,
    guild: source.guild,
    member: source.member,
    authorId: source.author.id,
    reply: (payload) => source.reply(payload),
  };
}

// ─── ACTIONS ──────────────────────────────────────────────────────────────────

const ACTIONS = {
  disconnect: {
    title: "Disconnect",
    verb: "disconnect",
    emoji: "👟",
    action: (m) => m.voice.setChannel(null),
    singleDone: (m) => `${m} has been disconnected.`,
    massDone: (u) => `Disconnected:\n${u}`,
  },
  deafen: {
    title: "Voice Deafen",
    verb: "deafen",
    emoji: "🔇",
    action: (m) => m.voice.setDeaf(true),
    singleDone: (m) => `${m} has been server deafened.`,
    massDone: (u) => `Server deafened:\n${u}`,
  },
  undeafen: {
    title: "Voice Undeafen",
    verb: "undeafen",
    emoji: "🔊",
    action: (m) => m.voice.setDeaf(false),
    singleDone: (m) => `${m} has been server undeafened.`,
    massDone: (u) => `Server undeafened:\n${u}`,
  },
  mute: {
    title: "Voice Mute",
    verb: "server mute",
    emoji: "🔕",
    action: (m) => m.voice.setMute(true),
    singleDone: (m) => `${m} has been server muted.`,
    massDone: (u) => `Server muted:\n${u}`,
  },
  unmute: {
    title: "Voice Unmute",
    verb: "server unmute",
    emoji: "🔔",
    action: (m) => m.voice.setMute(false),
    singleDone: (m) => `${m} has been server unmuted.`,
    massDone: (u) => `Server unmuted:\n${u}`,
  },
};

// ─── SINGLE / MASS SCHEDULERS ─────────────────────────────────────────────────

async function scheduleSingleAction(ctx, { member, delayMs, title, verb, emoji, action, cancelId, completedText }) {
  const end = Math.floor((Date.now() + delayMs) / 1000);

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`${emoji} ${title}`)
    .setDescription(`Understood, I'll **${verb}**\n${member}\n<t:${end}:R>`)
    .setFooter({ text: `At ${clockTime(new Date(Date.now() + delayMs))}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Secondary)
  );

  const msg = await ctx.channel.send({ embeds: [embed], components: [row] });
  let cancelled = false;

  const timeout = setTimeout(async () => {
    if (cancelled) return;
    try {
      if (member.voice.channel) await action(member);
    } catch (err) {
      console.error("vc single-action error:", err);
    }
    if (!msg.editable) return;
    try {
      await safeEdit(msg, {
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle(`${emoji} ${title} Complete`)
            .setDescription(completedText(member) + `\n<t:${Math.floor(Date.now() / 1000)}:R>`)
            .setFooter({ text: `At ${clockTime()}` }),
        ],
        components: [],
      });
    } catch (err) {
      console.error("vc single-action edit error:", err);
    }
  }, delayMs);

  const collector = msg.createMessageComponentCollector({ time: delayMs });

  collector.on("collect", async (i) => {
    if (i.user.id !== ctx.authorId) {
      return i.reply({ content: "Only the command author can cancel this.", flags: MessageFlags.Ephemeral });
    }
    cancelled = true;
    clearTimeout(timeout);
    try {
      await i.update({
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setTitle(`✔️ ${title} Cancelled`)
            .setDescription(`🕊️ ${member} has been spared.`),
        ],
        components: [],
      });
    } catch (err) {
      console.error("vc single-action cancel edit error:", err);
    }
    collector.stop();
  });
}

async function scheduleMassAction(ctx, { members, delayMs, title, verb, emoji, completeText, action, cancelId, isSleep = false }) {
  const end = Math.floor((Date.now() + delayMs) / 1000);
  const targetList = members.slice(0, 10).map((m) => `${m}`).join(", ");
  const extra = members.length > 10 ? `\n+${members.length - 10} more` : "";

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`${emoji} ${title}`)
    .setDescription(`Understood, I'll **${verb}**\n${targetList}${extra}\n<t:${end}:R>`)
    .setFooter({ text: `At ${clockTime(new Date(Date.now() + delayMs))}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Secondary)
  );

  const msg = await ctx.channel.send({ embeds: [embed], components: [row] });
  if (isSleep) sleepMessages.push(msg);

  let cancelled = false;

  const timeout = setTimeout(async () => {
    if (cancelled) return;
    const affected = [];
    for (const member of members) {
      try {
        if (!member.voice.channel) continue;
        await action(member);
        affected.push(member);
      } catch (err) {
        console.error("vc mass-action error:", err);
      }
    }
    if (!msg.editable) return;
    try {
      await safeEdit(msg, {
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle(`${emoji} ${title} Complete`)
            .setDescription(completeText(affected.length ? affected.join(", ") : "Nobody"))
            .setFooter({ text: `At ${clockTime()}` }),
        ],
        components: [],
      });
    } catch (err) {
      console.error("vc mass-action edit error:", err);
    }
  }, delayMs);

  if (isSleep) sleepTimers.push(timeout);

  const collector = msg.createMessageComponentCollector({ time: delayMs });

  collector.on("collect", async (i) => {
    if (i.user.id !== ctx.authorId) {
      return i.reply({ content: "Only the command author can cancel this.", flags: MessageFlags.Ephemeral });
    }
    cancelled = true;
    clearTimeout(timeout);
    try {
      await i.update({
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setTitle(`✔️ ${title} Cancelled`)
            .setDescription("🕊️ Everyone has been spared."),
        ],
        components: [],
      });
    } catch (err) {
      console.error("vc mass-action cancel edit error:", err);
    }
    collector.stop();
  });

  collector.on("end", () => {
    // Cleanup if needed
    if (isSleep) {
      const idx = sleepTimers.indexOf(timeout);
      if (idx > -1) sleepTimers.splice(idx, 1);
      const msgIdx = sleepMessages.indexOf(msg);
      if (msgIdx > -1) sleepMessages.splice(msgIdx, 1);
    }
  });
}

// ─── SLEEP ────────────────────────────────────────────────────────────────────

// ─── SLEEP (rewritten: single clean embed, per-stage cancel buttons) ─────────
//
// Replaces the old scheduleSleep() function. Drop this in place of the
// existing one — everything else in the file (sleepTimers, sleepMessages,
// handleSleepCancel, ACTIONS, etc.) stays exactly as-is and keeps working
// alongside it.

// ─── SLEEP (v2: prettier + subtly animated) ───────────────────────────────
//
// Replaces the scheduleSleep() from before. Same drop-in rule applies:
// everything else in the file (sleepTimers, sleepMessages, handleSleepCancel,
// ACTIONS, etc.) is untouched.
//
// What's new vs the last version:
//   • A moon phase in the title quietly cycles (🌑→🌘) every tick, so the
//     embed visibly "breathes" instead of sitting static.
//   • A unicode progress bar tracks time to the next stage.
//   • The embed color drifts (blurple → purple → near-black) as the night
//     gets later, then settles green/grey on completion or cancellation.
//   • Still edits in place — no message spam — just ticks every 20s instead
//     of only updating on stage-complete/cancel.

// ─── SLEEP (v3: goodnight greeting, not a command panel) ──────────────────
//
// Same drop-in as before — swap out scheduleSleep(). Functionally identical
// to v2 (progress bar, moon-phase tick, per-stage cancel buttons, same
// timers/sleepMessages arrays), just written like the bot is actually
// saying goodnight instead of reporting a job status.

// ─── SLEEP (v4: goodnight greeting + ±30m shift buttons) ──────────────────
//
// Same drop-in as before — swap out scheduleSleep(). Adds two buttons that
// push every still-pending stage 30 minutes later or earlier, all at once,
// so "deafen → disconnect → shutdown" stays one coherent bedtime instead of
// drifting apart.

// ─── SLEEP (v4: goodnight greeting + ±30m shift buttons) ──────────────────
//
// Same drop-in as before — swap out scheduleSleep(). Adds two buttons that
// push every still-pending stage 30 minutes later or earlier, all at once,
// so "deafen → disconnect → shutdown" stays one coherent bedtime instead of
// drifting apart.

const MOON_PHASES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
const ANIMATION_INTERVAL = 20_000;
const SHIFT_MS = 30 * 60 * 1000;
const MIN_REMAINING_MS = 60 * 1000; 

function makeBar(fraction, length = 14) {
  const filled = Math.max(0, Math.min(length, Math.round(fraction * length)));
  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

async function scheduleSleep(ctx, vc) {
  const members = [...vc.members.values()].filter((m) => !m.user.bot);
  if (!members.length) return;

  const start = Date.now();

  const stages = {
    deafen: {
      emoji: "➡",
      pendingText: "gonna quiet things down for you",
      doneText: "quieted things down",
      cancelledText: "keeping the noise on, your call",
      cancelLabel: "Keep sound on",
      cancelEmoji: "🔊",
      delay: 30 * 60 * 1000,
      status: "pending",
      cancelId: "cancel_sleep_deafen",
      color: 0x5865f2,
      action: async () => {
        for (const m of members) {
          try {
            if (m.voice.channel) await m.voice.setDeaf(true);
          } catch (err) {
            console.error("vc sleep deafen error:", err);
          }
        }
      },
    },
    disconnect: {
      emoji: "➡",
      pendingText: "then i'll see you out",
      doneText: "saw you out",
      cancelledText: "you can stick around",
      cancelLabel: "Stay in VC",
      cancelEmoji: "🎧",
      delay: 60 * 60 * 1000,
      status: "pending",
      cancelId: "cancel_sleep_disconnect",
      color: 0x9b59b6,
      action: async () => {
        for (const m of members) {
          try {
            if (m.voice.channel) await m.voice.setChannel(null);
          } catch (err) {
            console.error("vc sleep disconnect error:", err);
          }
        }
      },
    },
    shutdown: {
      emoji: "➡",
      pendingText: "and after that, i'll go to sleep",
      doneText: "slept for the night",
      cancelledText: "guess i'll stay up then",
      cancelLabel: "Don't shut down",
      cancelEmoji: "🌙",
      delay: 90 * 60 * 1000,
      status: "pending",
      cancelId: "cancel_sleep_shutdown",
      color: 0x2f3136,
      action: async () => {
        try {
          await ctx.channel.send("🌙 alright, heading to bed. night!");
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log("Bot shut down after sleep sequence.");
          ctx.channel.client.destroy();
        } catch (err) {
          console.error("vc sleep shutdown error:", err);
        } finally {
          process.exit(0);
        }
      },
    },
  };

  let frame = 0;
  const timers = {};
  let isCleanedUp = false;

  const activeStage = () =>
    Object.values(stages)
      .filter((s) => s.status === "pending")
      .sort((a, b) => a.delay - b.delay)[0] || null;

  const buildEmbed = () => {
    const active = activeStage();
    const moon = MOON_PHASES[frame % MOON_PHASES.length];

    const lines = Object.values(stages).map((s) => {
      if (s.status === "cancelled") return `${s.emoji} ~~${s.pendingText}~~ — ${s.cancelledText}`;
      if (s.status === "done") return `${s.emoji} ${s.doneText} ✓`;
      const ts = Math.floor((start + s.delay) / 1000);
      return `${s.emoji} ${s.pendingText} — <t:${ts}:R>`;
    });

    const allResolved = Object.values(stages).every((s) => s.status !== "pending");
    let description = `${moon} good night <3\n\n${lines.join("\n")}`;
    let color = 0x99aaab;

    if (!allResolved && active) {
      color = active.color;
    } else if (allResolved) {
      const anyDone = Object.values(stages).some((s) => s.status === "done");
      description += anyDone ? "\n\n*sleep well 🌙*" : "\n\n*alright, nevermind then~*";
      color = anyDone ? 0x2f3136 : 0x57f287;
    }

    return new EmbedBuilder().setColor(color).setDescription(description);
  };

  const buildRow = () => {
    const pending = Object.entries(stages).filter(([, s]) => s.status === "pending");
    if (!pending.length) return [];

    const cancelRow = new ActionRowBuilder().addComponents(
      ...pending.map(([, s]) =>
        new ButtonBuilder()
          .setCustomId(s.cancelId)
          .setLabel(s.cancelLabel)
          .setEmoji(s.cancelEmoji || "❌")
          .setStyle(ButtonStyle.Secondary)
      )
    );

    const shiftRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("sleep_shift_minus30").setLabel("30m earlier").setEmoji("⏪").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("sleep_shift_plus30").setLabel("30m later").setEmoji("⏩").setStyle(ButtonStyle.Primary)
    );

    return [cancelRow, shiftRow];
  };

  const msg = await ctx.channel.send({ embeds: [buildEmbed()], components: buildRow() });
  sleepMessages.push(msg);

  const refresh = async () => {
    if (!msg.editable) return;
    try {
      await safeEdit(msg, { embeds: [buildEmbed()], components: buildRow() });
    } catch (err) {
      console.error("vc sleep refresh error:", err);
    }
  };

  let animationTimer = null;

  const stopAnimationIfDone = () => {
    if (Object.values(stages).every((s) => s.status !== "pending") && animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  };

  const cleanupTimers = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    // Clear animation timer
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }

    // Clear all stage timers
    for (const key of Object.keys(timers)) {
      clearTimeout(timers[key]);
    }

    // Remove from global sleepTimers
    const idx = sleepTimers.indexOf(animationTimer);
    if (idx > -1) sleepTimers.splice(idx, 1);
    for (const key of Object.keys(timers)) {
      const timerIdx = sleepTimers.indexOf(timers[key]);
      if (timerIdx > -1) sleepTimers.splice(timerIdx, 1);
    }

    // Remove message from sleepMessages
    const msgIdx = sleepMessages.indexOf(msg);
    if (msgIdx > -1) sleepMessages.splice(msgIdx, 1);
  };

  animationTimer = setInterval(() => {
    frame++;
    refresh();
    stopAnimationIfDone();
  }, ANIMATION_INTERVAL);
  sleepTimers.push(animationTimer);

  const scheduleStageTimer = (key) => {
    if (timers[key]) clearTimeout(timers[key]);
    const remaining = Math.max(0, stages[key].delay - (Date.now() - start));
    const t = setTimeout(async () => {
      if (stages[key].status !== "pending") return;
      stages[key].status = "done";
      try {
        await stages[key].action();
      } catch (err) {
        console.error(`vc sleep ${key} error:`, err);
      }
      await refresh();
      stopAnimationIfDone();

      // Check if all stages are done and clean up
      if (Object.values(stages).every((s) => s.status !== "pending")) {
        cleanupTimers();
        collector.stop();
      }
    }, remaining);
    timers[key] = t;
    sleepTimers.push(t);
  };

  for (const key of Object.keys(stages)) scheduleStageTimer(key);

  const shiftPendingStages = (deltaMs) => {
    const elapsed = Date.now() - start;
    for (const key of Object.keys(stages)) {
      const s = stages[key];
      if (s.status !== "pending") continue;
      const minDelay = elapsed + MIN_REMAINING_MS;
      s.delay = Math.max(s.delay + deltaMs, minDelay);
      scheduleStageTimer(key);
    }
  };

  // Add a timeout to the collector to prevent memory leaks (24 hours max)
  const collector = msg.createMessageComponentCollector({ time: 24 * 60 * 60 * 1000 });

  collector.on("collect", async (i) => {
    if (i.user.id !== ctx.authorId) {
      return i.reply({ content: "only the command author can change this~", flags: MessageFlags.Ephemeral });
    }

    if (i.customId === "sleep_shift_minus30" || i.customId === "sleep_shift_plus30") {
      shiftPendingStages(i.customId === "sleep_shift_minus30" ? -SHIFT_MS : SHIFT_MS);
      return i.update({ embeds: [buildEmbed()], components: buildRow() });
    }

    const key = Object.keys(stages).find((k) => stages[k].cancelId === i.customId);
    if (!key || stages[key].status !== "pending") return i.deferUpdate();

    stages[key].status = "cancelled";
    clearTimeout(timers[key]);

    await i.update({ embeds: [buildEmbed()], components: buildRow() });
    stopAnimationIfDone();

    if (Object.values(stages).every((s) => s.status !== "pending")) {
      cleanupTimers();
      collector.stop();
    }
  });

  collector.on("end", () => {
    cleanupTimers();
  });
}
// ─── HANDLERS ─────────────────────────────────────────────────────────────────

async function runSingleAction(ctx, actionKey, member, timeArg) {
  if (!member) return ctx.reply("Select a user.");
  if (!member.voice.channel) return ctx.reply("That user is not in VC.");

  const cmd = ACTIONS[actionKey];
  return scheduleSingleAction(ctx, {
    member,
    delayMs: parseTime(timeArg),
    title: cmd.title,
    verb: cmd.verb,
    emoji: cmd.emoji,
    action: cmd.action,
    cancelId: `cancel_${actionKey}`,
    completedText: cmd.singleDone,
  });
}

async function runMassAction(ctx, actionKey, timeArg) {
  const vc = ctx.member?.voice?.channel;
  if (!vc) return ctx.reply("Join a voice channel first.");

  const members = [...vc.members.values()].filter((m) => !m.user.bot);
  if (!members.length) return ctx.reply("No members found.");

  const cmd = ACTIONS[actionKey];
  return scheduleMassAction(ctx, {
    members,
    delayMs: parseTime(timeArg),
    title: cmd.title,
    verb: cmd.verb,
    emoji: cmd.emoji,
    completeText: cmd.massDone,
    action: cmd.action,
    cancelId: `cancel_${actionKey}_all`,
  });
}

async function handleSleepCancel(ctx) {
  for (const timer of sleepTimers) {
    try { clearTimeout(timer); } catch {}
  }
  sleepTimers.length = 0;

  for (const msg of sleepMessages) {
    try { await msg.delete(); } catch {}
  }
  sleepMessages.length = 0;

  try {
    return await ctx.channel.send("🌙 Nevermind I guess.");
  } catch (err) {
    console.error("handleSleepCancel error:", err);
  }
}

async function handleAfk(ctx, mode) {
  const { guild } = ctx;

  if (mode === "leave") {
    cleanupKeepalive(guild.id);

    await resetKeepaliveNickname(guild);

    return ctx.reply("🔇 Keepalive disabled. Left the VC.");
  }

  // mode === "join"
  const vc = ctx.member?.voice?.channel;
  if (!vc) return ctx.reply("🎧 Join a voice channel first.");

  // Register the target first so watchConnection/scheduleReconnect
  // know keepalive is active before any async work starts.
  keepaliveTargets.set(guild.id, { channelId: vc.id, guild });

  try {
    await connectAndWatch(guild, vc.id);
  } catch (err) {
    keepaliveTargets.delete(guild.id);
    console.error("[keepalive] Initial connect error:", err.message);
    return ctx.reply("❌ Could not join the voice channel.");
  }

  try {
    await guild.members.me.setNickname(KEEPALIVE_NICKNAME);
  } catch (err) {
    console.error("[keepalive] Failed to set nickname:", err.message);
  }

  return ctx.reply(`🔊 Keepalive enabled. Staying in **${vc.name}**.`);
}

// ─── SLASH COMMAND DEFINITION ─────────────────────────────────────────────────

const actionChoices = [
  { name: "Disconnect", value: "disconnect" },
  { name: "Deafen", value: "deafen" },
  { name: "Undeafen", value: "undeafen" },
  { name: "Mute", value: "mute" },
  { name: "Unmute", value: "unmute" },
];

const data = new SlashCommandBuilder()
  .setName("vc")
  .setDescription("Voice channel moderation & utility commands")
  .addSubcommand((sc) =>
    sc
      .setName("user")
      .setDescription("Affect one user")
      .addStringOption((o) =>
        o.setName("action").setDescription("What to do").setRequired(true).addChoices(...actionChoices)
      )
      .addUserOption((o) => o.setName("target").setDescription("Target user").setRequired(true))
      .addStringOption((o) =>
        o.setName("time").setDescription("Delay, e.g. 30s, 2m, 1m30s (default 10s)").setRequired(false)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("all")
      .setDescription("Affect everyone in your current VC")
      .addStringOption((o) =>
        o.setName("action").setDescription("What to do").setRequired(true).addChoices(...actionChoices)
      )
      .addStringOption((o) =>
        o.setName("time").setDescription("Delay, e.g. 30s, 2m, 1m30s (default 10s)").setRequired(false)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("afk")
      .setDescription("Keepalive controls")
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Join or leave voice")
          .setRequired(true)
          .addChoices({ name: "On", value: "join" }, { name: "Off", value: "leave" })
      )
  )
  .addSubcommand((sc) => sc.setName("sleepcancel").setDescription("Cancel a pending sleep sequence"));

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

const vcCommand = {
  name: "vc",
  aliases: [
    "yeet",
    "deafen",
    "undeafen",
    "mute",
    "unmute",
    "yeetall",
    "deafenall",
    "undeafenall",
    "muteall",
    "unmuteall",
    "sleepcancel",
    "stayvc",
    "afkvc",
    "keepvcalive",
    "stopvcalive",
    "leavevc",
    "thxforkeepingthevcalive",
    "leave",
  ],
  data,

  async execute(message, args = [], client, invokedName) {
    const ctx = contextFrom(message);
    const name = (invokedName || "").toLowerCase();

    const denied = checkMember(message.member);
    if (denied) return message.reply({ content: denied, allowedMentions: { roles: [] } });

    if (["stayvc", "afkvc", "keepvcalive"].includes(name)) return handleAfk(ctx, "join");
    if (["stopvcalive", "leavevc", "thxforkeepingthevcalive", "leave"].includes(name)) return handleAfk(ctx, "leave");
    if (name === "sleepcancel") return handleSleepCancel(ctx);

    const singleMap = {
      yeet: "disconnect",
      deafen: "deafen",
      undeafen: "undeafen",
      mute: "mute",
      unmute: "unmute",
    };

    const massMap = {
      yeetall: "disconnect",
      deafenall: "deafen",
      undeafenall: "undeafen",
      muteall: "mute",
      unmuteall: "unmute",
    };

    if (singleMap[name]) {
      const member = message.mentions.members.first();
      const timeArg = args.find((a) => !a.startsWith("<@"));
      return runSingleAction(ctx, singleMap[name], member, timeArg);
    }

    if (massMap[name]) {
      const timeArg = args[0];
      return runMassAction(ctx, massMap[name], timeArg);
    }

    return message.reply("Use `/vc user`, `/vc all`, `/vc afk`, or `/vc sleepcancel`.");
  },

  async executeInteraction(interaction) {
    const sub = interaction.options.getSubcommand();
    const ctx = contextFrom(interaction);

    const denied = checkMember(interaction.member);
    if (denied) return interaction.reply({ content: denied, flags: MessageFlags.Ephemeral, allowedMentions: { roles: [] } });

    await interaction.reply({ content: "⏳ On it...", flags: MessageFlags.Ephemeral });

    if (sub === "sleepcancel") return handleSleepCancel(ctx);
    if (sub === "afk") return handleAfk(ctx, interaction.options.getString("mode", true));

    if (sub === "user") {
      const action = interaction.options.getString("action", true);
      const user = interaction.options.getUser("target", true);
      const member =
        interaction.options.getMember("target") ||
        (await interaction.guild.members.fetch(user.id).catch(() => null));
      return runSingleAction(ctx, action, member, interaction.options.getString("time"));
    }

    if (sub === "all") {
      return runMassAction(ctx, interaction.options.getString("action", true), interaction.options.getString("time"));
    }
  },
};

vcCommand.scheduleSleep = (source, vc) => scheduleSleep(contextFrom(source), vc);
vcCommand.resetKeepaliveNickname = resetKeepaliveNickname;
vcCommand.keepaliveNickname = KEEPALIVE_NICKNAME;

module.exports = vcCommand;
