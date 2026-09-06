const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const https = require("https");

function uniqueUsers(users) {
  return [...new Map(users.map((user) => [user.id, user])).values()];
}

function getUsersFromMessage(message) {
  return uniqueUsers([...message.mentions.users.values()]).slice(0, 4);
}

function getUsersFromInteraction(interaction) {
  const users = [];
  for (let i = 1; i <= 4; i++) {
    const user = interaction.options.getUser(`user${i}`);
    if (user) users.push(user);
  }
  return uniqueUsers(users).slice(0, 4);
}

// Downloads straight into memory — no file ever touches disk.
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(downloadBuffer(res.headers.location));
        }

        if (res.statusCode !== 200) {
          res.resume(); // drain so the socket can close cleanly
          return reject(new Error(`Failed to download: ${res.statusCode}`));
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function avatarExtension(user) {
  // Animated avatar hashes are prefixed with "a_" — no custom avatar means
  // `user.avatar` is null and displayAvatarURL falls back to the default one.
  return user.avatar && user.avatar.startsWith("a_") ? "gif" : "png";
}

async function saveAvatars(users) {
  const attachments = [];

  for (const user of users) {
    const ext = avatarExtension(user);
    const url = user.displayAvatarURL({ extension: ext, size: 1024 });
    const buffer = await downloadBuffer(url);
    attachments.push(new AttachmentBuilder(buffer, { name: `${user.username}.${ext}` }));
  }

  return attachments;
}

module.exports = {
  name: "savepfp",
  aliases: ["pfp", "saveavatar", "saveavatars"],

  data: new SlashCommandBuilder()
    .setName("savepfp")
    .setDescription("Save up to 4 users' profile pictures")
    .addUserOption((o) => o.setName("user1").setDescription("User 1").setRequired(false))
    .addUserOption((o) => o.setName("user2").setDescription("User 2").setRequired(false))
    .addUserOption((o) => o.setName("user3").setDescription("User 3").setRequired(false))
    .addUserOption((o) => o.setName("user4").setDescription("User 4").setRequired(false)),

  async execute(message) {
    const users = getUsersFromMessage(message);

    if (!users.length) {
      return message.reply("Mention up to 4 users.");
    }

    try {
      const attachments = await saveAvatars(users);
      return message.reply({
        content: `${users.map((u) => `${u}`).join(", ")}`,
        files: attachments,
      });
    } catch (err) {
      console.error("savepfp prefix error:", err);
      return message.reply("Failed to save one or more profile pictures.");
    }
  },

  async executeInteraction(interaction) {
    const users = getUsersFromInteraction(interaction);

    if (!users.length) {
      return interaction.reply({
        content: "Pick up to 4 users.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      const attachments = await saveAvatars(users);
      return interaction.editReply({
        content: `${users.map((u) => `${u}`).join(", ")}`,
        files: attachments,
      });
    } catch (err) {
      console.error("savepfp interaction error:", err);
      return interaction.editReply("Failed to save one or more profile pictures.");
    }
  },
};
