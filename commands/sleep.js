const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { animateEmbed } = require("../utils/animateEmbed");
const { checkCooldown } = require("../utils/cooldowns");
const { sendTemp } = require("../utils/sendTemp");

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createContext(source) {
  const isInteraction = !!source.commandName;

  if (isInteraction) {
    return {
      isInteraction: true,
      user: source.user,
      member: source.member,
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
    channel: source.channel,
    async ack() {},
    async sendMain(payload) {
      return source.reply(payload);
    },
  };
}

module.exports = {
  name: "sleep",

  data: new SlashCommandBuilder()
    .setName("sleep")
    .setDescription("Check whether you or another user should sleep")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("User to check")
        .setRequired(false)
    ),

  async execute(message) {
    const targetMember = message.mentions.members.first() || message.member;
    return runSleep(message, targetMember);
  },

  async executeInteraction(interaction) {
    const user = interaction.options.getUser("target");
    const targetMember =
      user
        ? interaction.options.getMember("target") ||
          (await interaction.guild.members.fetch(user.id).catch(() => null))
        : interaction.member;

    return runSleep(interaction, targetMember);
  },
};

async function runSleep(source, targetMember) {
  const ctx = createContext(source);
  await ctx.ack();

  if (!ctx.member) {
    return ctx.sendMain({ content: "This command only works in a server." });
  }

  const remaining = checkCooldown(ctx.user.id, "sleep", 10);
  if (remaining) {
    return sendTemp(
      ctx,
      `⏳ Please wait **${remaining}s** The advisor is resting.`
    );
  }

  const target = targetMember || ctx.member;
  const isMentioned = target.id !== ctx.member.id;

  const roll = Math.random();
  let outcomeType;
  if (roll < 0.05) outcomeType = "allnighter";
  else if (roll < 0.55) outcomeType = "sleep";
  else if (roll < 0.85) outcomeType = "inbetween";
  else outcomeType = "awake";

  const sleepAdvice = [
    "should sleep.",
    "for you sleep is recommended.",
    ", rest would be beneficial.",
    "You are due for sleep.",
    "Go sleep RIGHT NOW!!",
  ];

  const awakeAdvice = [
    "should stay awake and continue normally.",
    "is in a good state to remain active.",
    "does not need sleep right now.",
    "is best kept awake for now.",
    "should avoid sleeping at the moment.",
    "has sufficient energy to stay awake.",
    "is recommended to stay active.",
    "sleep is unnecessary right now.",
  ];

  const inbetweenAdvice = [
    "Stay awake for a few minutes, then reconsider.",
    "Hold off sleep for a short while (2–5 minutes).",
    "You’re in a transition phase — wait a bit before sleeping.",
    "Not ready for sleep yet — try again in a few minutes.",
    "Delay sleep decision by a few minutes.",
  ];

  const allNighterAdvice = [
    "Sleep is not happening tonight.",
    "You are in all-nighter mode.",
    "No sleep recommended at all.",
    "You will remain awake.",
  ];

  const getOutcomeText = () => {
    if (outcomeType === "allnighter") return `${target.toString()} ${pick(allNighterAdvice)}`;
    if (outcomeType === "sleep") return `${target.toString()} ${pick(sleepAdvice)}`;
    if (outcomeType === "inbetween") return `${target.toString()} ${pick(inbetweenAdvice)}`;
    return `${target.toString()} ${pick(awakeAdvice)}`;
  };

  const getOutcomeColor = () => {
    if (outcomeType === "allnighter") return "Purple";
    if (outcomeType === "sleep") return "Green";
    if (outcomeType === "inbetween") return "Yellow";
    return "Orange";
  };

  const build = (title, desc, color) =>
    new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc);

  const stages = [
    build(
      "💭 Evaluating sleep recommendation...",
      isMentioned
        ? `Checking recommendation for ${target.toString()}`
        : "Checking recommendation for YOU",
      "Blue"
    ),
    build(
      "⚖️ Processing sleep factors...",
      "Analyzing rest vs activity balance...",
      "Blurple"
    ),
    build(
      "📊 Computing result...",
      "Final recommendation incoming...",
      "DarkBlue"
    ),
    build(
      "🌙 Sleep Recommendation",
      getOutcomeText(),
      getOutcomeColor()
    ),
  ];

  return animateEmbed({
    message: {
      channel: ctx.channel,
      id: source.id ?? `sleep-${Date.now()}`,
    },
    stages,
    interval: 1200,
  });
}