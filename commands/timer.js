const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    MessageFlags,
} = require("discord.js");
const { safeEdit } = require("../utils/safeEdit");
const { replyTemp } = require("../utils/sendTemp");
const { checkCooldown } = require("../utils/cooldowns");

const activeTimers = new Map();

function parseTime(input) {
    if (!input) return 0;
    if (/^\d+$/.test(input)) return parseInt(input, 10) * 1000;

    let ms = 0;
    const matches = input.matchAll(/(\d+)([smh])/gi);

    for (const match of matches) {
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();

        if (unit === "s") ms += value * 1000;
        if (unit === "m") ms += value * 60000;
        if (unit === "h") ms += value * 3600000;
    }

    return ms;
}

function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s || parts.length === 0) parts.push(`${s}s`);

    return parts.join(" ");
}

function progressBar(percent, size = 20) {
    const filled = Math.round((percent / 100) * size);
    return "█".repeat(filled) + "░".repeat(size - filled);
}

function getColor(percent) {
    if (percent < 25) return "Red";
    if (percent < 50) return "Orange";
    if (percent < 75) return "Yellow";
    return "Green";
}

function getUpdateInterval(duration) {
    if (duration <= 60000) return 1500;
    if (duration <= 600000) return 5000;
    if (duration <= 3600000) return 15000;
    return 60000;
}

async function runTimer({
    author,
    channel,
    reply,
    durationInput,
    reminderText = "",
    isReminder = false,
    pingEveryone = false,
}) {
    const duration = parseTime(durationInput);

    const remaining = checkCooldown(author.id, "timer", 10);
    if (remaining) {
        return replyTemp(
            (payload) => reply(payload),
            {
                content: `⏳ Slow down! You can start another timer in **${remaining}s**.`,
                flags: MessageFlags.Ephemeral,
            }
        );
    }

    if (!duration) {
        return reply({
            content: "Provide a valid time.\nExamples:\n`30s`\n`2m`\n`1h30m`",
            flags: MessageFlags.Ephemeral,
        });
    }

    const userTimers = activeTimers.get(author.id) || 0;

    if (userTimers >= 3) {
        return reply({
            content: "You already have **3 active timers**.",
            flags: MessageFlags.Ephemeral,
        });
    }

    activeTimers.set(author.id, userTimers + 1);

    const title = reminderText || (isReminder ? "Reminder" : "Timer Running");
    const start = Date.now();
    const end = start + duration;

    const makeEmbed = (remaining) => {
        const percent = Math.min(
            100,
            Math.round(((duration - remaining) / duration) * 100)
        );

        return new EmbedBuilder()
            .setColor(getColor(percent))
            .setTitle(remaining > 0 ? `⏳ ${title}` : `🎉 ${title}`)
            .setDescription(
                remaining > 0
                    ? [
                          `${progressBar(percent)} ${percent}%`,
                          "",
                          "**⏱ Remaining**",
                          formatTime(remaining),
                          "",
                      ].join("\n")
                    : [`${progressBar(100)} 100%`, "", "🎉 Time's Up!"].join("\n")
            );
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("cancel_timer")
            .setLabel("Cancel")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
    );

    const msg = await channel.send({
        embeds: [makeEmbed(duration)],
        components: [row],
    });

    await reply({
        content: `Started ${isReminder ? "reminder" : "timer"} for ${formatTime(duration)}.`,
        flags: MessageFlags.Ephemeral,
    });

    let cancelled = false;
    const interval = getUpdateInterval(duration);

    const finishTimer = async () => {
        if (cancelled) return;

        cancelled = true;
        clearInterval(updateLoop);

        activeTimers.set(
            author.id,
            Math.max(0, (activeTimers.get(author.id) || 1) - 1)
        );

        if (
            !(await safeEdit(msg, {
                embeds: [makeEmbed(0)],
                components: [],
            }))
        ) {
            return;
        }

        const ping = pingEveryone ? `@everyone <@${author.id}>` : `<@${author.id}>`;

        let content;

        if (pingEveryone) {
            content = isReminder
                ? `${ping} ⏰ ${author.username}'s reminder is ready!`
                : `${ping} ⏰ ${author.username}'s timer has finished!`;

            if (reminderText) content += `\n📝 ${reminderText}`;
        } else {
            content = reminderText
                ? `${ping} ⏰ ${reminderText}`
                : isReminder
                ? `${ping} ⏰ Your reminder is ready!`
                : `${ping} ⏰ Your timer has finished!`;
        }

        await channel.send({ content });
        collector.stop("finished");
    };

    const finishTimeout = setTimeout(finishTimer, duration);

    const updateLoop = setInterval(async () => {
        if (cancelled) return;

        const remaining = Math.max(0, end - Date.now());

        try {
            await safeEdit(msg, {
                embeds: [makeEmbed(remaining)],
                components: [row],
            });
        } catch {}
    }, interval);

    const collector = msg.createMessageComponentCollector({
        time: duration,
    });

    let disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("timer_cancelled")
            .setLabel("Cancelled")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );

    collector.on("collect", async (interaction) => {
        if (interaction.user.id !== author.id) {
            return interaction.reply({
                content: "Only the person who started this timer can cancel it.",
                flags: MessageFlags.Ephemeral,
            });
        }

        cancelled = true;
        clearInterval(updateLoop);
        clearTimeout(finishTimeout);

        activeTimers.set(
            author.id,
            Math.max(0, (activeTimers.get(author.id) || 1) - 1)
        );

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor("Grey")
                    .setTitle(`⚪ ${title}`)
                    .setDescription("Timer cancelled."),
            ],
            components: [disabledRow],
        });
        collector.stop("cancelled");
    });

    collector.on("end", async (_, reason) => {
        if (reason === "finished" || reason === "cancelled") return;

        clearInterval(updateLoop);

        activeTimers.set(
            author.id,
            Math.max(0, (activeTimers.get(author.id) || 1) - 1)
        );

        try {
            await safeEdit(msg, {
                components: [disabledRow],
            });
        } catch {}
    });
}

module.exports = {
    name: "timer",
    aliases: ["remind", "timerall", "remindall"],

    data: [
        new SlashCommandBuilder()
            .setName("timer")
            .setDescription("Start a timer")
            .addStringOption(option =>
                option
                    .setName("duration")
                    .setDescription("Examples: 30s, 2m, 1h30m")
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName("title")
                    .setDescription("Optional timer title")
                    .setRequired(false)
            )
            .addBooleanOption(option =>
                option
                    .setName("everyone")
                    .setDescription("Ping everyone when it finishes")
                    .setRequired(false)
            ),

        new SlashCommandBuilder()
            .setName("remind")
            .setDescription("Start a reminder")
            .addStringOption(option =>
                option
                    .setName("duration")
                    .setDescription("Examples: 30s, 2m, 1h30m")
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName("text")
                    .setDescription("Reminder text")
                    .setRequired(false)
            )
            .addBooleanOption(option =>
                option
                    .setName("everyone")
                    .setDescription("Ping everyone when it finishes")
                    .setRequired(false)
            ),
    ],

    async execute(message, args = [], client, invokedName) {
        const isReminder = invokedName.includes("remind");
        const pingEveryone = invokedName.includes("all");
        const durationInput = args[0];
        const reminderText = args.slice(1).join(" ").trim();

        return runTimer({
            author: message.author,
            channel: message.channel,
            reply: (payload) => message.reply(payload),
            durationInput,
            reminderText,
            isReminder,
            pingEveryone,
        });
    },

    async executeInteraction(interaction) {
        const commandName = interaction.commandName;
        const isReminder = commandName === "remind";

        const durationInput = interaction.options.getString("duration", true);
        const reminderText = isReminder
            ? interaction.options.getString("text") || ""
            : interaction.options.getString("title") || "";
        const pingEveryone = interaction.options.getBoolean("everyone") || false;

        return runTimer({
            author: interaction.user,
            channel: interaction.channel,
            reply: (payload) => interaction.reply(payload),
            durationInput,
            reminderText,
            isReminder,
            pingEveryone,
        });
    },
};
