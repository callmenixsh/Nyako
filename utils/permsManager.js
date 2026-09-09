const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const filePath = path.join(__dirname, "../data/perms.json");

let data = {}; // { [guildId]: "open" | roleId }

async function ensureFile() {
  const dir = path.dirname(filePath);
  try {
    await fsp.access(dir);
  } catch {
    await fsp.mkdir(dir, { recursive: true });
  }
  try {
    await fsp.access(filePath);
  } catch {
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
  }
}

async function load() {
  try {
    await ensureFile();
    const raw = await fsp.readFile(filePath, "utf8");
    data = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to load perms config:", err);
    data = {};
  }
}

async function save() {
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Returns "open", a roleId string, or null (blocked).
function getConfig(guildId) {
  return data[String(guildId)] || null;
}

function getMode(guildId) {
  const val = data[String(guildId)];
  if (val === "open") return "open";
  if (typeof val === "string" && val) return "role";
  return "blocked";
}

function getRoleId(guildId) {
  const val = data[String(guildId)];
  return typeof val === "string" && val !== "open" ? val : null;
}

async function setOpen(guildId) {
  data[String(guildId)] = "open";
  await save();
}

async function setRoleId(guildId, roleId) {
  data[String(guildId)] = roleId;
  await save();
}

async function clear(guildId) {
  delete data[String(guildId)];
  await save();
}

async function init() {
  await load();
}

// Returns null if allowed, or a rejection message string if denied.
function checkMember(member) {
  const config = getConfig(member.guild.id);

  // No config = blocked by default
  if (!config) return "VC commands and playful mode are **disabled** on this server. A member with Manage Server can run `/permsrole open` or `/permsrole set @role` to enable them.";

  // Managers always pass
  if (member.permissions.has("ManageGuild")) return null;

  // Open mode — everyone allowed
  if (config === "open") return null;

  // Role mode — check role
  if (member.roles.cache.has(config)) return null;
  return "You need the <@&" + config + "> role to use this command.";
}

module.exports = {
  init,
  getConfig,
  getMode,
  getRoleId,
  setOpen,
  setRoleId,
  clear,
  checkMember,
};
