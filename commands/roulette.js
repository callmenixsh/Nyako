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
const { sendTemp } = require("../utils/sendTemp");
const { checkMember } = require("../utils/permsManager");

const activeGames = new Map();

function getGameKey(guildId, voiceChannelId) {
  return `${guildId}:${voiceChannelId}`;
}

function buildDisabledRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roulette_start_disabled")
      .setLabel("Start")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("roulette_cancel_disabled")
      .setLabel("Cancel")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true)
  );
}

function createReplyAdapter(source) {
  const isInteraction = !!source.commandName;

  if (isInteraction) {
    return {
      isInteraction: true,
      member: source.member,
      guild: source.guild,
      channel: source.channel,
      user: source.user,
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
      async sendEphemeral(content) {
        if (source.deferred || source.replied) {
          return source.followUp({ content, flags: MessageFlags.Ephemeral });
        }
        return source.reply({ content, flags: MessageFlags.Ephemeral });
      },
    };
  }

  return {
    isInteraction: false,
    member: source.member,
    guild: source.guild,
    channel: source.channel,
    user: source.author,
    async ack() {},
    async sendMain(payload) {
      return source.reply(payload);
    },
    async sendEphemeral(content) {
      return source.reply(content);
    },
  };
}

function createGameEmbed({
  hostTag,
  players,
  eliminated,
  currentPlayer,
  round,
  position,
  text = "",
}) {
  const chamberVisual = Array.from({ length: 6 }, (_, i) => {
    if (i < position) return "🟩";
    if (i === position) return "🎯";
    return "⬛";
  }).join(" ");

  const alivePlayers = players.length
    ? players
        .map((p) =>
          p.id === currentPlayer?.id
            ? `🔫 ${p.user.username}`
            : `❤️ ${p.user.username}`
        )
        .join("\n")
    : "None";

  const deadPlayers = eliminated.length
    ? eliminated.map((p) => `☠️ ${p}`).join("\n")
    : "None";

  return new EmbedBuilder()
    .setColor("#c1121f")
    .setTitle("🎲 Russian Roulette")
    .setAuthor({ name: `Started by ${hostTag}` })
    .setDescription(`🎯 Round ${round}\n\n${text}`)
    .addFields(
      { name: "Alive", value: alivePlayers, inline: true },
      { name: "Eliminated", value: deadPlayers, inline: true },
      { name: "\u200B", value: "\u200B", inline: true },
      {
        name: "🎰 Chamber Progress",
        value: `${chamberVisual}\nShot ${Math.min(position + 1, 6)}/6`,
        inline: false,
      }
    )
    .setFooter({ text: `${players.length} player(s) remaining` })
    .setTimestamp();
}

async function runRoulette(source) {
  const ctx = createReplyAdapter(source);

  const denied = checkMember(ctx.member);
  if (denied) return ctx.sendMain({ content: denied, allowedMentions: { roles: [] } });

  await ctx.ack();

  const voiceChannel = ctx.member?.voice?.channel;
  if (!voiceChannel) {
    return ctx.sendMain({ content: "Join a voice channel first." });
  }

  let players = [...voiceChannel.members.values()].filter((m) => !m.user.bot);
  if (players.length < 2) {
    return ctx.sendMain({ content: "Need at least 2 players." });
  }

  const remaining = checkCooldown(ctx.user.id, "roulette", 60);
  if (remaining) {
    return sendTemp(ctx, `⏳ Please wait **${remaining}s** The map is cleaning itself.`);
  }

  const gameKey = getGameKey(ctx.guild.id, voiceChannel.id);
  if (activeGames.has(gameKey)) {
    return sendTemp(ctx, "A roulette game is already running in this voice channel.");
  }

  activeGames.set(gameKey, true);

  let eliminated = [];
  let round = 1;
  let chamber = Math.floor(Math.random() * 6);
  let position = 0;
  let turnIndex = 0;
  let gameActive = false;
  let gameEnded = false;
  const originalVoiceChannelId = voiceChannel.id;

  const startRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roulette_start")
      .setLabel("Start")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("roulette_cancel")
      .setLabel("Cancel")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

  let msg;

  try {
    msg = await ctx.sendMain({
      embeds: [
        createGameEmbed({
          hostTag: ctx.user.tag,
          players,
          eliminated,
          currentPlayer: null,
          round,
          position,
          text: "-# The revolver is loaded.\nPress **Start** to begin.",
        }),
      ],
      components: [startRow],
    });

    if (ctx.isInteraction) {
      msg = await source.fetchReply();
    }

    const cleanup = () => {
      if (!gameEnded) {
        gameEnded = true;
        activeGames.delete(gameKey);
      }
    };

    const finishGame = async (embed) => {
      gameActive = false;
      cleanup();
      await safeEdit(msg, {
        embeds: [embed],
        components: [buildDisabledRow()],
      });
    };

    const nextTurn = async () => {
      if (!gameActive || gameEnded) return;

      players = players.filter(
        (p) => p.voice.channel && p.voice.channel.id === originalVoiceChannelId
      );

      if (players.length <= 1) {
        return finishGame(
          new EmbedBuilder()
            .setColor("Gold")
            .setTitle("🏆 Roulette Completed")
            .setDescription(`👑 **${players[0]?.user.tag || "Nobody"}**`)
            .addFields({
              name: "Eliminated",
              value: eliminated.length
                ? eliminated.map((player) => `💀 ${player}`).join("\n")
                : "Nobody",
            })
            .setTimestamp()
        );
      }

      if (turnIndex >= players.length) turnIndex = 0;

      const player = players[turnIndex];
      turnIndex++;

      if (
        !(await safeEdit(msg, {
          embeds: [
            createGameEmbed({
              hostTag: ctx.user.tag,
              players,
              eliminated,
              currentPlayer: player,
              round,
              position,
              text: `📢 **${player.user.tag}'s turn**`,
            }),
          ],
          components: [],
        }))
      ) {
        cleanup();
        return;
      }

      setTimeout(async () => {
        try {
        if (!gameActive || gameEnded) return;

        const playerStillHere =
          player.voice.channel && player.voice.channel.id === originalVoiceChannelId;

        if (position === chamber) {
          if (playerStillHere) {
            try {
              await player.voice.setChannel(null);
            } catch {}
          }

          eliminated.push(player.user.tag);
          players = players.filter((p) => p.id !== player.id);

          if (turnIndex >= players.length) turnIndex = 0;

          if (
            !(await safeEdit(msg, {
              embeds: [
                createGameEmbed({
                  hostTag: ctx.user.tag,
                  players,
                  eliminated,
                  currentPlayer: null,
                  round,
                  position,
                  text: `💥 **BANG!**\n${player.user.tag} has been eliminated.`,
                }),
              ],
              components: [],
            }))
          ) {
            cleanup();
            return;
          }

          round++;
          chamber = Math.floor(Math.random() * 6);
          position = 0;
        } else {
          if (
            !(await safeEdit(msg, {
              embeds: [
                createGameEmbed({
                  hostTag: ctx.user.tag,
                  players,
                  eliminated,
                  currentPlayer: player,
                  round,
                  position: position + 1,
                  text: `😮 **Click...**\n${player.user.tag} survived.`,
                }),
              ],
              components: [],
            }))
          ) {
            cleanup();
            return;
          }

          position++;
        }

        setTimeout(nextTurn, 2000);
        } catch (err) {
          console.error("roulette turn error:", err);
          cleanup();
        }
      }, 2000);
    };

    const lobbyCollector = msg.createMessageComponentCollector({
      time: 30000,
    });

    lobbyCollector.on("collect", async (i) => {
      try {
      if (i.user.id !== ctx.user.id) {
        return i.reply({
          content: "Only the host can do that.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (i.customId === "roulette_cancel") {
        gameActive = false;
        cleanup();
        lobbyCollector.stop("cancelled");

        return i.update({
          embeds: [
            createGameEmbed({
              hostTag: ctx.user.tag,
              players,
              eliminated,
              currentPlayer: null,
              round,
              position,
              text: "❌ Roulette cancelled.",
            }),
          ],
          components: [buildDisabledRow()],
        });
      }

      if (i.customId === "roulette_start") {
        lobbyCollector.stop("started");
        gameActive = true;

        await i.update({
          embeds: [
            createGameEmbed({
              hostTag: ctx.user.tag,
              players,
              eliminated,
              currentPlayer: null,
              round,
              position,
              text: "🎲 Spinning the chamber...",
            }),
          ],
          components: [],
        });

        setTimeout(nextTurn, 2000);
      }
      } catch (err) {
        console.error("roulette lobby error:", err);
        cleanup();
      }
    });

    lobbyCollector.on("end", async (_, reason) => {
      if (reason === "time" && !gameActive && !gameEnded) {
        cleanup();
        await safeEdit(msg, {
          embeds: [
            createGameEmbed({
              hostTag: ctx.user.tag,
              players,
              eliminated,
              currentPlayer: null,
              round,
              position,
              text: "⌛ Lobby expired.",
            }),
          ],
          components: [buildDisabledRow()],
        });
      }
    });
  } catch (err) {
    activeGames.delete(gameKey);
    throw err;
  }
}

module.exports = {
  name: "roulette",

  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("Start a Russian roulette game in your current voice channel"),

  async execute(message) {
    return runRoulette(message);
  },

  async executeInteraction(interaction) {
    return runRoulette(interaction);
  },
};
