const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const permsManager = require("../utils/permsManager");

function getStatus(guildId) {
  const mode = permsManager.getMode(guildId);
  if (mode === "open") return "Everyone can use VC commands and playful mode.";
  if (mode === "role") {
    const roleId = permsManager.getRoleId(guildId);
    return `Only members with <@&${roleId}> can use VC commands and playful mode.`;
  }
  return "VC commands and playful mode are **disabled** for everyone.";
}

module.exports = {
  name: "permsrole",
  aliases: ["setpermsrole", "vcrole"],

  data: new SlashCommandBuilder()
    .setName("permsrole")
    .setDescription("Control who can use VC commands and playful mode")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("What to do")
        .setRequired(true)
        .addChoices(
          { name: "Open (everyone)", value: "open" },
          { name: "Role-only", value: "set" },
          { name: "Disable", value: "disable" },
          { name: "Status", value: "status" }
        )
    )
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to require (for role-only)")
        .setRequired(false)
    ),

  async execute(message, args = []) {
    if (!message.member.permissions.has("ManageGuild")) {
      return message.reply("You need the **Manage Server** permission to use this.");
    }

    const action = (args[0] || "status").toLowerCase();

    if (action === "status" || action === "view") {
      return message.reply(getStatus(message.guild.id));
    }

    if (action === "disable" || action === "off" || action === "remove" || action === "clear") {
      await permsManager.clear(message.guild.id);
      return message.reply("VC commands and playful mode are now **disabled** for everyone.");
    }

    if (action === "open" || action === "on" || action === "all" || action === "everyone") {
      await permsManager.setOpen(message.guild.id);
      return message.reply("VC commands and playful mode are now **open** to everyone.");
    }

    if (action === "set" || action === "add" || action === "role") {
      const role = message.mentions.roles.first();
      if (!role) {
        return message.reply("Mention a role. Example: `nya!permsrole set @VC Admin`");
      }
      await permsManager.setRoleId(message.guild.id, role.id);
      return message.reply(`VC commands and playful mode now require the ${role} role.`);
    }

    return message.reply("Usage: `nya!permsrole open` / `nya!permsrole set @role` / `nya!permsrole disable`");
  },

  async executeInteraction(interaction) {
    if (!interaction.member.permissions.has("ManageGuild")) {
      return interaction.reply({
        content: "You need the **Manage Server** permission to use this.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const action = interaction.options.getString("action", true);

    if (action === "status") {
      return interaction.reply({ content: getStatus(interaction.guild.id), flags: MessageFlags.Ephemeral });
    }

    if (action === "disable") {
      await permsManager.clear(interaction.guild.id);
      return interaction.reply({
        content: "VC commands and playful mode are now **disabled** for everyone.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === "open") {
      await permsManager.setOpen(interaction.guild.id);
      return interaction.reply({
        content: "VC commands and playful mode are now **open** to everyone.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === "set") {
      const role = interaction.options.getRole("role");
      if (!role) {
        return interaction.reply({
          content: "Provide a role. Example: `/permsrole action:set role:@VC Admin`",
          flags: MessageFlags.Ephemeral,
        });
      }
      await permsManager.setRoleId(interaction.guild.id, role.id);
      return interaction.reply({
        content: `VC commands and playful mode now require the ${role} role.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
