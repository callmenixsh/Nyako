const fs = require('fs');
const path = require('path');
const sleepSequences = new Map();
require('dotenv').config();
const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown: restore any keepalive nicknames before exiting.
async function onShutdown() {
  const vc = client.commands.get("vc");
  if (client.isReady() && vc?.resetKeepaliveNickname) {
    await Promise.allSettled(
      [...client.guilds.cache.values()].map((g) => vc.resetKeepaliveNickname(g))
    );
  }
  process.exit(0);
}
process.on("SIGINT", onShutdown);
process.on("SIGTERM", onShutdown);


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = 'nya!';

client.commands = new Map();

const commandFiles = fs
    .readdirSync(path.join(__dirname, 'commands'))
    .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
    if (Array.isArray(command.aliases)) {
        for (const a of command.aliases) {
            client.commands.set(a, command);
        }
    }
    if (command.data) {
        const builders = Array.isArray(command.data) ? command.data : [command.data];
        for (const builder of builders) {
            client.commands.set(builder.name, command);
        }
    }
}

client.on('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Self-heal: if the bot was switched off while /vc afk keepalive was
    // running, its server nickname was never restored. Clear any leftovers.
    const vc = client.commands.get("vc");
    if (vc?.resetKeepaliveNickname && vc?.keepaliveNickname) {
        for (const guild of client.guilds.cache.values()) {
            if (guild.members.me?.nickname === vc.keepaliveNickname) {
                vc.resetKeepaliveNickname(guild);
            }
        }
    }

    // Playful mode: schedule random antics for guilds that enabled it.
    client.commands.get("playful")?.startPlayfulnessScheduler?.(client);
});

const { ActivityType } = require("discord.js");

client.once("clientReady", () => {
  client.user.setPresence({
    activities: [
      {
        type: ActivityType.Custom,
        name: "custom",
        state: "nya!help | /help",
      },
    ],
    status: "online",
  });
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // Playful mode: 5% of human messages may get a playful reply.
    client.commands.get("playful")?.onMessage?.(message);

    const content = message.content.trim().toLowerCase();

const state = sleepSequences.get(message.channel.id);

if (!state && content === "3") {

    const vc = message.member?.voice.channel;

    // silently ignore if not in VC
    if (!vc) return;

    sleepSequences.set(message.channel.id, {
        step: 1,
        vc,
        timeout: setTimeout(() => {
            sleepSequences.delete(message.channel.id);
        }, 15000),
    });

    return;
}


if (state) {

    const expected =
        state.step === 1 ? "2" :
        state.step === 2 ? "1" :
        "poof";


    if (content === expected) {

        state.step++;

        if (state.step === 4) {

            clearTimeout(state.timeout);
            sleepSequences.delete(message.channel.id);

            const voice = client.commands.get("vc");

            if (voice?.scheduleSleep) {
                await voice.scheduleSleep(message, state.vc);
            }
        }

    } else {

        clearTimeout(state.timeout);
        sleepSequences.delete(message.channel.id);

    }
}
    // ---------- Commands ----------
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const cmd = args.shift()?.toLowerCase();

    const command = client.commands.get(cmd);

    if (command) {
        try {
            await command.execute(message, args, client, cmd);
        } catch (err) {
            console.error(`Error in command "${cmd}":`, err);
            message.reply({
                content: `❌ Command error: \`${err.message}\``,
            }).catch(() => {});
        }
    }
});

// ---------- Slash commands & context menu commands ----------
async function handleInteractionError(interaction, err) {
    console.error(`Error in interaction "${interaction.commandName}":`, err);

    const errorResponse = {
        content: `❌ Command error: \`${err.message}\``,
        flags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorResponse).catch(() => {});
    } else {
        await interaction.reply(errorResponse).catch(() => {});
    }
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command || !command.executeInteraction) {
            console.warn(`No slash handler found for "${interaction.commandName}".`);
            return;
        }

        try {
            await command.executeInteraction(interaction);
        } catch (err) {
            await handleInteractionError(interaction, err);
        }
        return;
    }

    if (interaction.isMessageContextMenuCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command || !command.executeContextMenu) {
            console.warn(`No context menu handler found for "${interaction.commandName}".`);
            return;
        }

        try {
            await command.executeContextMenu(interaction);
        } catch (err) {
            await handleInteractionError(interaction, err);
        }
        return;
    }
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('Missing DISCORD_TOKEN environment variable. Set it in .env or the environment.');
    process.exit(1);
}

client.login(TOKEN);