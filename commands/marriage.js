const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");

const marriageManager = require("../utils/marriageManager");
const { safeEdit } = require("../utils/safeEdit");
const { checkCooldown } = require("../utils/cooldowns");
const { sendTemp } = require("../utils/sendTemp");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MARRY_STEPS = [
  "Verifying identities",
  "Checking marriage records",
  "Preparing certificate",
  "Delivering proposal",
];

const DIVORCE_STEPS = [
  "Retrieving marriage records",
  "Preparing divorce papers",
  "Sending request",
];

function createContext(source) {
  const isInteraction = !!source.commandName;

  if (isInteraction) {
    return {
      isInteraction: true,
      user: source.user,
      member: source.member,
      guild: source.guild,
      channel: source.channel,
      async ack(ephemeral = false) {
        if (!source.deferred && !source.replied) {
          await source.deferReply({ ephemeral });
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

function getDuration(marriedAt) {
  const now = Date.now();
  let seconds = Math.floor((now - marriedAt * 1000) / 1000);

  const years = Math.floor(seconds / 31536000);
  seconds %= 31536000;

  const months = Math.floor(seconds / 2592000);
  seconds %= 2592000;

  const days = Math.floor(seconds / 86400);

  const parts = [];
  if (years) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (days || !parts.length) parts.push(`${days} day${days !== 1 ? "s" : ""}`);

  return parts.join(", ");
}

function buildChecklist(steps, done) {
  const lines = steps.map(
    (step, i) => `${i < done ? "✅" : i === done ? "⏳" : "⬜"} ${step}`,
  );
  return ["Preparing your request...\n", ...lines].join("\n");
}

async function playChecklist(msg, steps, color, title) {
  for (let i = 0; i <= steps.length; i++) {
    const ok = await safeEdit(msg, {
      embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(buildChecklist(steps, i))],
    });
    if (!ok) return false;
    await sleep(i === steps.length ? 800 : 700);
  }
  return true;
}

async function resolveMember(source, ctx) {
  if (ctx.isInteraction) {
    const optUser = source.options.getUser("user");
    if (optUser) {
      return (
        source.options.getMember("user") ||
        (await source.guild.members.fetch(optUser.id).catch(() => ctx.member)) ||
        ctx.member
      );
    }
    return ctx.member;
  }
  return source.mentions.members.first() || ctx.member;
}

async function handleMarry(source) {
  const ctx = createContext(source);
  await ctx.ack(false);

  const remaining = checkCooldown(ctx.user.id, "marry", 30);
  if (remaining) {
    return sendTemp(ctx, `⏳ Please wait **${remaining}s** the officiant is preparing.`);
  }

  const targetMember = ctx.isInteraction
    ? source.options.getMember("user") ||
      (await source.guild.members.fetch(source.options.getUser("user", true).id).catch(() => null))
    : source.mentions.members.first();

  if (!targetMember) return ctx.sendMain("Mention or choose someone to propose to.");

  if (targetMember.id === ctx.user.id) {
    return ctx.sendMain("You can't marry yourself... probably for the best.");
  }

  if (targetMember.id === process.env.CLIENT_ID) {
    return ctx.sendMain({
      embeds: [
        new EmbedBuilder()
          .setColor("#FF69B4")
          .setTitle("💍 Proposal Rejected")
          .setDescription(
            [
              "Aww... that's sweet. 💕",
              "",
              "But if I got married, who would run all the commands around here?",
              "",
              "I'd hate to play favorites.",
            ].join("\n"),
          ),
      ],
    });
  }

  if (targetMember.user.bot) {
    return ctx.sendMain("Bots cannot legally marry someone.");
  }

  if (marriageManager.isMarried(ctx.user.id)) return ctx.sendMain("You're already married.");
  if (marriageManager.isMarried(targetMember.id)) {
    return ctx.sendMain(`${targetMember.displayName} is already married.`);
  }

  if (
    marriageManager.hasActiveProposal(ctx.user.id) ||
    marriageManager.hasActiveProposal(targetMember.id)
  ) {
    return ctx.sendMain("One of you already has a pending proposal.");
  }

  marriageManager.createProposal(ctx.user.id, targetMember.id);

  const proposalEnds = Math.floor(Date.now() / 1000) + 60;

  const proposalMsg = await ctx.sendMain({
    embeds: [
      new EmbedBuilder()
        .setColor("#FFD166")
        .setTitle("💍 Marriage Office")
        .setDescription(buildChecklist(MARRY_STEPS, 0)),
    ],
  });

  if (!(await playChecklist(proposalMsg, MARRY_STEPS, "#FFD166", "💍 Marriage Office"))) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`marry_accept_${proposalMsg.id}`)
      .setLabel("Accept")
      .setEmoji("❤️")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`marry_decline_${proposalMsg.id}`)
      .setLabel("Decline")
      .setEmoji("💔")
      .setStyle(ButtonStyle.Danger)
  );

  await safeEdit(proposalMsg, {
    content: `<@${targetMember.id}>`,
    embeds: [
      new EmbedBuilder()
        .setColor("#FF69B4")
        .setTitle("💍 Marriage Proposal")
        .setDescription(
          [
            `${ctx.user} wants to marry ${targetMember}.`,
            "",
            "**Will you accept this proposal?**",
            "",
            `⏳ Expires <t:${proposalEnds}:R>`,
          ].join("\n"),
        )
        .setAuthor({
          name: `${ctx.member.displayName}'s Proposal`,
          iconURL: ctx.user.displayAvatarURL(),
        })
        .setThumbnail(targetMember.user.displayAvatarURL()),
    ],
    components: [row],
    allowedMentions: { users: [targetMember.id] },
  });

  const collector = proposalMsg.createMessageComponentCollector({
    time: 60000,
    filter: (i) =>
      i.customId === `marry_accept_${proposalMsg.id}` ||
      i.customId === `marry_decline_${proposalMsg.id}`,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.user.id !== targetMember.id) {
      return interaction.reply({
        content: "This proposal isn't for you.",
        flags: MessageFlags.Ephemeral,
      });
    }

    collector.stop(interaction.customId);

    if (interaction.customId === `marry_accept_${proposalMsg.id}`) {
      marriageManager.marry(
        {
          id: ctx.user.id,
          name: ctx.member.displayName,
          avatar: ctx.user.displayAvatarURL({ extension: "png", size: 512 }),
        },
        {
          id: targetMember.id,
          name: targetMember.displayName,
          avatar: targetMember.user.displayAvatarURL({ extension: "png", size: 512 }),
        }
      );

      marriageManager.removeProposal(ctx.user.id, targetMember.id);

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor("#57CC99")
            .setTitle("💒 Marriage Registered")
            .setDescription(
              [
                `${ctx.user} ❤️ ${targetMember}`,
                "",
                `📅 **Married**`,
                `<t:${Math.floor(Date.now() / 1000)}:F>`,
                "",
                `💖 **Together**`,
                `<t:${Math.floor(Date.now() / 1000)}:R>`,
              ].join("\n"),
            )
            .setThumbnail(targetMember.user.displayAvatarURL())
            .setFooter({
              text: "Use /marriage partner to view your marriage certificate.",
            }),
        ],
        components: [],
      });
    }

    marriageManager.removeProposal(ctx.user.id, targetMember.id);

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor("#EF476F")
          .setTitle("💔 Proposal Declined")
          .setDescription(`${targetMember} declined ${ctx.user}'s proposal.`),
      ],
      components: [],
    });
  });

  collector.on("end", async (_, reason) => {
    if (reason !== "time") return;

    marriageManager.removeProposal(ctx.user.id, targetMember.id);

    await safeEdit(proposalMsg, {
      embeds: [
        new EmbedBuilder()
          .setColor("#A0A0A0")
          .setTitle("⌛ Proposal Expired")
          .setDescription("No response was received.\n\nThe proposal has expired."),
      ],
      components: [],
    });
  });
}

async function handlePartner(source) {
  const ctx = createContext(source);
  const remaining = checkCooldown(ctx.user.id, "partner", 10);

  if (remaining) {
    return sendTemp(ctx, `⏳ Please wait **${remaining}s** A certificate was recently printed.`);
  }

  await ctx.ack(false);

  const member = await resolveMember(source, ctx);
  if (!member) return ctx.sendMain("Couldn't find that member.");

  try {
    const marriage = marriageManager.getMarriage(member.id);

    if (!marriage) {
      return ctx.sendMain(
        member.id === ctx.user.id
          ? "💔 You aren't married."
          : `${member.displayName} isn't married.`
      );
    }

    marriageManager.updateMarriageUser(member.id, {
      name: member.displayName,
      avatar: member.user.displayAvatarURL({ extension: "png", size: 512 }),
    });

    const partnerData = marriage.users.find((u) => u.id !== member.id);
    const partner = await ctx.guild.members.fetch(partnerData.id).catch(() => null);

    if (partner) {
      marriageManager.updateMarriageUser(partner.id, {
        name: partner.displayName,
        avatar: partner.user.displayAvatarURL({ extension: "png", size: 512 }),
      });
    }

    const leftData = marriage.users.find((u) => u.id === member.id);
    const rightData = marriage.users.find((u) => u.id !== member.id);
    const marriedDate = new Date(marriage.marriedAt * 1000);

    const dateString = marriedDate.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const years = Math.floor(
      (Date.now() - marriage.marriedAt * 1000) / 31536000000
    );

    const embed = new EmbedBuilder()
      .setColor("#ff7eb6")
      .setTitle(years >= 1 ? "🥂 Anniversary Couple" : "💕 Partner")
      .setThumbnail(leftData.avatar)
      .setImage(rightData.avatar)
      .setDescription(`## <@${leftData.id}> ❤ <@${rightData.id}>`)
      .addFields(
        { name: "📅 Married Since", value: `**${dateString}**`, inline: true },
        { name: "⏳ Together For", value: `**${getDuration(marriage.marriedAt)}**`, inline: true }
      );

    if (years >= 1) {
      embed.addFields({
        name: "🎉 Anniversary",
        value: `**${years} year${years === 1 ? "" : "s"}!**`,
        inline: true,
      });
    }

    embed.setFooter({ text: "A bond recognized by Nyako." });

    return ctx.sendMain({ embeds: [embed], allowedMentions: { users: [leftData.id, rightData.id] } });
  } catch (err) {
    console.error("partner command error:", err);
    return ctx.sendMain({
      content: `❌ Something went wrong: \`${err.message}\``,
      allowedMentions: { parse: [] },
    });
  }
}

async function handleDivorce(source) {
  const ctx = createContext(source);
  await ctx.ack();

  const remaining = checkCooldown(ctx.user.id, "divorce", 60);
  if (remaining) {
    return sendTemp(ctx, `⏳ Please wait **${remaining}s** the paperwork is still drying.`);
  }

  const marriage = marriageManager.getMarriage(ctx.user.id);
  if (!marriage) return ctx.sendMain("💔 You are not married.");

  const partner = marriage.users.find((u) => u.id !== ctx.user.id);
  if (!partner) return ctx.sendMain("💔 I could not find your partner.");

  if (
    marriageManager.hasActiveDivorce(ctx.user.id) ||
    marriageManager.hasActiveDivorce(partner.id)
  ) {
    return ctx.sendMain("A divorce request is already pending.");
  }

  marriageManager.createDivorce(ctx.user.id, partner.id);

  const partnerMember = await ctx.guild.members.fetch(partner.id).catch(() => null);
  if (!partnerMember) {
    marriageManager.removeDivorce(ctx.user.id, partner.id);
    return ctx.sendMain("Your partner is no longer in this server.");
  }

  const requestEnds = Math.floor(Date.now() / 1000) + 60;

  const loadingMsg = await ctx.sendMain({
    embeds: [
      new EmbedBuilder()
        .setColor("#F4A261")
        .setTitle("⚖️ Family Court")
        .setDescription(buildChecklist(DIVORCE_STEPS, 0)),
    ],
  });

  if (!(await playChecklist(loadingMsg, DIVORCE_STEPS, "#F4A261", "⚖️ Family Court"))) return;

  const uniqueId = Date.now().toString();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`divorce_accept_${uniqueId}`)
      .setLabel("Finalize Divorce")
      .setEmoji("💔")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`divorce_decline_${uniqueId}`)
      .setLabel("Stay Together")
      .setEmoji("❤️")
      .setStyle(ButtonStyle.Secondary)
  );

  await safeEdit(loadingMsg, {
    content: `<@${partner.id}>`,
    embeds: [
      new EmbedBuilder()
        .setColor("#E76F51")
        .setTitle("💔 Divorce Request")
        .setAuthor({
          name: `${ctx.member.displayName}'s Request`,
          iconURL: ctx.user.displayAvatarURL(),
        })
        .setDescription(
          [
            `${ctx.user} wishes to end their marriage with ${partnerMember}.`,
            "",
            "**Do you agree to the divorce?**",
            "",
            `⏳ Expires <t:${requestEnds}:R>`,
          ].join("\n")
        ),
    ],
    components: [row],
    allowedMentions: { users: [partner.id] },
  });

  const collector = loadingMsg.createMessageComponentCollector({
    time: 60000,
    filter: (i) =>
      i.user.id === partner.id &&
      (i.customId === `divorce_accept_${uniqueId}` ||
        i.customId === `divorce_decline_${uniqueId}`),
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === `divorce_accept_${uniqueId}`) {
      marriageManager.divorce(ctx.user.id);
      marriageManager.removeDivorce(ctx.user.id, partner.id);
      collector.stop("accepted");

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor("#D62828")
            .setTitle("💔 Divorce Finalized")
            .setDescription(
              [
                `${ctx.user} and ${partnerMember} have officially divorced.`,
                "",
                "Both parties have signed the papers.",
              ].join("\n")
            ),
        ],
        components: [],
      });
    }

    marriageManager.removeDivorce(ctx.user.id, partner.id);
    collector.stop("declined");

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor("#57CC99")
          .setTitle("❤️ Marriage Preserved")
          .setDescription(
            [
              `${partnerMember} declined the divorce request.`,
              "",
              "The marriage remains intact.",
            ].join("\n")
          ),
      ],
      components: [],
    });
  });

  collector.on("end", async (_, reason) => {
    if (reason !== "time") return;

    marriageManager.removeDivorce(ctx.user.id, partner.id);

    await safeEdit(loadingMsg, {
      embeds: [
        new EmbedBuilder()
          .setColor("#9E9E9E")
          .setTitle("⌛ Divorce Request Expired")
          .setDescription(["No response was received.", "", "The request has expired."].join("\n")),
      ],
      components: [],
    });
  });
}

async function handleMarriages(source) {
  const ctx = createContext(source);
  await ctx.ack(false);

  const remaining = checkCooldown(ctx.user.id, "marriages", 10);
  if (remaining) {
    return sendTemp(ctx, `⏳ Please wait **${remaining}s** the hall is being dusted.`);
  }

  const marriages = [...marriageManager.getAllMarriages()];

  if (!marriages.length) return ctx.sendMain("💔 Nobody is married yet.");

  marriages.sort((a, b) => a.marriedAt - b.marriedAt);

  const top = marriages.slice(0, 10);

  const lines = top.map((marriage, index) => {
    const user1 = marriage.users[0];
    const user2 = marriage.users[1];

    const rank = ["🥇", "🥈", "🥉"][index] || `${index + 1}.`;

    return (
      `${rank} <@${user1.id}> ❤ <@${user2.id}>\n` +
      `> Since <t:${marriage.marriedAt}:D> · Together <t:${marriage.marriedAt}:R>`
    );
  });

  const shown = Math.min(10, marriageManager.getMarriageCount());

  const embed = new EmbedBuilder()
    .setColor("#FF69B4")
    .setTitle("💍 Marriage Hall of Fame")
    .setDescription(lines.join("\n\n"))
    .addFields(
      { name: "💞 Total Marriages", value: `\`${marriageManager.getMarriageCount()}\``, inline: true },
      { name: "🏆 Showing", value: `Top ${shown}`, inline: true }
    )
    .setFooter({ text: "The couples who lasted the longest" })
    .setTimestamp();

  return ctx.sendMain({
    embeds: [embed],
    allowedMentions: {
      users: top.flatMap((m) => m.users.map((u) => u.id)),
    },
  });
}

module.exports = {
  name: "marriage",

  aliases: ["marry", "partner", "divorce", "marriages"],

  data: new SlashCommandBuilder()
    .setName("marriage")
    .setDescription("Marriage commands")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("What to do")
        .setRequired(true)
        .addChoices(
          { name: "Marry", value: "marry" },
          { name: "Partner", value: "partner" },
          { name: "Divorce", value: "divorce" },
          { name: "Marriages", value: "marriages" }
        )
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Which user (for marry / partner)")
        .setRequired(false)
    ),

  async execute(message, args = [], client, invokedName) {
    const cmd = (invokedName || args[0] || "").toLowerCase();

    if (cmd === "marry") return handleMarry(message);
    if (cmd === "partner") return handlePartner(message);
    if (cmd === "divorce") return handleDivorce(message);
    if (cmd === "marriages") return handleMarriages(message);

    return message.reply("Use `prefix!marry`, `prefix!partner`, `prefix!divorce`, or `prefix!marriages`.");
  },

  async executeInteraction(interaction) {
    const action = interaction.options.getString("action", true);

    if (action === "marry") return handleMarry(interaction);
    if (action === "partner") return handlePartner(interaction);
    if (action === "divorce") return handleDivorce(interaction);
    if (action === "marriages") return handleMarriages(interaction);
  },
};