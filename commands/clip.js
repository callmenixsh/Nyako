const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageFlags,
} = require("discord.js");
const fs = require("fs").promises;

const configPath = require("path").join(__dirname, "../clipConfig.json");

const MAX_EMBEDS = 10;
const MAX_ATTACHMENT_FIELDS = 3;

async function loadConfig() {
  try {
    return JSON.parse(await fs.readFile(configPath));
  } catch {
    return {};
  }
}

async function saveConfig(config) {
  await fs.writeFile(configPath, JSON.stringify(config, null, 4));
}

function truncate(text, max = 4000) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/**
 * Build the embeds + "Jump to Message" button for a clipped message.
 * Shared by both the reply-based prefix command and the context menu command.
 */
function buildClipPayload(target, invokerUser) {
  const attachments = [...target.attachments.values()];
  const images = attachments.filter((a) => a.contentType?.startsWith("image/"));
  const others = attachments.filter((a) => !a.contentType?.startsWith("image/"));

  const embeds = [];

  const main = new EmbedBuilder()
    .setColor("#5865F2")
    .setAuthor({
      name: target.author.username,
      iconURL: target.author.displayAvatarURL(),
    })
    .setDescription(
      target.content.trim() ? truncate(target.content.trim()) : "*No text content*",
    )
    .setTimestamp(target.createdTimestamp);

  const location = [target.channel?.name && `#${target.channel.name}`, target.guild?.name]
    .filter(Boolean)
    .join(" • ");
  if (location) main.setFooter({ text: location });

  if (images.length) main.setImage(images[0].url);
  embeds.push(main);

  for (const img of images.slice(1, MAX_EMBEDS)) {
    embeds.push(new EmbedBuilder().setColor("#5865F2").setURL(target.url).setImage(img.url));
  }

  for (const a of others.slice(0, MAX_ATTACHMENT_FIELDS)) {
    main.addFields({ name: `📎 ${a.name || "Attachment"}`, value: a.url });
  }

  for (const e of target.embeds.filter((e) => e.url).slice(0, MAX_ATTACHMENT_FIELDS)) {
    main.addFields({ name: `🔗 ${e.title || "Link"}`, value: e.url });
  }

  if (target.stickers.size && embeds.length < MAX_EMBEDS) {
    embeds.push(
      new EmbedBuilder()
        .setColor("#5865F2")
        .setURL(target.url)
        .setDescription(`Sticker: **${target.stickers.first().name}**`)
        .setImage(target.stickers.first().url),
    );
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Jump to Message")
      .setStyle(ButtonStyle.Link)
      .setURL(target.url),
  );

  return {
    content: `📸 Clipped by ${invokerUser}`,
    embeds,
    components: [row],
  };
}

/**
 * Announce in the original channel that a message was clipped, pinging the
 * message author. Silent (catch) so a failed notice never breaks the clip.
 */
async function sendClipNotice(noticeChannel, target, invokerUser, clipChannel) {
  try {
    await noticeChannel.send(
      `📸 <@${target.author.id}> — your message got clipped to ${clipChannel} by ${invokerUser}`,
    );
  } catch {
    // no-op: notifications are best-effort
  }
}

/**
 * Look up the configured clip channel for a guild.
 * @returns {{ ok: true, channel } | { ok: false, reason: string }}
 */
async function resolveClipChannel(guild) {
  const config = await loadConfig();
  const guildConfig = config[guild.id];

  if (!guildConfig) {
    return {
      ok: false,
      reason: "Clip channel is not setup yet.\n\nUse:\n`nya!clip setup #channel`",
    };
  }

  const clipChannel = guild.channels.cache.get(guildConfig.channelId);

  if (!clipChannel) {
    return { ok: false, reason: "❌ Saved clip channel no longer exists." };
  }

  return { ok: true, channel: clipChannel };
}

module.exports = {
  name: "clip",
  aliases: ["screenshot"],

  // Message context menu command: right-click a message → Apps → Clip Message.
  // Context menu commands can't have a description — Discord doesn't allow one.
  data: [
    new ContextMenuCommandBuilder()
      .setName("Clip Message")
      .setType(ApplicationCommandType.Message),
  ],

  // ----- Prefix command: "nya!clip" as a reply to a message or with a link -----
  async execute(message, args) {
    // ---------------- SETUP ----------------

    if (args[0] === "setup") {
      const channel = message.mentions.channels.first() || message.channel;

      const config = await loadConfig();
      config[message.guild.id] = { channelId: channel.id };
      await saveConfig(config);

      return message.reply(`Clip channel set to ${channel}`);
    }

    // ---------------- CHECK SETUP ----------------

    const resolved = await resolveClipChannel(message.guild);
    if (!resolved.ok) return message.reply(resolved.reason);

    // ---------------- TARGET MESSAGE ----------------

    let targetId = message.reference?.messageId;

    if (!targetId && args[0]) {
      const ids = args[0].match(/\d{17,21}/g);
      targetId = ids ? ids[ids.length - 1] : null;
    }

    if (!targetId) {
      return message.reply("Reply to a message or pass a message link to clip it.");
    }

    let target;
    try {
      target = await message.channel.messages.fetch(targetId);
    } catch {
      return message.reply("❌ Couldn't find that message.");
    }

    try {
      await resolved.channel.send(buildClipPayload(target, message.author));
    } catch (err) {
      console.error("clip save error:", err);
      return message.reply("❌ Couldn't save the clip.");
    }

    await sendClipNotice(message.channel, target, message.author, resolved.channel);

    return message.reply(`📸 Clipped and saved in ${resolved.channel}`);
  },

  // ----- Message context menu command: right-click → Apps → Clip Message -----
  async executeContextMenu(interaction) {
    const resolved = await resolveClipChannel(interaction.guild);
    if (!resolved.ok) {
      return interaction.reply({ content: resolved.reason, flags: MessageFlags.Ephemeral });
    }

    let target;
    try {
      target = await interaction.channel.messages.fetch(interaction.targetMessage.id);
    } catch {
      return interaction.reply({
        content: "❌ Couldn't find that message.",
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await resolved.channel.send(buildClipPayload(target, interaction.user));
    } catch (err) {
      console.error("clip save error:", err);
      return interaction.reply({
        content: "❌ Couldn't save the clip.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await sendClipNotice(interaction.channel, target, interaction.user, resolved.channel);

    return interaction.reply({
      content: `📸 Clipped and saved in ${resolved.channel}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};