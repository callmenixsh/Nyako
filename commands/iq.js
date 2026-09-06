const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { checkCooldown } = require("../utils/cooldowns");
const { safeEdit, safeEditInteraction } = require("../utils/safeEdit");

function getTitle(iq) {
	if (iq <= 25) return "🥔 Potato Brain";
	if (iq <= 50) return "😵 Confused";
	if (iq <= 75) return "🙂 Average Discord User";
	if (iq <= 100) return "🧠 Normal";
	if (iq <= 125) return "🧠 Smart";
	if (iq <= 150) return "🤓 Genius";
	if (iq <= 200) return "🚀 Built Different";
	return "👽 Not Human?";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const scanStates = [
	"Scanning neural pathways...",
	"Reading brain activity...",
	"Decoding thought patterns...",
	"Analyzing memory clusters...",
	"Detecting cognitive signals...",
	"Stabilizing neural output...",
	"Calibrating intelligence matrix...",
	"Locking final estimate...",
];

function scanEmbed(target, stageText, current) {
	return new EmbedBuilder()
		.setColor("Blue")
		.setTitle("🧠 IQ SCANNER ACTIVE")
		.setDescription(
			`**Subject:** ${target.toString()}\n\n` +
			`${stageText}\n\n` +
			`IQ: \`${current}\``
		);
}

function resultEmbed(target, finalIQ) {
	return new EmbedBuilder()
		.setColor("DarkBlue")
		.setTitle("🧠 IQ SCAN COMPLETE")
		.setDescription(
			`**Subject:** ${target.toString()}\n\n` +
			`Final Stabilized IQ:\n` +
			`## 🧠 \`${finalIQ}\`\n\n` +
			`**Classification:** ${getTitle(finalIQ)}`
		)
		.setFooter({ text: "neural scan stabilized" });
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
		const remaining = checkCooldown(message.author.id, "iq", 10);

		if (remaining) {
			return message.reply(
				`⏳ Please wait **${remaining}s** The scanner is cooling down.`
			);
		}
		const target = message.mentions.members.first() || message.member;

		const msg = await message.channel.send({
			embeds: [scanEmbed(target, "Initializing scan...", "--")],
		});

		const finalIQ = Math.floor(Math.random() * 230) + 1;
		let current = Math.floor(Math.random() * 230) + 1;

		for (let i = 0; i < scanStates.length; i++) {
			current = Math.round(current + (finalIQ - current) * 0.35);
			current += Math.floor(Math.random() * 5) - 2;

			if (current < 1) current = 1;
			if (current > 230) current = 230;

			await sleep(450);

			if (!(await safeEdit(msg, { embeds: [scanEmbed(target, scanStates[i], current)] }))) return;
		}

		await sleep(700);

		if (!(await safeEdit(msg, { embeds: [resultEmbed(target, finalIQ)] }))) return;
	},

	async executeInteraction(interaction) {
		const remaining = checkCooldown(interaction.user.id, "iq", 10);

		if (remaining) {
			return interaction.reply({
				content: `⏳ Please wait **${remaining}s** The scanner is cooling down.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const targetUser = interaction.options.getUser("target");
		const target = targetUser
			? await interaction.guild.members.fetch(targetUser.id)
			: interaction.member;

		await interaction.reply({
			embeds: [scanEmbed(target, "Initializing scan...", "--")],
		});

		const finalIQ = Math.floor(Math.random() * 230) + 1;
		let current = Math.floor(Math.random() * 230) + 1;

		for (let i = 0; i < scanStates.length; i++) {
			current = Math.round(current + (finalIQ - current) * 0.35);
			current += Math.floor(Math.random() * 5) - 2;

			if (current < 1) current = 1;
			if (current > 230) current = 230;

			await sleep(450);

			if (!(await safeEditInteraction(interaction, { embeds: [scanEmbed(target, scanStates[i], current)] }))) return;
		}

		await sleep(700);

		if (!(await safeEditInteraction(interaction, { embeds: [resultEmbed(target, finalIQ)] }))) return;
	},
};
