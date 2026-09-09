const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const filePath = path.join(__dirname, "../data/playful.json");

let data = {}; // { [guildId]: true } — playful is server-wide, no channel config

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
    const parsed = raw ? JSON.parse(raw) : {};
    data = {};
    // Tolerate the old { guildId: { channelId } } shape — any present key = on.
    for (const [guildId, value] of Object.entries(parsed)) {
      if (value) data[String(guildId)] = true;
    }
  } catch (err) {
    console.error("Failed to load playful config:", err);
    data = {};
  }
}

async function save() {
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function setEnabled(guildId) {
  data[String(guildId)] = true;
  await save();
}

async function disable(guildId) {
  const key = String(guildId);
  if (!data[key]) return false;
  delete data[key];
  await save();
  return true;
}

function isEnabled(guildId) {
  return !!data[String(guildId)];
}

function getEnabledGuildIds() {
  return Object.keys(data);
}

async function init() {
  await load();
}

module.exports = {
  init,
  setEnabled,
  disable,
  isEnabled,
  getEnabledGuildIds,
  load,
  save,
};