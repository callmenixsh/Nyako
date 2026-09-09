const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const filePath = path.join(__dirname, "../data/marriages.json");

let data = {
  marriages: [],
  proposals: [],
  divorces: [],
};

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

function normalize(raw) {
  return {
    marriages: Array.isArray(raw.marriages) ? raw.marriages : [],
    proposals: Array.isArray(raw.proposals) ? raw.proposals : [],
    divorces: Array.isArray(raw.divorces) ? raw.divorces : [],
  };
}

async function load() {
  try {
    await ensureFile();
    const raw = await fsp.readFile(filePath, "utf8");
    data = normalize(raw ? JSON.parse(raw) : {});
  } catch (err) {
    console.error("Failed to load marriages:", err);
    data = {
      marriages: [],
      proposals: [],
      divorces: [],
    };
  }
}

async function save() {
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
}

function getMarriage(userId) {
  return data.marriages.find((m) => m.users.some((u) => u.id === userId)) || null;
}

function isMarried(userId) {
  return !!getMarriage(userId);
}

function getPartner(userId) {
  const marriage = getMarriage(userId);
  if (!marriage) return null;
  return marriage.users.find((u) => u.id !== userId) || null;
}

async function marry(user1, user2) {
  data.marriages.push({
    users: [
      {
        id: user1.id,
        name: user1.name,
        avatar: user1.avatar,
      },
      {
        id: user2.id,
        name: user2.name,
        avatar: user2.avatar,
      },
    ],
    marriedAt: Math.floor(Date.now() / 1000),
  });

  await save();
}

async function divorce(userId) {
  const index = data.marriages.findIndex((m) =>
    m.users.some((u) => u.id === userId)
  );

  if (index === -1) return false;

  data.marriages.splice(index, 1);
  await save();
  return true;
}

function hasActiveProposal(userId) {
  return data.proposals.some((p) => p.user1 === userId || p.user2 === userId);
}

async function createProposal(user1, user2) {
  data.proposals.push({
    user1,
    user2,
    at: Date.now(),
  });
  await save();
}

async function removeProposal(user1, user2) {
  data.proposals = data.proposals.filter(
    (p) =>
      !(
        (p.user1 === user1 && p.user2 === user2) ||
        (p.user1 === user2 && p.user2 === user1)
      )
  );
  await save();
}

function hasActiveDivorce(userId) {
  return data.divorces.some((d) => d.user1 === userId || d.user2 === userId);
}

async function createDivorce(user1, user2) {
  data.divorces.push({
    user1,
    user2,
    at: Date.now(),
  });
  await save();
}

async function removeDivorce(user1, user2) {
  data.divorces = data.divorces.filter(
    (d) =>
      !(
        (d.user1 === user1 && d.user2 === user2) ||
        (d.user1 === user2 && d.user2 === user1)
      )
  );
  await save();
}

function getAllMarriages() {
  return data.marriages;
}

function getMarriageCount() {
  return data.marriages.length;
}

async function updateMarriageUser(userId, updates) {
  const marriage = getMarriage(userId);
  if (!marriage) return false;

  const user = marriage.users.find((u) => u.id === userId);
  if (!user) return false;

  if (updates.name) user.name = updates.name;
  if (updates.avatar) user.avatar = updates.avatar;

  await save();
  return true;
}

async function init() {
  await load();
}

module.exports = {
  init,
  load,
  save,
  getMarriage,
  isMarried,
  getPartner,
  marry,
  divorce,
  hasActiveProposal,
  createProposal,
  removeProposal,
  hasActiveDivorce,
  createDivorce,
  removeDivorce,
  getAllMarriages,
  getMarriageCount,
  updateMarriageUser,
};