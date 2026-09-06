const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");
const { safeEdit } = require("../utils/safeEdit");
const { checkCooldown } = require("../utils/cooldowns");
const hotPotatoes = require("../data/hotPotatoes");

const potatoStages = [
  "🥔 The potato seems harmless.",
  "🙂 The potato feels slightly warm.",
  "😐 The potato is warming up.",
  "😬 The potato is vibrating.",
  "⚠️ The potato is making strange noises.",
  "🔥 The potato is getting dangerously hot.",
  "💣 The potato looks extremely unstable.",
  "☢️ The potato is moments from disaster.",
];

const dangerMessages = [
  "💥 BOOM!",
  "☠️ DETONATION DETECTED!",
  "🚨 CRITICAL FAILURE!",
  "🔥 POTATO EXPLOSION IMMINENT!",
  "⚠️ CONTAINMENT FAILURE!",
  "☢️ REACTOR MELTDOWN DETECTED!",
  "💣 ARMING SEQUENCE STARTED!",
  "🚨 CORE INSTABILITY DETECTED!",
];

function getPrematureChance(percent) {
  if (percent > 0.875) return 0;
  if (percent > 0.75) return 0.0025;
  if (percent > 0.625) return 0.005;
  if (percent > 0.5) return 0.01;
  if (percent > 0.375) return 0.02;
  if (percent > 0.25) return 0.03;
  if (percent > 0.125) return 0.04;
  return 0.05;
}

function createContext(source) {
  const isInteraction = !!source.commandName;

  if (isInteraction) {
    return {
      isInteraction: true,
      user: source.user,
      member: source.member,
      guild: source.guild,
      channel: source.channel,
      async ack() {
        if (!source.deferred && !source.replied) {
          await source.deferReply();
        }
      },
      async sendMain(payload) {
        if (source.deferred || source.replied) {
          return source.editReply(payload);
        }
        return source.reply(payload);
      },
    };
  }

  return {
    isInteraction: false,
    user: source.author,
    member: source.member,
    guild: source.guild,
    channel: source.channel,
    async ack() {},
    async sendMain(payload) {
      return source.reply(payload);
    },
  };
}

function createEmbed(game) {
  return new EmbedBuilder()
    .setColor("Orange")
    .setTitle("🥔 Hot Potato")
    .addFields(
      { name: "\u200B", value: game.status, inline: false },
      { name: "\u200B", value: game.lastActivity || "Game Started", inline: false }
    )
    .setTimestamp();
}

function getStage(percent) {
  if (percent > 0.875) return potatoStages[0];
  if (percent > 0.75) return potatoStages[1];
  if (percent > 0.625) return potatoStages[2];
  if (percent > 0.5) return potatoStages[3];
  if (percent > 0.375) return potatoStages[4];
  if (percent > 0.25) return potatoStages[5];
  if (percent > 0.125) return potatoStages[6];
  return potatoStages[7];
}

async function updateBoard(game, customStatus = null) {
  if (game.ended && customStatus === null) return;
  if (game.statusLocked && customStatus === null) return;

  const row = game.ended
    ? null
    : new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pass_potato")
          .setLabel("Pass Potato")
          .setEmoji("🥔")
          .setStyle(ButtonStyle.Primary)
      );

  const percent = Math.max(0, (game.endTime - Date.now()) / game.maxTime);
  const displayStatus = customStatus || getStage(percent);

  return safeEdit(
    game.statusMessage,
    {
      embeds: [
        createEmbed({
          ...game,
          status: displayStatus,
        }),
      ],
      components: row ? [row] : [],
    },
    () => {
      game.ended = true;
      if (game.warningTimeout) clearTimeout(game.warningTimeout);
      hotPotatoes.delete(game.voiceChannelId);
    }
  );
}

async function runHotPotato(source) {
  const ctx = createContext(source);
  await ctx.ack();

  const remaining = checkCooldown(ctx.user.id, "hotpotato", 60);
  if (remaining) {
    return ctx.sendMain(`⏳ Please wait **${remaining}s** The potato is being prepared.`);
  }

  const vc = ctx.member?.voice?.channel;
  if (!vc) return ctx.sendMain("Join a voice channel first.");

  const players = [...vc.members.values()].filter((m) => !m.user.bot);
  if (players.length < 2) return ctx.sendMain("Need at least 2 players.");

  if (hotPotatoes.has(vc.id)) {
    return ctx.sendMain("A potato game is already running!");
  }

  const holder = players[Math.floor(Math.random() * players.length)];
  const explodeTime = (Math.floor(Math.random() * 61) + 30) * 1000;

  const game = {
    holderId: holder.id,
    voiceChannelId: vc.id,
    endTime: Date.now() + explodeTime,
    maxTime: explodeTime,
    status: potatoStages[0],
    lastActivity: "Game Started",
    statusLocked: false,
    ended: false,
    warningTimeout: null,
    statusMessage: null,
    holderMessage: null,
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pass_potato")
      .setLabel("Pass Potato")
      .setEmoji("🥔")
      .setStyle(ButtonStyle.Primary)
  );

  const statusMessage = await ctx.sendMain({
    embeds: [createEmbed(game)],
    components: [row],
  });

  game.statusMessage = statusMessage;

  const holderMessage = await ctx.sendMain(`🥔 <@${holder.id}> has the potato!`);
  game.holderMessage = holderMessage;

  hotPotatoes.set(vc.id, game);

  const collector = statusMessage.createMessageComponentCollector({
    time: explodeTime,
  });

  collector.on("collect", async (i) => {
    const currentGame = hotPotatoes.get(vc.id);
    if (!currentGame || currentGame.ended) return;

    if (i.user.id !== currentGame.holderId) {
      return i.reply({
        content: "You do not have the potato!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const availablePlayers = [...vc.members.values()].filter(
      (m) => !m.user.bot && m.id !== currentGame.holderId
    );

    if (!availablePlayers.length) {
      return i.reply({
        content: "Nobody to pass to.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const target = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
    const percent = Math.max(0, (currentGame.endTime - Date.now()) / currentGame.maxTime);
    const explodeChance = getPrematureChance(percent);

    if (Math.random() < explodeChance) {
      currentGame.ended = true;
      collector.stop("exploded");

      const warning = dangerMessages[Math.floor(Math.random() * dangerMessages.length)];

      await updateBoard(
        currentGame,
        `# 💥 MID-PASS DETONATION\nPotato exploded on <@${currentGame.holderId}>`
      );

      await ctx.channel.send(`${warning}\n💥 THE POTATO DETONATED MID-PASS!`);

      const victim = message.guild.members.cache.get(currentGame.holderId);
      try {
        if (victim?.voice.channel) await victim.voice.setChannel(null);
      } catch {}

      await safeEdit(currentGame.holderMessage, {
        content: `💀 <@${currentGame.holderId}> was vaporized by the potato!`,
      });

      currentGame.ended = true;
      hotPotatoes.delete(vc.id);
      return;
    }

    const currentHolder = message.guild.members.cache.get(currentGame.holderId);
    currentGame.lastActivity = `${currentHolder.displayName} passed the 🥔 to ${target.displayName}`;
    currentGame.holderId = target.id;

    await i.deferUpdate();
    await updateBoard(currentGame);
    await safeEdit(currentGame.holderMessage, {
      content: `🥔 <@${target.id}> has the potato!`,
    });
  });

  const scheduleWarning = async () => {
    const currentGame = hotPotatoes.get(vc.id);
    if (!currentGame || currentGame.ended) return;

    if (Math.random() < 0.15) {
      const fakeText = dangerMessages[Math.floor(Math.random() * dangerMessages.length)];
      const fakeMsg = await ctx.channel.send(fakeText);
      currentGame.statusLocked = true;

      await updateBoard(currentGame, `# ${fakeText}\nSomething is wrong...`);

      setTimeout(async () => {
        if (!hotPotatoes.has(vc.id) || currentGame.ended) return;

        await updateBoard(currentGame, `# 🚨 FALSE ALARM\n${fakeText}`);

        try {
          await fakeMsg.edit(`${fakeText}\n😏 False alarm.`);
          setTimeout(async () => {
            if (!hotPotatoes.has(vc.id) || currentGame.ended) return;
            currentGame.statusLocked = false;
            await updateBoard(currentGame);
            await fakeMsg.delete().catch(() => {});
          }, 2500);
        } catch {}
      }, 1500);
    } else {
      await updateBoard(currentGame);
    }

    const nextDelay = Math.floor(Math.random() * 6000) + 4000;
    currentGame.warningTimeout = setTimeout(scheduleWarning, nextDelay);
  };

  game.warningTimeout = setTimeout(
    scheduleWarning,
    Math.floor(Math.random() * 6000) + 4000
  );

  setTimeout(async () => {
    const currentGame = hotPotatoes.get(vc.id);
    if (!currentGame || currentGame.ended) return;

    collector.stop("timeout");
    clearTimeout(currentGame.warningTimeout);

    if (Math.random() < 0.01) {
      currentGame.ended = true;
      await updateBoard(
        currentGame,
        "# ☢️ NUCLEAR POTATO DETONATED ☢️\n💀 Everybody died."
      );

      for (const member of vc.members.values()) {
        if (!member.user.bot && member.voice.channel) {
          try {
            await member.voice.setChannel(null);
          } catch {}
        }
      }

      hotPotatoes.delete(vc.id);
      return;
    }

    const victim = vc.members.get(currentGame.holderId);
    if (victim?.voice.channel) {
      try {
        const warning = dangerMessages[Math.floor(Math.random() * dangerMessages.length)];

        await updateBoard(
          currentGame,
          `# ${warning}\nThe potato can no longer be contained...`
        );

        await new Promise((r) => setTimeout(r, 1500));

        await victim.voice.setChannel(null);
        currentGame.ended = true;

        await updateBoard(
          currentGame,
          `# 💥 POTATO DETONATED\nPotato exploded on <@${victim.id}>`
        );

        await safeEdit(currentGame.holderMessage, {
          content: `💀 <@${victim.id}> was vaporized by the potato!`,
        });

        await ctx.channel.send(`🥔 ${victim} was vaporized by the potato.`);
      } catch (err) {
        console.error(err);
      }
    }

    await safeEdit(statusMessage, { components: [] });
    hotPotatoes.delete(vc.id);
  }, explodeTime);
}

module.exports = {
  name: "hotpotato",

  data: new SlashCommandBuilder()
    .setName("hotpotato")
    .setDescription("Play hot potato in your current voice channel"),

  async execute(message) {
    return runHotPotato(message);
  },

  async executeInteraction(interaction) {
    return runHotPotato(interaction);
  },
};
