const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const playfulManager = require("../utils/playfulManager");
const { checkCooldown } = require("../utils/cooldowns");
const { replyTemp } = require("../utils/sendTemp");

const COOLDOWN_SECONDS = 30;
const MAX_NICK_LENGTH = 32;

// Random fun nicknames the bot briefly wears while being playful.
const PLAYFUL_NICKNAMES = [
  "Nyako is napping",
  "Nyako.exe",
  "Zoomies mode",
  "Nyako is loafing",
  "Professional napper",
  "Nyako is baking",
  "sneaky cat",
  "Chaotic nyako",
  "Nyako is plotting",
  "Hunting flies",
];

// Mock templates used when Nyako repeats someone ({content} and {user} get
// filled with the recent message text and the author's display name).
const MOCK_TEMPLATES = [
  "🦜 parroting {user}: \"{content}\" … yeah that's a quote, alright 💀",
  "bwuh?? {user} really typed \"{content}\" and hit send 👏 sure mate",
  "{user} said \"{content}\" and nobody clapped 🎶",
  "\"{content}\" — {user}, are you okay?? 👀",
  "{user} really just posted \"{content}\" 💀 *finger guns*",
  "audience of one here, but \"{content}\" is going down in history, {user} 📜",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Playful rename (temporary per-guild nickname) ─────────────────────────────

const revertTimers = new Map(); // guildId → timeout (nickname revert)
const pendingRenames = new Map(); // guildId → nickname that was applied

async function restoreNickname(guild) {
  const timer = revertTimers.get(guild.id);
  if (timer) {
    clearTimeout(timer);
    revertTimers.delete(guild.id);
  }

  const applied = pendingRenames.get(guild.id);
  pendingRenames.delete(guild.id);

  const me = guild.members.me;
  if (!me) return;

  // Only clear it if it's still our playful name — never clobber something else
  // (e.g. the keepalive "Nyako - The VC guard" nickname or a manual rename).
  if (applied && me.nickname !== applied) return;
  if (!applied && !me.nickname) return;

  try {
    await me.setNickname(null);
  } catch (err) {
    console.error(`[playful] Failed to restore nickname in "${guild.name}":`, err.message);
  }
}

async function schedulePlayfulRename(guild) {
  const me = guild.members.me;

  // Never clobber an existing nickname (e.g. keepalive guard name or a manual rename).
  if (!me || me.nickname) return false;

  const nickname = pick(PLAYFUL_NICKNAMES).slice(0, MAX_NICK_LENGTH);
  try {
    await me.setNickname(nickname);
  } catch (err) {
    console.error(`[playful] Rename failed in "${guild.name}":`, err.message);
    return false;
  }

  pendingRenames.set(guild.id, nickname);

  // Wear the name for 5–15 minutes, then revert.
  const delay = 5 * 60_000 + Math.floor(Math.random() * 10 * 60_000);
  const timer = setTimeout(() => {
    revertTimers.delete(guild.id);
    restoreNickname(guild);
  }, delay);
  if (typeof timer.unref === "function") timer.unref();
  revertTimers.set(guild.id, timer);

  return true;
}

// ─── Playful reply, server-wide ───────────────────────────────────────────────

// Per-message trigger chance: only react to 5% of messages.
const TRIGGER_CHANCE = 0.05;
// Of the messages it reacts to: 5% snarky mock, otherwise nya~ repeat.
const MOCK_CHANCE = 0.05;
const MOCK_MAX_LENGTH = 150;

function buildNyaRepeat(target) {
  const raw = target.content.trim();
  const content = raw.length > MOCK_MAX_LENGTH
    ? `${raw.slice(0, MOCK_MAX_LENGTH)}…`
    : raw;

  return Math.random() < 0.5 ? `nya~ ${content}` : `${content} nya~`;
}

function buildFunReply(target) {
  return Math.random() < MOCK_CHANCE ? buildMock(target) : buildNyaRepeat(target);
}

function buildMock(target) {
  const raw = target.content.trim();
  const content = raw.length > MOCK_MAX_LENGTH
    ? `${raw.slice(0, MOCK_MAX_LENGTH)}…`
    : raw;

  const user = target.member?.displayName || target.author.username;

  return pick(MOCK_TEMPLATES)
    .replaceAll("{content}", content)
    .replaceAll("{user}", user);
}

// Find a random usable text channel that recently got a human message,
// so replies feel server-wide instead of always landing in one spot.
async function findMockTarget(guild) {
  const me = guild.members.me;
  const candidates = [...guild.channels.cache.values()].filter(
    (c) =>
      c.isTextBased?.() &&
      !c.isThread?.() &&
      me &&
      c.permissionsFor(me)?.has(["SendMessages", "ReadMessageHistory"]),
  );

  // Shuffle so we don't always hit the first channel.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (const channel of candidates) {
    try {
      const fetched = await channel.messages.fetch({ limit: 10 });
      const humans = fetched.filter((m) => !m.author.bot && !!m.content.trim());
      if (humans.size) return { channel, target: humans.random() };
    } catch {
      // locked/deleted channel — keep hunting
    }
  }

  return null;
}

async function tryPlayfulReply(guild) {
  const found = await findMockTarget(guild);
  if (!found) return;

  try {
    await found.channel.send({
      content: buildFunReply(found.target),
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    console.error(`[playful] Reply send failed in "${guild.name}":`, err.message);
  }
}

// Per-message hook (wired into index.js): when playful is on, 5% of human
// messages get a reply — itself 5% a mock, otherwise a nya~ repeat.
async function onMessage(message) {
  if (message.author.bot) return;
  if (message.content.startsWith("nya!")) return; // don't mock commands
  if (!playfulManager.isEnabled(message.guild?.id)) return;
  if (Math.random() >= TRIGGER_CHANCE) return;

  try {
    await message.channel.send({
      content: buildFunReply(message),
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    console.error(`[playful] Reply send failed in "${message.guild?.name}":`, err.message);
  }
}

// ─── Scheduler: random activity every 30m–2h per guild ──────────────────────────

const playfulTimers = new Map(); // guildId → timeout
const RESCHEDULE_MIN = 30 * 60 * 1000;
const RESCHEDULE_RANGE = 90 * 60 * 1000;

function scheduleGuild(guild) {
  if (!guild || playfulTimers.has(guild.id)) return;
  if (!playfulManager.isEnabled(guild.id)) return;

  const delay = RESCHEDULE_MIN + Math.floor(Math.random() * RESCHEDULE_RANGE);
  const timer = setTimeout(() => {
    playfulTimers.delete(guild.id);
    runOnce(guild);
  }, delay);
  if (typeof timer.unref === "function") timer.unref();
  playfulTimers.set(guild.id, timer);
}

async function runOnce(guild) {
  if (!playfulManager.isEnabled(guild.id)) return;

  // 50/50: reply to someone (server-wide) or briefly wear a fun nickname.
  if (Math.random() < 0.5) {
    await tryPlayfulReply(guild);
  } else {
    await schedulePlayfulRename(guild);
  }

  scheduleGuild(guild);
}

function startPlayfulnessScheduler(client) {
  for (const guildId of playfulManager.getEnabledGuildIds()) {
    const guild = client?.guilds.cache.get(guildId);
    if (guild) scheduleGuild(guild);
  }
}

function ensureScheduled(client, guildId) {
  const guild = client?.guilds.cache.get(String(guildId));
  if (guild && playfulManager.isEnabled(guild.id)) scheduleGuild(guild);
}

// Turn a guild off entirely: cancel timers, restore the nickname, wipe config.
async function stopForGuild(guild) {
  const timer = playfulTimers.get(guild.id);
  if (timer) {
    clearTimeout(timer);
    playfulTimers.delete(guild.id);
  }

  await restoreNickname(guild);
  return playfulManager.disable(guild.id);
}

// ─── Command UI ───────────────────────────────────────────────────────────────

function buildStatus(guild) {
  return playfulManager.isEnabled(guild.id)
    ? "🐾 Playful mode is **on** (server-wide).\n" +
        "I occasionally mock someone or wear a fun nickname."
    : "🌀 Playful mode is **off**. Use `nya!playful on` or `/playful action:on` to enable.";
}

// Single top-level "/playful" command with one required "action" option that
// uses choices — mirrors /nyako, so it shows as one command in the picker
// with a dropdown instead of a list of subcommands.
const data = new SlashCommandBuilder()
  .setName("playful")
  .setDescription("Nyako's playful mode")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What do you want to do?")
      .setRequired(true)
      .addChoices(
        { name: "🐾 On", value: "on" },
        { name: "🌀 Off", value: "off" },
        { name: "📋 Status", value: "status" }
      )
  );

async function applyPlayfulAction(action, guild, client, send) {
  if (action === "on") {
    playfulManager.setEnabled(guild.id);
    ensureScheduled(client, guild.id);
    return send("🐾 Playful mode **on** (server-wide) — I'll be chaotic every now and then.");
  }

  if (action === "off") {
    const wasEnabled = playfulManager.isEnabled(guild.id);
    if (wasEnabled) await stopForGuild(guild);
    return send(
      wasEnabled
        ? "🌀 Playful mode off. I'll behave. probably."
        : "🌀 Playful mode was already off."
    );
  }

  return send(buildStatus(guild));
}

module.exports = {
  name: "playful",
  data,

  // exported scheduler hooks (used by index.js + command handlers)
  startPlayfulnessScheduler,
  ensureScheduled,
  stopForGuild,
  onMessage,

  // ----- Prefix: nya!playful on|off|status -----
  async execute(message, args) {
    const remaining = checkCooldown(message.author.id, "playful", COOLDOWN_SECONDS);
    if (remaining) {
      return replyTemp(
        (payload) => message.reply(payload),
        `⏳ Playful cooldown — wait **${remaining}s** before poking the cat.`
      );
    }

    const raw = (args[0] || "").toLowerCase();
    const action = ["on", "enable", "start"].includes(raw)
      ? "on"
      : ["off", "stop", "disable"].includes(raw)
        ? "off"
        : "status";

    return applyPlayfulAction(action, message.guild, message.client, (text) =>
      message.reply(text)
    );
  },

  // ----- Slash: /playful action:on|off|status -----
  async executeInteraction(interaction) {
    const remaining = checkCooldown(interaction.user.id, "playful", COOLDOWN_SECONDS);
    if (remaining) {
      return replyTemp(
        (payload) => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }),
        `⏳ Playful cooldown — wait **${remaining}s** before poking the cat.`
      );
    }

    const action = interaction.options.getString("action", true);

    return applyPlayfulAction(action, interaction.guild, interaction.client, (text) =>
      replyTemp(
        (payload) => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }),
        text
      )
    );
  },
};