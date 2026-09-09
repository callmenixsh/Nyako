const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	MessageFlags,
} = require("discord.js");

const DEFAULT_COLOR = "#e74c3c";

const MODES = {
	slash: {
		label: "Slash Commands",
		emoji: "⚡",
		intro: " ",
	},
	prefix: {
		label: "Prefix Commands",
		emoji: "⌨️",
		intro: " ",
	},
};

const PAGE_ORDER = ["fun", "games", "social", "vc", "utility", "nyako", "misc"];

const PAGE_DATA = {
	fun: {
		label: "Fun",
		emoji: "🎉",
		color: DEFAULT_COLOR,
		title: "Fun ",
		fields: {
			slash: [
				{
					name: "Commands",
					value: [
						"</iq:1524747985102176379> — Check your or someone else's IQ.",
						"</sacrifice:1524763913676259409> — Put someone up for sacrifice.",
						"</sleep:1524768245285126287> — Idk should you?",
						"</sus:1524747985102176382> — Are you sus? 👀",
						"</judge:1524747985102176380> — Judge guilty or not.",
					].join("\n"),
				},
			],
			prefix: [
				{
					name: "Commands",
					value: [
						"`nya!iq` — Check your or someone else's IQ.",
						"`nya!sacrifice` — Put someone up for sacrifice.",
						"`nya!sleep` — Idk should you?",
						"`nya!sus` — Are you sus? 👀",
						"`nya!judge` — Judge guilty or not.",
					].join("\n"),
				},
			],
		},
	},

	games: {
		label: "Games",
		emoji: "🎮",
		color: DEFAULT_COLOR,
		title: "Game ",
		fields: {
			slash: [
				{
					name: "Commands",
					value: [
						"</court:1524778488001859694> — Put someone on trial.",
					].join("\n"),
				},
			],
			prefix: [
				{
					name: "Commands",
					value: [
						"`nya!court` — Put someone on trial.",
					].join("\n"),
				},
			],
		},
	},

	social: {
		label: "Social",
		emoji: "💞",
		color: "#ff9bd5",
		title: "Social ",
		fields: {
			slash: [
				{
					name: "Marriage",
					value: [
						"</marriage:1524768245285126286> — Open marriage options.",
						"Actions: `marry`, `partner`, `divorce`, or `marriages`.",
					].join("\n"),
				},
			],
			prefix: [
				{
					name: "Marriage",
					value: [
						"`nya!marry @user` — Propose to someone.",
						"`nya!partner` — Show your current partner.",
						"`nya!divorce` — Divorce your current partner.",
						"`nya!marriages` — Show all marriages in the server.",
					].join("\n"),
				},
			],
		},
	},

	vc: {
		label: "Voice",
		emoji: "🎤",
		color: DEFAULT_COLOR,
		title: "Voice ",
		fields: {
			slash: [
				{
					name: "VC Games",
					value: [
						"</hotpotato:1524769754366214307> — Pass the potato before it explodes.",
						"</roulette:1524763913676259408> — Take turns spinning the chamber.",
					].join("\n"),
				},
				{
					name: "VC Controls",
					value: [
						"</vc user:1524755958390194301> — Pick one user and choose an action.",
						"</vc all:1524755958390194301> — Pick an action for everyone in your current VC.",
						"Actions :: `disconnect`, `deafen`, `undeafen`, `mute`,`unmute`",
					].join("\n"),
				},
				{
					name: "Keep VC Alive",
					value: "</vc afk:1524755958390194301> — Turn keepalive on or off.",
				},
			],
			prefix: [
				{
					name: "VC Games",
					value: [
						"`nya!hotpotato` — Pass the potato before it explodes.",
						"`nya!roulette` — Take turns spinning the chamber.",
					].join("\n"),
				},
				{
					name: "Single Target",
					value: [
						"`nya!yeet @user <time>` — Disconnect a user.",
						"`nya!deafen @user <time>` — Server deafen a user.",
						"`nya!undeafen @user <time>` — Remove server deafen.",
						"`nya!mute @user <time>` — Server mute a user.",
						"`nya!unmute @user <time>` — Remove server mute.",
					].join("\n"),
				},
				{
					name: "Everyone in VC",
					value: [
						"`nya!yeetall <time>` — Disconnect everyone.",
						"`nya!deafenall <time>` — Server deafen everyone.",
						"`nya!undeafenall <time>` — Remove server deafen.",
						"`nya!muteall <time>` — Server mute everyone.",
						"`nya!unmuteall <time>` — Remove server mute.",
					].join("\n"),
				},
				{
					name: "Keepalive",
					value: [
						"`nya!afkvc`, `nya!stayvc`, `nya!keepvcalive` — Join and stay in VC.",
						"`nya!leavevc`, `nya!stopvcalive`, `nya!leave` — Leave VC.",
					].join("\n"),
				},
				{
					name: "Time Format",
					value: "`30s` • `2m` • `1h30m` • `2h15m10s`",
				},
			],
		},
	},

	utility: {
		label: "Utility",
		emoji: "🛠️",
		color: DEFAULT_COLOR,
		title: "Utility ",
		fields: {
			slash: [
				{
					name: "Commands",
					value: [
						"</timer:1524759254559490158> — Start a timer.",
						"</remind:1524759254559490161> — Set a reminder.",
					].join("\n"),
				},
				{
					name: "Time Format",
					value: "`30s` • `2m` • `1h30m` • `2h15m10s`",
				},
			],
			prefix: [
				{
					name: "Commands",
					value: [
						"`nya!timer <time> [message]` — Start a timer.",
						"`nya!remind <time> [message]` — Set a reminder.",
						"`nya!clip` — Clip a message.",
					].join("\n"),
				},
				{
					name: "Time Format",
					value: "`30s` • `2m` • `1h30m` • `2h15m10s`",
				},
			],
		},
	},

	nyako: {
		label: "Nyako",
		emoji: "🐱",
		color: "#ff9bd5",
		title: "Nyako Interactions",
		fields: {
			slash: [
				{
					name: "Command",
					value: "</nyako:1524747985102176378> — Open the interaction menu.",
				},
				{
					name: "Categories",
					value: [
						"Friendly: `pat`, `pet`, `hug`, `boop`, `kiss`, `cuddle`",
						"Gifts: `cookie`, `feed`, `fish`, `coffee`, `flower`, `gift`",
						"Chaos: `kill`, `bully`, `poke`, `bonk`, `throw`, `insult`, `scare`",
						"Comfort: `comfort`, `apologize`, `care`",
					].join("\n"),
				},
				{
					name: "Playful Mode",
					value:
						"`/playful` — Let Nyako occasionally do chaotic things. `action`: `on` / `off` / `status`.",
				},
			],
			prefix: [
				{
					name: "Friendly",
					value:
						"`nya!pat` `nya!pet` `nya!hug` `nya!boop` `nya!kiss` `nya!cuddle`",
				},
				{
					name: "Gifts",
					value:
						"`nya!cookie` `nya!feed` `nya!fish` `nya!coffee` `nya!flower` `nya!gift`",
				},
				{
					name: "Chaos",
					value:
						"`nya!kill` `nya!bully` `nya!poke` `nya!bonk` `nya!throw` `nya!insult` `nya!scare`",
				},
				{
					name: "Comfort",
					value: "`nya!comfort` `nya!apologize` `nya!care`",
				},
				{
					name: "Playful Mode",
					value:
						"`nya!playful on` — enable (server-wide). `off` / `status` too.",
				},
			],
		},
	},

	misc: {
		label: "Misc",
		emoji: "⚙️",
		color: DEFAULT_COLOR,
		title: "Misc",
		fields: {
			slash: [
				{
					name: "Help",
					value: "`/help` — Open this menu.",
				},
				{
					name: "Server Config",
					value: "`/permsrole` — Control who can use VC commands and playful mode.",
				},
			],
			prefix: [
				{
					name: "Help",
					value: "`nya!help` — Open this menu.",
				},
				{
					name: "Server Config",
					value: "`nya!permsrole open` — Allow everyone. `nya!permsrole set @role` — Role-only. `nya!permsrole disable` — Block all.",
				},
			],
		},
	},
};

function resolvePage(input) {
	const page = (input || "").toLowerCase();
	if (PAGE_DATA[page]) return page;
	if (["games", "game"].includes(page)) return "games";
	if (["vc", "voice", "controls"].includes(page)) return "vc";
	if (["utility", "util"].includes(page)) return "utility";
	if (["nyako", "interactions", "interaction"].includes(page)) return "nyako";
	if (["social"].includes(page)) return "social";
	if (["misc"].includes(page)) return "misc";
	return "fun";
}

function buildHelpEmbed(page, mode, client) {
	const data = PAGE_DATA[page];
	const botAvatar = client.user.displayAvatarURL({
		extension: "png",
		size: 512,
	});

	return new EmbedBuilder()
		.setColor(data.color)
		.setAuthor({
			name: `${client.user.username} Help`,
			iconURL: botAvatar,
		})
		.setTitle(`${data.emoji} ${data.title}`)
		.setThumbnail(botAvatar)
		.setDescription(MODES[mode].intro)
		.addFields(data.fields[mode] || [])
		.setFooter({
			text: `${MODES[mode].label} • Created by ohclaww`,
		});
}

function buildComponents(page, mode) {
	const select = new StringSelectMenuBuilder()
		.setCustomId("help_category")
		.setPlaceholder("Select a category")
		.setMinValues(1)
		.setMaxValues(1)
		.setOptions(
			PAGE_ORDER.map((key) => ({
				label: PAGE_DATA[key].label,
				value: key,
				emoji: PAGE_DATA[key].emoji,
				default: key === page,
			})),
		);

	const switchButton = new ButtonBuilder()
		.setCustomId("help_switch_mode")
		.setLabel(mode === "slash" ? "nya!" : "/--")
		.setEmoji(mode === "slash" ? "⌨️" : "⚡")
		.setStyle(ButtonStyle.Secondary);

	const closeButton = new ButtonBuilder()
		.setCustomId("help_close")
		.setLabel("Close")
		.setEmoji("⛔")
		.setStyle(ButtonStyle.Danger);

	return [
		new ActionRowBuilder().addComponents(select),
		new ActionRowBuilder().addComponents(switchButton, closeButton),
	];
}

async function runHelpMenu(
	send,
	authorId,
	client,
	initialPage,
	initialMode = "slash",
) {
	let page = initialPage;
	let mode = initialMode;

	const render = () => ({
		embeds: [buildHelpEmbed(page, mode, client)],
		components: buildComponents(page, mode),
	});

	const msg = await send(render());
	const collector = msg.createMessageComponentCollector({ time: 60000 });

	collector.on("collect", async (interaction) => {
		if (interaction.user.id !== authorId) {
			return interaction.reply({
				content: "Only the person who used the command can use this menu.",
				flags: MessageFlags.Ephemeral,
			});
		}

		if (interaction.customId === "help_close") {
			collector.stop("closed");
			await interaction.deferUpdate().catch(() => {});
			return msg.delete().catch(() => {});
		}

		if (interaction.customId === "help_switch_mode") {
			mode = mode === "slash" ? "prefix" : "slash";
			return interaction.update(render());
		}

		if (interaction.customId === "help_category") {
			page = interaction.values[0];
			if (!PAGE_DATA[page]) return;
			return interaction.update(render());
		}
	});

	collector.on("end", async (_, reason) => {
		if (reason === "closed") return;
		await msg.edit({ components: [] }).catch(() => {});
	});
}

module.exports = {
	name: "help",

	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("Opens the Nyako help menu.")
		.addStringOption((option) =>
			option
				.setName("page")
				.setDescription("Jump directly to a specific page")
				.setRequired(false)
				.addChoices(
					{ name: "Fun", value: "fun" },
					{ name: "Games", value: "games" },
					{ name: "Social", value: "social" },
					{ name: "Voice", value: "vc" },
					{ name: "Utility", value: "utility" },
					{ name: "Nyako", value: "nyako" },
					{ name: "Misc", value: "misc" },
				),
		),

	async execute(message, args = [], client) {
		const initialPage = resolvePage(args[0]);
		return runHelpMenu(
			(payload) => message.channel.send(payload),
			message.author.id,
			client || message.client,
			initialPage,
			"prefix",
		);
	},

	async executeInteraction(interaction) {
		const initialPage = resolvePage(interaction.options.getString("page"));
		return runHelpMenu(
			async (payload) => {
				await interaction.reply(payload);
				return interaction.fetchReply();
			},
			interaction.user.id,
			interaction.client,
			initialPage,
			"slash",
		);
	},
};
