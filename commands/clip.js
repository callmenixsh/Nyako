const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageFlags,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const https = require("https");

const configPath = path.join(__dirname, "../clipConfig.json");

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({}));
  }

  return JSON.parse(fs.readFileSync(configPath));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

// NOTE: getImage/wrapText below aren't called anywhere in this file (looks
// like leftovers from a canvas-based screenshot feature — getImage also
// calls loadImage() which isn't imported here). Left untouched since you
// didn't ask about them, but flagging in case they're meant to be wired up
// or can be deleted.
function getImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const data = [];

      res.on("data", (chunk) => {
        data.push(chunk);
      });

      res.on("end", async () => {
        try {
          const img = await loadImage(Buffer.concat(data));

          resolve(img);
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(" ");
  let line = "";
  let lines = [];

  for (const word of words) {
    const test = line + word + " ";

    if (ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word + " ";
    } else {
      line = test;
    }
  }

  lines.push(line);

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);

    lines[maxLines - 1] = lines[maxLines - 1].trimEnd() + "...";
  }

  lines.forEach((line, i) => {
    ctx.fillText(line.trimEnd(), x, y + i * lineHeight);
  });
}

/**
 * Build the embed + "Jump to Message" button for a clipped message.
 * Shared by both the reply-based prefix command and the context menu command.
 */
function buildClipPayload(target, invokerUser) {
  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setAuthor({
      name: target.author.tag,
      iconURL: target.author.displayAvatarURL(),
    })
    .setDescription(target.content || "*No text content*")
    .setTimestamp(target.createdTimestamp);

  if (target.attachments.size) {
    const firstAttachment = target.attachments.first();

    if (firstAttachment.contentType?.startsWith("image/")) {
      embed.setImage(firstAttachment.url);
    } else {
      embed.addFields({
        name: "📎 Attachment",
        value: firstAttachment.url,
      });
    }
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Jump to Message")
      .setStyle(ButtonStyle.Link)
      .setURL(target.url)
  );

  return {
    content: `📸 Clipped by ${invokerUser}`,
    embeds: [embed],
    components: [row],
  };
}

/**
 * Look up the configured clip channel for a guild.
 * @returns {{ ok: true, channel } | { ok: false, reason: string }}
 */
function resolveClipChannel(guild) {
  const config = loadConfig();
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

  // ----- Prefix command: "nya!clip" as a reply to a message -----
  async execute(message, args) {
    const config = loadConfig();

    // ---------------- SETUP ----------------

    if (args[0] === "setup") {
      const channel = message.mentions.channels.first();

      if (!channel) {
        return message.reply(
          "Mention a channel.\nExample: `nya!clip setup #clips`",
        );
      }

      config[message.guild.id] = {
        channelId: channel.id,
      };

      saveConfig(config);

      return message.reply(`Clip channel set to ${channel}`);
    }

    // ---------------- CHECK SETUP ----------------

    const resolved = resolveClipChannel(message.guild);

    if (!resolved.ok) {
      return message.reply(resolved.reason);
    }

    // ---------------- MESSAGE CHECK ----------------

    if (!message.reference) {
      return message.reply("Reply to a message to clip it.");
    }

    const target = await message.channel.messages.fetch(
      message.reference.messageId,
    );

    await resolved.channel.send(buildClipPayload(target, message.author));

    return message.reply(`📸 Clipped and saved in ${resolved.channel}`);
  },

  // ----- Message context menu command: right-click → Apps → Clip Message -----
  async executeContextMenu(interaction) {
    const resolved = resolveClipChannel(interaction.guild);

    if (!resolved.ok) {
      return interaction.reply({ content: resolved.reason, flags: MessageFlags.Ephemeral });
    }

    const target = interaction.targetMessage;

    await resolved.channel.send(buildClipPayload(target, interaction.user));

    return interaction.reply({
      content: `📸 Clipped and saved in ${resolved.channel}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
