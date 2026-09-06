const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { checkCooldown } = require("../utils/cooldowns");
const { safeEdit, safeEditInteraction } = require("../utils/safeEdit");

const COOLDOWN_SECONDS = 10;
const SCAN_FRAMES = 8;
const SCAN_TICK_MS = 240;
const LOADER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TIERS = [
	{ max: 25, title: "🥔 Potato Brain", quips: ["Blame the wifi.", "Brains are overrated anyway.", "They peaked in kindergarden."] },
	{ max: 50, title: "😵 Confused", quips: ["Bless their heart.", "At least they're cute.", "Two thoughts fighting for third place."] },
	{ max: 75, title: "🙂 Average Discord User", quips: ["Creatively average.", "One of us! One of us!", "Operates on vibes alone."] },
	{ max: 100, title: "🧠 Normal", quips: ["Perfectly balanced.", "Has their two brain cells aligned.", "Surprisingly functional."] },
	{ max: 125, title: "🧠 Smart", quips: ["Has an actual thought process.", "Watches at 2x speed.", "Dangerously clued in."] },
	{ max: 150, title: "🤓 Genius", quips: ["Certified big brain energy.", "Please defer to them.", "Your tax dollars wish they could."] },
	{ max: 200, title: "🚀 Built Different", quips: ["This isn't even their final form.", "Physically hurting the curve.", "Universe says 'pick wisely'."] },
	{ max: 230, title: "👽 Not Human?", quips: ["Definitely from another planet.", "Has upscaled past humanity.", "Do not engage in 4D chess."] },
];

function getTier(iq) {
	return TIERS.find((t) => iq <= t.max) || TIERS[TIERS.length - 1];
}

const SCAN_LINES = [
	"Rounding up brain cells…",
	"Shaking loose some thoughts…",
	"Rummaging through memory…",
	"Calibrating neurons…",
	"Judging silently…",
	"Sniffing out a brain wave…",
	"Checking for thoughts…",
	"Finalizing the verdict…",
];

const SCAN_LINE_LEN = Math.max(...SCAN_LINES.map((l) => l.length));

function scanEmbed(target, frame, iq) {
	const spinner = LOADER_FRAMES[frame % LOADER_FRAMES.length];
	const line = SCAN_LINES[frame % SCAN_LINES.length].padEnd(SCAN_LINE_LEN);
	return new EmbedBuilder()
		.setColor(0x5865f2)
		.setTitle("🧠 IQ Scan")
		.setDescription(
			`${target}\n\n` +
			`\`${spinner} ${line}\`\n\n` +
			`**IQ** \`${String(iq).padStart(3)}\``
		)
		.setThumbnail(target.displayAvatarURL({ extension: "png", size: 256 }));
}

function resultEmbed(target, iq) {
	const tier = getTier(iq);
	const quips = tier.quips;
	return new EmbedBuilder()
		.setColor(0x57f287)
		.setTitle("🧠 IQ Scan Complete")
		.setDescription(
			`${target}, I read all your brain waves.\n\n` +
			`# **${iq} IQ**\n\n` +
			`${tier.title}`
		)
		.setThumbnail(target.displayAvatarURL({ extension: "png", size: 256 }))
		.addFields(
			{ name: "Analysis", value: quips[Math.floor(Math.random() * quips.length)] }
		)
		.setFooter({ text: "Very scientific. Definitely." });
}

async function scanFlow(target, { send, edit }) {
	const finalIQ = Math.floor(Math.random() * 230) + 1;
	let current = Math.floor(Math.random() * 230) + 1;

	const handle = await send({ embeds: [scanEmbed(target, 0, current)] });

	for (let i = 1; i <= SCAN_FRAMES; i++) {
		await sleep(SCAN_TICK_MS);

		current = Math.round(current + (finalIQ - current) * 0.35) + (Math.floor(Math.random() * 5) - 2);
		current = Math.max(1, Math.min(230, current));

		if (!(await edit(handle, { embeds: [scanEmbed(target, i, current)] }))) return;
	}

	await sleep(400);

	await edit(handle, { embeds: [resultEmbed(target, finalIQ)] });
}

module.exports = {
	name: "iq",

	data: new SlashCommandBuilder()
		.setName("iq")
		.setDescription("Run an IQ scan on someone")
		.addUserOption((opt) =>
			opt
				.setName("target")
				.setDescription("Member to scan (defaults to you)")
				.setRequired(false)
		),

	async execute(message) {
		const remaining = checkCooldown(message.author.id, "iq", COOLDOWN_SECONDS);
		if (remaining) {
			return message.reply(`⏳ Scanner cooling down — try again in **${remaining}s**.`);
		}

		const target = message.mentions.members.first() || message.member;

		return scanFlow(target, {
			send: (payload) => message.channel.send(payload),
			edit: (handle, payload) => safeEdit(handle, payload),
		});
	},

	async executeInteraction(interaction) {
		const remaining = checkCooldown(interaction.user.id, "iq", COOLDOWN_SECONDS);
		if (remaining) {
			return interaction.reply({
				content: `⏳ Scanner cooling down — try again in **${remaining}s**.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const targetUser = interaction.options.getUser("target");
		const target = targetUser
			? await interaction.guild.members.fetch(targetUser.id)
			: interaction.member;

		await interaction.reply({
			embeds: [scanEmbed(target, 0, Math.floor(Math.random() * 230) + 1)],
		});

		return scanFlow(target, {
			send: () => ({ ok: true }),
			edit: (handle, payload) => safeEditInteraction(interaction, payload),
		});
	},
};