const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { safeEdit, safeEditInteraction } = require("../utils/safeEdit");
const { replyTemp } = require("../utils/sendTemp");
const { checkCooldown } = require("../utils/cooldowns");

function pick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const processStages = [
	"Reviewing evidence...",
	"Listening to arguments...",
	"Jury is discussing...",
	"Final decision being made...",
];

const verdicts = [
	"GUILTY",
	"INNOCENT",
	"NOT ENOUGH EVIDENCE",
	"CASE DISMISSED",
	"JURY IS CONFUSED",
];

const punishments = [
	"must buy everyone cookies.",
	"has to carry the next game.",
	"must say 'I am the impostor' in VC.",
	"is banned from touching grass for 24h.",
	"must send a compliment to everyone.",
	"gets sentenced to silence for 10 minutes.",
	"must host the next event.",
	"gets emotional damage.",
	"must do 10 pushups (real or imaginary).",
];

function startEmbed(target) {
	return new EmbedBuilder()
		.setColor("Gold")
		.setTitle("⚖️ Court Session Started")
		.setDescription(`Defendant: **${target.user.tag}**`);
}

function stageEmbed(stage) {
	return new EmbedBuilder()
		.setColor("Orange")
		.setTitle("⚖️ Court in Progress")
		.setDescription(stage);
}

function verdictEmbed(target) {
	const verdict = pick(verdicts);
	const punishment = pick(punishments);

	const color =
		verdict === "GUILTY" ? "Red" : verdict === "INNOCENT" ? "Green" : "Grey";

	const embed = new EmbedBuilder()
		.setColor(color)
		.setTitle("⚖️ Court Verdict")
		.addFields(
			{ name: "Defendant", value: target.user.tag, inline: false },
			{ name: "Verdict", value: `**${verdict}**`, inline: false },
			{
				name: "Sentence",
				value: verdict === "GUILTY" ? punishment : "No punishment assigned.",
				inline: false,
			},
		)
		.setFooter({ text: "Court session ended" });

	return embed;
}

module.exports = {
	name: "judge",
	aliases: [],

	data: new SlashCommandBuilder()
		.setName("judge")
		.setDescription("Put someone on trial")
		.addUserOption((opt) =>
			opt
				.setName("target")
				.setDescription("Member to judge (defaults to you)")
				.setRequired(false)
		),

	async execute(message) {
		const remaining = checkCooldown(message.author.id, "judge", 10);

		if (remaining) {
			return replyTemp(
				(payload) => message.reply(payload),
				`⏳ Please wait **${remaining}s** The blance is realigning.`
			);
		}
		const target = message.mentions.members.first() || message.member;

		const msg = await message.channel.send({ embeds: [startEmbed(target)] });

		await sleep(1200);

		for (const stage of processStages) {
			if (!(await safeEdit(msg, { embeds: [stageEmbed(stage)] }))) return;
			await sleep(1000);
		}

		await sleep(1200);

		if (!(await safeEdit(msg, { embeds: [verdictEmbed(target)] }))) return;
	},

	async executeInteraction(interaction) {
		const remaining = checkCooldown(interaction.user.id, "judge", 10);

		if (remaining) {
			return replyTemp(
				(payload) => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }),
				`⏳ Please wait **${remaining}s** The blance is realigning.`
			);
		}

		const targetUser = interaction.options.getUser("target");
		const target = targetUser
			? await interaction.guild.members.fetch(targetUser.id)
			: interaction.member;

		await interaction.reply({ embeds: [startEmbed(target)] });

		await sleep(1200);

		for (const stage of processStages) {
			if (!(await safeEditInteraction(interaction, { embeds: [stageEmbed(stage)] }))) return;
			await sleep(1000);
		}

		await sleep(1200);

		if (!(await safeEditInteraction(interaction, { embeds: [verdictEmbed(target)] }))) return;
	},
};
