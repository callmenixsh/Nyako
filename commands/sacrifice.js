const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { safeEdit } = require("../utils/safeEdit");
const { checkCooldown } = require("../utils/cooldowns");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const activeSacrifices = new Set();

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function progressBar(percent, size = 20) {
  const filled = Math.round((percent / 100) * size);
  return "█".repeat(filled) + "░".repeat(size - filled);
}

function channelKey(channel) {
  return `${channel.guild.id}:${channel.id}`;
}

function createContext(source) {
  const isInteraction = !!source.commandName;

  if (isInteraction) {
    return {
      isInteraction: true,
      guild: source.guild,
      channel: source.channel,
      member: source.member,
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
    };
  }

  return {
    isInteraction: false,
    guild: source.guild,
    channel: source.channel,
    member: source.member,
    user: source.author,
    async ack() {},
    async sendMain(payload) {
      return source.reply(payload);
    },
  };
}

function build(title, desc, color) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc);
}

const acceptedTexts = [
  "was consumed without resistance.",
  "was accepted into the void.",
  "was quietly absorbed.",
  "faded out of existence.",
  "was erased like it was nothing.",
  "was thrown into the ritual.",
  "was taken without resistance.",
  "was consumed by the ritual.",
];

const rejectedTexts = [
  "slipped away just in time.",
  "was overlooked by the ritual.",
  "barely avoided being taken.",
  "was ignored by the void.",
  "escaped the ritual unnoticed.",
  "was not consumed this time.",
  "got skipped by the ritual flow.",
  "was left out of the ritual.",
];

const backfireTexts = [
  "fell into the ritual instead.",
  "got caught in the ritual by accident.",
  "slipped into the offering circle.",
  "was dragged into the ritual flow instead.",
  "walked straight into the sacrifice instead.",
  "ended up inside the ritual somehow.",
  "became part of the ritual instead.",
  "accidentally joined the sacrifice.",
  "got exchanged with the ritual's sacrifice.",
  "was pulled into the ritual instead.",
];

const multiTexts = [
  "were taken all at once… the system couldn't hold it.",
  "were consumed together in one pull.",
  "were swallowed by the ritual simultaneously.",
  "got caught in the same ritual surge.",
  "were pulled in as a group offering.",
  "were taken all at once.",
  "were all included in the outcome at once.",
  "vanished together without separation.",
];

const fractureStates = [
  "the ritual begins to take shape...",
  "offerings are being evaluated...",
  "the void hesitates...",
  "selection pressure increasing...",
  "the ritual cannot stabilize...",
  "judgement fractures forming...",
  "the offering resists completion...",
];

async function runSacrifice(source, explicitTargetMember = null) {
  const ctx = createContext(source);
  await ctx.ack();

  if (!ctx.guild) {
    return ctx.sendMain({ content: "This command only works in a server." });
  }

  const key = channelKey(ctx.channel);

  try {
    if (activeSacrifices.has(key)) {
      return ctx.sendMain({ content: "A ritual is already in progress in this channel." });
    }

    const remaining = checkCooldown(ctx.user.id, "sacrifice", 60);
    if (remaining) {
      return ctx.sendMain({
        content: `⏳ Please wait **${remaining}s** the ritual was recently fed.`,
      });
    }

    if (explicitTargetMember?.user.bot) {
      return ctx.sendMain({ content: "The ritual refuses bot offerings." });
    }

    activeSacrifices.add(key);

    let membersSource;
    try {
      membersSource = await ctx.guild.members.fetch();
    } catch {
      membersSource = ctx.guild.members.cache;
    }

    const members = [...membersSource.values()].filter((m) => !m.user.bot);

    if (members.length < 2) {
      return ctx.sendMain({
        content: "Not enough non-bot members are available for the ritual.",
      });
    }

    const selfId = ctx.member?.id ?? ctx.user.id;
    const poolWithoutSelf = members.filter((m) => m.id !== selfId);

    if (!poolWithoutSelf.length) {
      return ctx.sendMain({ content: "The ritual found no valid targets." });
    }

    let targets = [];
    let isMulti = false;

    const roll = Math.random();
    if (roll < 0.1) {
      isMulti = true;
      const shuffled = [...poolWithoutSelf].sort(() => Math.random() - 0.5);
      const count = Math.min(Math.floor(Math.random() * 3) + 2, shuffled.length);
      targets = shuffled.slice(0, count);
    } else if (explicitTargetMember) {
      targets.push(explicitTargetMember);
    } else {
      targets.push(pick(poolWithoutSelf));
    }

    const fmt = (m) => `<@${m.id}>`;
    const allowedUserIds = [
      ...new Set(targets.map((m) => m.id).concat(ctx.member?.id ? [ctx.member.id] : [])),
    ];
    const formatTargets = (arr) => {
      if (arr.length === 1) return arr[0];
      if (arr.length === 2) return `${arr[0]} & ${arr[1]}`;
      return `${arr.slice(0, -1).join(" ")} & ${arr[arr.length - 1]}`;
    };

    const msg = await ctx.sendMain({
      embeds: [
        build(
          "☠️ THE RITUAL AWAKENS",
          isMulti ? "…a crowd of echoes stirs." : "a presence has been marked.",
          "DarkRed"
        ),
      ],
      allowedMentions: { users: allowedUserIds },
    });

    const edit = (payload) => safeEdit(msg, payload);
    const fail = (ok) => !ok;

    await sleep(1100);
    if (fail(await edit({ embeds: [build("☠️ SIGNAL ACQUIRED", "the system is listening…", "Red")], allowedMentions: { users: allowedUserIds } }))) return;

    await sleep(1100);
    if (
      fail(
        await edit({
          embeds: [
            build(
              "🩸 SOMETHING IS RESPONDING",
              isMulti ? "…too many echoes detected" : "subject instability rising",
              "DarkOrange"
            ),
          ],
          allowedMentions: { users: allowedUserIds },
        })
      )
    )
      return;

    const makeGlitchBar = (percent, size = 20) => {
      let bar = "";
      for (let i = 0; i < size; i++) {
        const r = Math.random();
        if (i < (percent / 100) * size) {
          bar += r < 0.2 ? "░" : r < 0.5 ? "▓" : "█";
        } else {
          bar += r < 0.15 ? "▓" : "░";
        }
      }
      return bar;
    };

    let percent = 35;

    for (let i = 0; i < fractureStates.length; i++) {
      for (let j = 0; j < 3; j++) {
        if (i < 2) percent += Math.random() * 8 + 4;
        else if (i < 4) percent -= Math.random() * 10 + 3;
        else if (i < 6) percent += Math.random() * 9 + 5;
        else percent -= Math.random() * 6 + 2;

        percent = Math.max(5, Math.min(95, percent));

        const bar = makeGlitchBar(percent);

        let base = `${fractureStates[i]}\n\n${bar}\n\`stability: ${Math.floor(percent)}%\``;

        if (Math.random() < 0.22) {
          const chars = "▓▒░#*&@%$!";
          base = base
            .split("")
            .map((c) => (Math.random() < 0.08 ? pick(chars) : c))
            .join("");
        }

        if (fail(await edit({ embeds: [build("☠️ RITUAL IN PROGRESS", base, "Orange")], allowedMentions: { users: allowedUserIds } }))) return;

        await sleep(380);
      }
    }

    if (
      fail(
        await edit({
          embeds: [
            build(
              "☠️ RITUAL CONVERGENCE",
              `THE OFFERING HAS RESOLVED\n\n${progressBar(100)}\n\`FINAL SELECTION DONE\``,
              "DarkRed"
            ),
          ],
          allowedMentions: { users: allowedUserIds },
        })
      )
    )
      return;

    await sleep(1000);

    if (
      fail(
        await edit({
          embeds: [
            build(
              "☠️ ENTITY DECIDING OUTCOME",
              isMulti ? "It is no longer one target…" : "Judgement is IMMINENT",
              "Red"
            ),
          ],
          allowedMentions: { users: allowedUserIds },
        })
      )
    )
      return;

    await sleep(1100);

    const outcomeRoll = Math.random();
    const outcome =
      outcomeRoll < 0.5 ? "accepted" : outcomeRoll < 0.85 ? "rejected" : "backfire";

    let text;
    let color;

    if (isMulti) {
      const names = targets.map(fmt);
      const frames = [
        names[0],
        formatTargets(names.slice(0, 2)),
        formatTargets(names.slice(0, 3)),
        `${formatTargets(names)} ${pick(multiTexts)}`,
      ];
      const frameColors = ["DarkRed", "Red", "Orange", "Purple"];

      for (let i = 0; i < frames.length; i++) {
        if (
          fail(
            await edit({
              embeds: [
                new EmbedBuilder()
                  .setColor(frameColors[i])
                  .setTitle("☠️ SACRIFICE RESULT")
                  .setDescription(frames[i]),
              ],
              allowedMentions: { users: allowedUserIds },
            })
          )
        )
          return;

        await sleep(800);
      }

      text = frames[frames.length - 1];
      color = "Purple";
    } else {
      const originalTarget = targets[0];
      const target = outcome === "backfire" ? ctx.member : originalTarget;

      for (const suffix of ["", " ..."]) {
        if (
          fail(
            await edit({
              embeds: [build("☠️ SACRIFICE RESULT", `${fmt(target)}${suffix}`, "Blue")],
              allowedMentions: { users: allowedUserIds },
            })
          )
        )
          return;

        await sleep(850);
      }

      const list =
        outcome === "accepted" ? acceptedTexts : outcome === "rejected" ? rejectedTexts : backfireTexts;
      text = `${fmt(target)} ${pick(list)}`;
      color =
        outcome === "accepted" ? "Green" : outcome === "rejected" ? "Orange" : "Red";
    }

    await edit({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle("☠️ SACRIFICE RESULT")
          .setDescription(text)
          .setFooter({ text: "something is still listening..." }),
      ],
      allowedMentions: { users: allowedUserIds },
    });
  } catch (err) {
    console.error("sacrifice error:", err);
    return ctx.sendMain({ content: "the ritual failed to stabilize." });
  } finally {
    activeSacrifices.delete(key);
  }
}

module.exports = {
  name: "sacrifice",

  data: new SlashCommandBuilder()
    .setName("sacrifice")
    .setDescription("Let the ritual choose a sacrifice")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Optional target for the ritual")
        .setRequired(false)
    ),

  async execute(message) {
    const explicitTarget = message.mentions.members.first() || null;
    return runSacrifice(message, explicitTarget);
  },

  async executeInteraction(interaction) {
    const user = interaction.options.getUser("target");
    const explicitTarget =
      user
        ? interaction.options.getMember("target") ||
          (await interaction.guild.members.fetch(user.id).catch(() => null))
        : null;

    return runSacrifice(interaction, explicitTarget);
  },
};