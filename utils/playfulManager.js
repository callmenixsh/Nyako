const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../data/playful.json");

let data = {}; // { [guildId]: true } — playful is server-wide, no channel config

function ensureFile() {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}

function load() {
  try {
    ensureFile();
    const raw = fs.readFileSync(filePath, "utf8");
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

function save() {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function setEnabled(guildId) {
  data[String(guildId)] = true;
  save();
}

function disable(guildId) {
  const key = String(guildId);
  if (!data[key]) return false;
  delete data[key];
  save();
  return true;
}

function isEnabled(guildId) {
  return !!data[String(guildId)];
}

function getEnabledGuildIds() {
  return Object.keys(data);
}

load();

module.exports = {
  setEnabled,
  disable,
  isEnabled,
  getEnabledGuildIds,
  load,
  save,
};