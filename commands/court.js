const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");
const { safeEdit } = require("../utils/safeEdit");

const activeCourts = new Map();

const MAX_TRIALS = 5; // trials 1-4 are normal, trial 5 is sudden death

function randomRoll() {
  return Math.floor(Math.random() * 36) + 15;
}

function lastTwo(arr) {
  return arr.slice(-2).join("\n") || "No actions yet.";
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomLine(lines, ...args) {
  const fn = lines[Math.floor(Math.random() * lines.length)];
  return fn(...args);
}

const ACCUSE_LINES = [
  (a, roll) => `📢 ${a} slams a folder of evidence on the table (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} points dramatically at the defendant (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} produces a surprise witness (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} reads a damning testimony aloud (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} presents photographic evidence (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} cross-examines with brutal precision (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} delivers a fiery closing statement (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} waves a signed confession in the air (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} plays a suspicious voicemail recording (+${roll} Case Strength)`,
  (a, roll) => `📢 ${a} unveils a timeline that doesn't add up (+${roll} Case Strength)`,
];

const DEFEND_LINES = [
  (d, roll) => `🛡️ ${d} calmly refutes the claim (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} produces an airtight alibi (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} objects and the point is sustained (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} discredits the accuser's witness (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} pokes holes in the timeline (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} pleads their case passionately (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} presents a rock-solid counter-argument (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} turns the jury's sympathy around (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} shows the evidence was tampered with (+${roll} Case Strength)`,
  (d, roll) => `🛡️ ${d} brings in a character witness (+${roll} Case Strength)`,
];

const GUILTY_INTROS = [
  "The gavel falls. The evidence was simply too damning to ignore.",
  "The jury deliberated for less than a minute. The verdict was never in doubt.",
  "Justice has spoken, and it is not merciful today.",
  "The courtroom falls silent as the verdict is read aloud.",
  "The scales of justice tip decisively — and not in the defendant's favor.",
];

const NOT_GUILTY_INTROS = [
  "The gavel falls. Reasonable doubt carries the day.",
  "The defense's arguments proved too compelling to overcome.",
  "The courtroom erupts in murmurs as the verdict is read aloud.",
  "Justice has spoken, and mercy prevails today.",
  "The scales of justice tip decisively — in the defendant's favor.",
];

const SUDDEN_DEATH_INTROS = [
  "Four trials. No clear winner. The court has one final chance to settle this.",
  "The jury is deadlocked. A single argument will decide everything.",
  "The gavel slams down. One last round. One final truth.",
  "Four hearings and still no resolution. The court calls for a sudden death round.",
  "The courtroom holds its breath. One argument each — and this ends today.",
];

const PUNISHMENT_LINES = [
  (loser, winner) =>
    `${loser} is sentenced to change their nickname to "${winner.displayName}'s Servant" for 24 hours.`,
  (loser, winner) =>
    `${loser} owes ${winner} one (1) heartfelt public apology, to be delivered within the hour.`,
  (loser, winner) =>
    `${loser} is sentenced to 50 pushups, enforced entirely on the honor system of the court.`,
  (loser, winner) =>
    `${loser} must communicate only in formal legalese for the next hour, so the court decrees.`,
  (loser, winner) =>
    `${loser} is banned from using the 💀 emoji for one week, by order of the court.`,
  (loser, winner) =>
    `${loser} must let ${winner} choose their next profile picture.`,
  (loser, winner) =>
    `${loser} is sentenced to community service: react with 👍 to ${winner}'s next five messages.`,
  (loser, winner) =>
    `${loser} must send a groveling apology GIF to the court within the hour.`,
  (loser, winner) =>
    `${loser} is fined one (1) sincere compliment, payable immediately to ${winner}.`,
  (loser, winner) =>
    `${loser} must refer to ${winner} as "Your Honor" for the remainder of the day.`,
];

const WITHDRAWAL_INTROS = [
  "A hush falls over the courtroom as the case is dropped without warning.",
  "The gavel never falls today — the case dissolves before a verdict can be reached.",
  "The bailiff clears the room. There will be no verdict, only silence.",
  "The court records the case as closed, the truth left forever undecided.",
  "The docket is struck. History will never know who was right.",
];

const WITHDRAWAL_LINES = [
  (w) => `${w} loses their nerve at the final hour and calls it off.`,
  (w) => `${w} decides the fight isn't worth it and drops the case.`,
  (w) => `${w} throws in the towel before the gavel can fall.`,
  (w) => `${w} quietly requests that all charges be dropped.`,
  (w) => `${w} concedes there's nothing left worth arguing.`,
  (w) => `${w} storms out, unwilling to see this through to the end.`,
  (w) => `${w} settles out of court, terms undisclosed.`,
];

function verdictFilename(guilty) {
  return guilty ? "guilty.png" : "notguilty.png";
}

function makeVerdictAttachment(guilty) {
  const filename = verdictFilename(guilty);
  const file = path.join(__dirname, "..", "assets", filename);
  return new AttachmentBuilder(file, { name: filename });
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
        if (!source.deferred && !source.replied) await source.deferReply();
      },
      async sendMain(payload) {
        if (source.deferred || source.replied) return source.editReply(payload);
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

module.exports = {
  name: "court",
  aliases: ["wearehavingaretrial", "retrial"],

  data: new SlashCommandBuilder()
    .setName("court")
    .setDescription("Put someone on trial")
    .addUserOption((option) =>
      option.setName("defendant").setDescription("Who to put on trial").setRequired(true)
    ),

  async execute(message) {
    const ctx = createContext(message);
    return runCourt(ctx, message.mentions.members.first());
  },

  async executeInteraction(interaction) {
    const ctx = createContext(interaction);
    const defendantUser = interaction.options.getUser("defendant", true);
    const defendantMember =
      interaction.options.getMember("defendant") ||
      (await interaction.guild.members.fetch(defendantUser.id).catch(() => null));
    return runCourt(ctx, defendantMember);
  },
};

async function runCourt(ctx, defendant) {
  await ctx.ack();

  if (!defendant) return ctx.sendMain("⚖️ Mention somebody to put on trial.");
  if (defendant.user.bot) return ctx.sendMain("⚖️ Bots cannot stand trial.");
  if (defendant.id === ctx.user.id) return ctx.sendMain("⚖️ You cannot accuse yourself.");
  if (activeCourts.has(ctx.channel.id)) return ctx.sendMain("⚖️ A court session is already active in this channel.");

  const accuser = ctx.member;

  // Persists across all trials in the session.
  const caseHistory = [];
  let trialNumber = 0; // incremented at the start of each trial

  const court = {
    accuser,
    defendant,
    accuserReady: false,
    defendantReady: false,
    accuserScore: 0,
    defendantScore: 0,
    accuserRolls: 10,
    defendantRolls: 10,
    history: [],
    phase: "ready",
    ended: false,
    withdrawAllowedId: accuser.id,
  };

  activeCourts.set(ctx.channel.id, court);

  // ─── EMBED BUILDER ───────────────────────────────────────────────────────────

  const buildEmbed = ({ showCourtRecord = true } = {}) => {
    const isSuddenDeath = trialNumber === MAX_TRIALS;

    const phaseTitle =
      court.phase === "ready"
        ? isSuddenDeath
          ? "⚡ Sudden Death Round"
          : `⚖️ Court Convenes — Trial ${trialNumber || 1}`
        : court.phase === "trial"
          ? isSuddenDeath
            ? "⚡ Sudden Death — Final Argument"
            : "⚖️ The Trial Is Underway"
          : "⚖️ Court Adjourned";

    const phaseDescription =
      court.phase === "ready"
        ? isSuddenDeath
          ? "Both parties return for one final hearing. **Each side gets one argument only.** The verdict is final — no further appeals."
          : "Both parties are summoned. The court cannot proceed until each has entered the room."
        : court.phase === "trial"
          ? isSuddenDeath
            ? "One argument per side. The highest Case Strength wins — and that's the end of it."
            : "Arguments are being heard. The court will render its verdict once both sides have spoken."
          : "The court has reached its verdict.";

    const trialLabel = isSuddenDeath
      ? `⚡ Sudden Death — Trial ${trialNumber}`
      : trialNumber > 0
        ? `Trial ${trialNumber}`
        : "";

    return new EmbedBuilder()
      .setColor(isSuddenDeath ? "#ff4444" : "#d4af37")
      .setTitle(phaseTitle)
      .setDescription(phaseDescription)
      .addFields(
        {
          name: "📢 The Accuser",
          value: `${accuser}\nCase Strength: **${court.accuserScore}**\nArguments Remaining: **${court.accuserRolls}**`,
          inline: true,
        },
        {
          name: "🛡️ The Defendant",
          value: `${defendant}\nCase Strength: **${court.defendantScore}**\nArguments Remaining: **${court.defendantRolls}**`,
          inline: true,
        },
        { name: "\u200b", value: "\u200b", inline: false },
        ...(caseHistory.length > 0
          ? [{ name: "📜 Trial History", value: caseHistory.join("\n") }]
          : []),
        ...(showCourtRecord
          ? [{ name: "📜 Court Record", value: lastTwo(court.history) }]
          : [])
      )
      .setThumbnail(defendant.displayAvatarURL())
      .setFooter({
        text:
          court.phase === "ready"
            ? isSuddenDeath
              ? "One argument each — this is it"
              : "The bailiff awaits both parties"
            : court.phase === "trial"
              ? isSuddenDeath
                ? "⚡ Sudden Death — 1 argument per side • 120 seconds"
                : `10 arguments per side • 120 seconds${trialLabel ? ` • ${trialLabel}` : ""}`
              : "The gavel has struck",
      });
  };

  // ─── ROW BUILDERS ────────────────────────────────────────────────────────────

  const buildReadyRow = () =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accuser_ready")
        .setLabel(court.accuserReady ? "⚖️ Accuser is Here" : "⚖️ Is Accuser Present?")
        .setStyle(court.accuserReady ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("defendant_ready")
        .setLabel(court.defendantReady ? "⚖️ Defendant is Here" : "⚖️ Is Defendant Present?")
        .setStyle(court.defendantReady ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

  const buildTrialRow = (isSuddenDeath = false) => {
    const buttons = [
      new ButtonBuilder().setCustomId("accuse").setLabel("⚔️ Accuse").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("defend").setLabel("🛡️ Defend").setStyle(ButtonStyle.Primary),
    ];
    // No withdraw option in sudden death — the case must be decided.
    if (!isSuddenDeath) {
      buttons.push(
        new ButtonBuilder().setCustomId("withdraw").setLabel("🏳 Withdraw Case").setStyle(ButtonStyle.Secondary)
      );
    }
    return new ActionRowBuilder().addComponents(...buttons);
  };

  // ─── SEND INITIAL MESSAGE ────────────────────────────────────────────────────

  const courtMessage = await ctx.sendMain({
    embeds: [buildEmbed({ showCourtRecord: false })],
    components: [buildReadyRow()],
  });

  // ─── VERDICT HELPER ──────────────────────────────────────────────────────────

  // Determines and posts the final verdict for a completed trial.
  // isFinalVerdict = true means no more retrials are ever offered.
  const postVerdict = async (accuserFinal, defendantFinal, isFinalVerdict) => {
    let winner, loser, guilty;

    // Tiebreak for non-sudden-death trials only (sudden death
    // already has just 1 roll each so ties are extremely rare,
    // but handle it cleanly anyway).
    while (accuserFinal === defendantFinal) {
      const a = randomRoll();
      const d = randomRoll();
      accuserFinal += a;
      defendantFinal += d;
      court.history.push(
        `⚡ Tiebreak → ${accuser.displayName} +${a} | ${defendant.displayName} +${d}`
      );
    }

    if (accuserFinal > defendantFinal) {
      winner = accuser;
      loser = defendant;
      guilty = true;
    } else {
      winner = defendant;
      loser = accuser;
      guilty = false;
    }

    court.phase = "ended";
    court.accuserScore = accuserFinal;
    court.defendantScore = defendantFinal;

    const margin = Math.abs(accuserFinal - defendantFinal);
    caseHistory.push(
      `Trial ${trialNumber}: ${guilty ? "⚖️ GUILTY" : "✅ NOT GUILTY"} — ${winner} beat ${loser} by **${margin}** (${accuserFinal}–${defendantFinal})`
    );

    const filename = verdictFilename(guilty);
    const verdictImage = makeVerdictAttachment(guilty);
    const introLine = randomPick(guilty ? GUILTY_INTROS : NOT_GUILTY_INTROS);

    // On the final verdict (trial 5 or unanimous) show no further options
    // for not-guilty (nothing to do). For guilty on the final verdict,
    // skip the choice and apply punishment immediately.
    if (isFinalVerdict && guilty) {
      const punishment = randomLine(PUNISHMENT_LINES, loser, winner);
      const sentenceImage = makeVerdictAttachment(guilty);

      await safeEdit(
        courtMessage,
        {
          embeds: [
            buildEmbed({ showCourtRecord: false })
              .setColor("Red")
              .setTitle("⚖️ GUILTY — SENTENCE IMPOSED")
              .setDescription(
                `${introLine}\n\nThe court has spoken for the last time. No appeal remains.`
              )
              .addFields({ name: "🔨 Sentence", value: punishment })
              .setImage(`attachment://${filename}`)
              .setFooter({ text: "Case permanently closed." }),
          ],
          files: [sentenceImage],
          components: [],
        },
        () => activeCourts.delete(ctx.channel.id)
      );

      court.ended = true;
      activeCourts.delete(ctx.channel.id);
      return;
    }

    if (isFinalVerdict && !guilty) {
      await safeEdit(
        courtMessage,
        {
          embeds: [
            buildEmbed({ showCourtRecord: false })
              .setColor("Green")
              .setTitle("⚖️ THE VERDICT: NOT GUILTY")
              .setDescription(
                `${introLine}\n\nThe court has spoken for the last time. No appeal remains.`
              )
              .setImage(`attachment://${filename}`)
              .setFooter({ text: "Case permanently closed." }),
          ],
          files: [verdictImage],
          components: [],
        },
        () => activeCourts.delete(ctx.channel.id)
      );

      court.ended = true;
      activeCourts.delete(ctx.channel.id);
      return;
    }

    // Normal verdict (trials 1–4): loser may demand a retrial or accept fate.
    const verdictButtons = [
      new ButtonBuilder()
        .setCustomId("retrial")
        .setLabel(`⚖️ Demand a Retrial`)
        .setStyle(ButtonStyle.Danger),
    ];

    if (guilty) {
      verdictButtons.push(
        new ButtonBuilder()
          .setCustomId("punishment")
          .setLabel("🔨 Accept Punishment")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    const trialsLeft = (MAX_TRIALS - 1) - trialNumber;
    const footerNote =
      trialsLeft === 1
        ? "The next retrial will be the last."
        : trialsLeft === 0
          ? "No further retrials will be granted."
          : "The losing party may demand a retrial.";

    await safeEdit(
      courtMessage,
      {
        embeds: [
          buildEmbed({ showCourtRecord: false })
            .setColor(guilty ? "Red" : "Green")
            .setTitle(guilty ? "⚖️ THE VERDICT: GUILTY" : "⚖️ THE VERDICT: NOT GUILTY")
            .setDescription(introLine)
            .setImage(`attachment://${filename}`)
            .setFooter({ text: footerNote }),
        ],
        files: [verdictImage],
        components: [new ActionRowBuilder().addComponents(...verdictButtons)],
      },
      () => activeCourts.delete(ctx.channel.id)
    );

    const verdictCollector = courtMessage.createMessageComponentCollector({
      time: 60000,
      filter: (i) => i.customId === "retrial" || i.customId === "punishment",
    });

    verdictCollector.on("collect", async (interaction) => {
      try {
      if (interaction.user.id !== loser.id) {
        return interaction.reply({ content: "Only the losing party may make this choice.", flags: MessageFlags.Ephemeral });
      }

      // ---- ACCEPT PUNISHMENT ----
      if (interaction.customId === "punishment") {
        court.ended = true;
        court.phase = "ended";
        court.history.push(`🔨 ${defendant} accepted the court's sentence without further contest.`);

        const punishment = randomLine(PUNISHMENT_LINES, loser, winner);
        const sentenceImage = makeVerdictAttachment(guilty);

        await interaction.update({
          embeds: [
            buildEmbed({ showCourtRecord: false })
              .setColor("Red")
              .setTitle("🔨 Sentence Carried Out")
              .setDescription(
                `${defendant} has been found **GUILTY** as charged and accepts the court's sentence without further contest.`
              )
              .addFields({ name: "⚖️ Sentence", value: punishment })
              .setImage(`attachment://${filename}`)
              .setFooter({ text: "Case closed." }),
          ],
          files: [sentenceImage],
          components: [],
        });

        verdictCollector.stop("punished");
        activeCourts.delete(ctx.channel.id);
        return;
      }

      // ---- DEMAND A RETRIAL ----
      court.phase = "ready";
      court.ended = false;
      court.withdrawAllowedId = interaction.user.id;
      court.accuserReady = false;
      court.defendantReady = false;
      court.accuserScore = 0;
      court.defendantScore = 0;
      court.accuserRolls = trialNumber < MAX_TRIALS - 1 ? 10 : 1;
      court.defendantRolls = trialNumber < MAX_TRIALS - 1 ? 10 : 1;
      court.history = [
        trialNumber + 1 === MAX_TRIALS
          ? `⚡ ${loser} has demanded a sudden death retrial.`
          : `⚖️ ${loser} has demanded a retrial.`,
      ];

      trialNumber++; // advance before building the next embed

      await interaction.update({
        embeds: [buildEmbed({ showCourtRecord: false })],
        components: [buildReadyRow()],
        files: [],
      });

      verdictCollector.stop("retrial");
      activeCourts.set(ctx.channel.id, court);
      startReadyPhase();
      } catch (err) {
        console.error("court verdict error:", err);
        activeCourts.delete(ctx.channel.id);
      }
    });

    verdictCollector.on("end", async (_, reason) => {
      if (reason === "retrial" || reason === "punished") return;
      // Timed out — strip buttons.
      court.ended = true;
      activeCourts.delete(ctx.channel.id);
      await safeEdit(courtMessage, { components: [] }, () => {});
    });
  };

  // ─── READY PHASE ─────────────────────────────────────────────────────────────

  const startReadyPhase = () => {
    const readyCollector = courtMessage.createMessageComponentCollector({
      time: 120000,
      filter: (i) => i.customId === "accuser_ready" || i.customId === "defendant_ready",
    });

    readyCollector.on("collect", async (interaction) => {
      try {
      if (court.ended) {
        return interaction.reply({ content: "⚖️ This court session has ended.", flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === "accuser_ready") {
        if (interaction.user.id !== accuser.id) {
          return interaction.reply({ content: "Only the accuser can use this.", flags: MessageFlags.Ephemeral });
        }
        court.accuserReady = true;
      }

      if (interaction.customId === "defendant_ready") {
        if (interaction.user.id !== defendant.id) {
          return interaction.reply({ content: "Only the defendant can use this.", flags: MessageFlags.Ephemeral });
        }
        court.defendantReady = true;
      }

      if (court.accuserReady && court.defendantReady) {
        court.phase = "trial";
        court.history.push("⚖️ Both parties have entered the courtroom.");
        readyCollector.stop("advanced");

        const isSuddenDeath = trialNumber === MAX_TRIALS;

        await interaction.update({
          embeds: [buildEmbed()],
          components: [buildTrialRow(isSuddenDeath)],
        });

        startTrialPhase();
        return;
      }

      await interaction.update({
        embeds: [buildEmbed({ showCourtRecord: false })],
        components: [buildReadyRow()],
      });
      } catch (err) {
        console.error("court ready error:", err);
        activeCourts.delete(ctx.channel.id);
      }
    });

    readyCollector.on("end", (_, reason) => {
      if (reason === "advanced") return;
      if (court.phase === "ready") activeCourts.delete(ctx.channel.id);
    });
  };

  // ─── TRIAL PHASE ─────────────────────────────────────────────────────────────

  const startTrialPhase = () => {
    const isSuddenDeath = trialNumber === MAX_TRIALS;

    const trialCollector = courtMessage.createMessageComponentCollector({
      time: 120000,
      filter: (i) => i.customId === "accuse" || i.customId === "defend" || i.customId === "withdraw",
    });

    trialCollector.on("collect", async (interaction) => {
      try {
      if (court.ended) {
        return interaction.reply({ content: "⚖️ This court session has ended.", flags: MessageFlags.Ephemeral });
      }

      // ---- ACCUSE ----
      if (interaction.customId === "accuse") {
        if (interaction.user.id !== accuser.id) {
          return interaction.reply({ content: "Only the accuser may present evidence.", flags: MessageFlags.Ephemeral });
        }
        if (court.accuserRolls <= 0) {
          return interaction.reply({ content: "No accusations remaining.", flags: MessageFlags.Ephemeral });
        }

        const roll = randomRoll();
        court.accuserScore += roll;
        court.accuserRolls--;
        court.history.push(randomLine(ACCUSE_LINES, accuser, roll));

        await interaction.deferUpdate();
        await safeEdit(courtMessage, { embeds: [buildEmbed()] }, () => activeCourts.delete(ctx.channel.id));

        if (court.accuserRolls <= 0 && court.defendantRolls <= 0) trialCollector.stop("finished");
        return;
      }

      // ---- DEFEND ----
      if (interaction.customId === "defend") {
        if (interaction.user.id !== defendant.id) {
          return interaction.reply({ content: "Only the defendant may defend themselves.", flags: MessageFlags.Ephemeral });
        }
        if (court.defendantRolls <= 0) {
          return interaction.reply({ content: "No defenses remaining.", flags: MessageFlags.Ephemeral });
        }

        const roll = randomRoll();
        court.defendantScore += roll;
        court.defendantRolls--;
        court.history.push(randomLine(DEFEND_LINES, defendant, roll));

        await interaction.deferUpdate();
        await safeEdit(courtMessage, { embeds: [buildEmbed()] }, () => activeCourts.delete(ctx.channel.id));

        if (court.accuserRolls <= 0 && court.defendantRolls <= 0) trialCollector.stop("finished");
        return;
      }

      // ---- WITHDRAW (not available in sudden death) ----
      if (interaction.customId === "withdraw") {
        if (interaction.user.id !== court.withdrawAllowedId) {
          return interaction.reply({
            content: "Only the party who brought this case to trial may withdraw it.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const withdrawer = interaction.user.id === accuser.id ? accuser : defendant;
        court.ended = true;
        court.phase = "ended";
        court.history.push(`🏳 ${withdrawer} withdrew the case.`);

        const reasonLine = randomLine(WITHDRAWAL_LINES, withdrawer);
        const introLine = randomPick(WITHDRAWAL_INTROS);

        caseHistory.push(
          `Trial ${trialNumber}: 🏳️ ${withdrawer} withdrew before a verdict (${court.accuserScore}–${court.defendantScore})`
        );

        await interaction.update({
          embeds: [
            buildEmbed({ showCourtRecord: false })
              .setColor("Grey")
              .setTitle("🏳️ Case Withdrawn")
              .setDescription(introLine)
              .addFields({ name: "📜 Reason for Withdrawal", value: reasonLine })
              .setThumbnail(withdrawer.displayAvatarURL())
              .setFooter({ text: "Case closed — no verdict was reached." }),
          ],
          components: [],
        });

        trialCollector.stop("withdrawn");
      }
      } catch (err) {
        console.error("court trial error:", err);
        activeCourts.delete(ctx.channel.id);
      }
    });

    trialCollector.on("end", async (_, reason) => {
      activeCourts.delete(ctx.channel.id);
      if (reason === "withdrawn") return;

      // isFinalVerdict = trial 5 (sudden death), or if time ran out with no winner
      await postVerdict(court.accuserScore, court.defendantScore, isSuddenDeath);
    });
  };

  // ─── KICK OFF ────────────────────────────────────────────────────────────────

  trialNumber = 1;
  court.accuserRolls = 10;
  court.defendantRolls = 10;

  startReadyPhase();
}
