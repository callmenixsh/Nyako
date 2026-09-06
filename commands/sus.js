const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { animateEmbed, animateEmbedInteraction } = require("../utils/animateEmbed");
const { checkCooldown } = require("../utils/cooldowns");
const { replyTemp } = require("../utils/sendTemp");

const susReasons = [
    "acting suspicious.",
    "definitely up to something.",
    "giving major sus energy.",
    "hiding something for sure.",
];

const build = (title, desc, color) =>
    new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(desc);

// Shared logic: given a "target" member, whether the mention flow applies
// (i.e. someone was mentioned AND the backfire didn't swap the target away
// from them), and the acting member (for the backfire / self-plot-twist
// checks), build the full stage list.
function buildStages(target, useMentionFlow, actingMember) {
    const reason = susReasons[Math.floor(Math.random() * susReasons.length)];

    const isNotSus =
        useMentionFlow && target.id !== actingMember.id
            ? Math.random() < 0.3
            : false;

    const stages = [];

    if (!useMentionFlow) {
        stages.push(
            build("👀 Looking for sus activities...", "Scanning server members...", "Orange")
        );
        stages.push(
            build("🔍 Searching for sus...", "Checking behaviour patterns...", "Yellow")
        );
        stages.push(
            build("⏳ Processing data...", "Analyzing inconsistencies...", "Yellow")
        );
        stages.push(
            build("⚙️ Forming results...", "Compiling final report...", "Orange")
        );
        stages.push(
            build("👀 Final Sus Verdict", `${target.toString()} is ${reason}`, "Red")
        );
    } else {
        stages.push(
            build("👀 Looking for sus activities...", `Scanning ${target.toString()}...`, "Orange")
        );
        stages.push(
            build("🔍 Searching for sus...", `Analyzing behaviour of ${target.toString()}...`, "Yellow")
        );
        stages.push(
            build("⏳ Processing data...", "Checking inconsistencies...", "Yellow")
        );
        stages.push(
            build("⚙️ Forming results...", "Finalizing verdict...", "Orange")
        );
        stages.push(
            build(
                "👀 Final Sus Verdict",
                target.id === actingMember.id
                    ? `💀 Plot twist... YOU are SUS`
                    : isNotSus
                        ? `${target.toString()} is NOT sus 😇`
                        : `${target.toString()} is ${reason}`,
                target.id === actingMember.id
                    ? "DarkRed"
                    : isNotSus
                        ? "Green"
                        : "Red"
            )
        );
    }

    return stages;
}

async function pickRandomTarget(guild, excludeId) {
    let members;
    try {
        members = await guild.members.fetch();
    } catch {
        members = guild.members.cache;
    }

    const pool = [...members.values()].filter(
        (m) => !m.user.bot && m.id !== excludeId
    );

    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
    name: "sus",

    data: new SlashCommandBuilder()
        .setName("sus")
        .setDescription("Investigate a member for suspicious activity")
        .addUserOption((opt) =>
            opt
                .setName("target")
                .setDescription("Member to investigate (random member if omitted)")
                .setRequired(false)
        ),

    async execute(message) {
        const remaining = checkCooldown(message.author.id, "sus", 10);
        if (remaining) {
            return replyTemp(
                (payload) => message.reply(payload),
                `⏳ Please wait **${remaining}s** The vents are clear`
            );
        }

        const mentioned = message.mentions.members.first();

        let target;
        let isMentioned = false;

        if (mentioned) {
            target = mentioned;
            isMentioned = true;
        } else {
            target = await pickRandomTarget(message.guild, message.author.id);
            if (!target) return message.reply("No valid members found.");
        }

        // 🔥 10% BACKFIRE ONLY WHEN MENTIONING SOMEONE
        if (isMentioned && Math.random() < 0.1) {
            target = message.member;
        }

        // Mention flow only applies if the final target still matches who
        // was originally mentioned (i.e. the backfire didn't swap them out).
        const useMentionFlow = isMentioned && target.id === mentioned?.id;

        const stages = buildStages(target, useMentionFlow, message.member);

        await animateEmbed({ message, stages, interval: 1200 });
    },

    async executeInteraction(interaction) {
        const remaining = checkCooldown(interaction.user.id, "sus", 10);
        if (remaining) {
            return replyTemp(
                (payload) => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }),
                `⏳ Please wait **${remaining}s** The vents are clear`
            );
        }

        const mentionedUser = interaction.options.getUser("target");

        let target;
        let isMentioned = false;
        let originalMentionedId = null;

        if (mentionedUser) {
            target = await interaction.guild.members.fetch(mentionedUser.id);
            isMentioned = true;
            originalMentionedId = target.id;
        } else {
            target = await pickRandomTarget(interaction.guild, interaction.user.id);
            if (!target) {
                return interaction.reply({ content: "No valid members found.", flags: MessageFlags.Ephemeral });
            }
        }

        // 🔥 10% BACKFIRE ONLY WHEN MENTIONING SOMEONE
        if (isMentioned && Math.random() < 0.1) {
            target = interaction.member;
        }

        // Mention flow only applies if the final target still matches who
        // was originally mentioned (i.e. the backfire didn't swap them out).
        const useMentionFlow = isMentioned && target.id === originalMentionedId;

        const stages = buildStages(target, useMentionFlow, interaction.member);

        await animateEmbedInteraction({ interaction, stages, interval: 1200 });
    },
};
