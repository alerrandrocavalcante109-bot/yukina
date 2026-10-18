"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { EmbedBuilder } = require("discord.js");

const FILE = path.join(process.cwd(), "data", "ranks.json");
const COOLDOWN = 60_000;
const XP_MIN = 12;
const XP_MAX = 22;
const COLOR = 0xA7D8F0;
const cooldowns = new Map();
let cache;
let writes = Promise.resolve();

function xpForLevel(level) {
  const n = Math.max(0, Math.floor(Number(level) || 0));
  return 5 * n * n + 50 * n + 100;
}
function levelFromXp(total) {
  let level = 0;
  const xp = Math.max(0, Number(total) || 0);
  while (xp >= xpForLevel(level)) level++;
  return Math.max(0, level - 1);
}
function normalize(record = {}) {
  const xp = Math.max(0, Math.floor(Number(record.xp) || 0));
  return { xp, level: levelFromXp(xp), messages: Math.max(0, Math.floor(Number(record.messages) || 0)), lastMessageAt: Math.max(0, Number(record.lastMessageAt) || 0) };
}
async function readData() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8"));
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code !== "ENOENT") console.error("[Yukina Rank] Erro ao ler dados:", error.message);
    cache = {};
  }
  return cache;
}
function persist() {
  writes = writes.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const temp = FILE + ".tmp";
    await fs.writeFile(temp, JSON.stringify(cache || {}, null, 2), "utf8");
    await fs.rename(temp, FILE);
  }).catch(error => console.error("[Yukina Rank] Erro ao salvar dados:", error.message));
  return writes;
}
async function getRankData(guildId, userId) {
  if (!guildId || !userId) throw new TypeError("guildId e userId são obrigatórios.");
  const data = await readData();
  return normalize(data[String(guildId)]?.[String(userId)] || {});
}
async function processMessage(message, options = {}) {
  if (!message?.guild || !message?.author || message.author.bot) return { awarded: false, reason: "ignored" };
  const key = message.guild.id + ":" + message.author.id;
  const now = Date.now();
  if (now - (cooldowns.get(key) || 0) < COOLDOWN) return { awarded: false, reason: "cooldown" };
  cooldowns.set(key, now);
  const min = Number.isInteger(options.xpMin) ? Math.max(1, options.xpMin) : XP_MIN;
  const max = Number.isInteger(options.xpMax) ? Math.max(min, options.xpMax) : XP_MAX;
  const earned = Math.floor(Math.random() * (max - min + 1)) + min;
  const data = await readData();
  const g = String(message.guild.id), u = String(message.author.id);
  if (!data[g] || typeof data[g] !== "object") data[g] = {};
  const old = normalize(data[g][u] || {});
  const updated = normalize({ xp: old.xp + earned, messages: old.messages + 1, lastMessageAt: now });
  data[g][u] = { ...updated, lastMessageAt: now };
  await persist();
  return { awarded: true, earned, previousLevel: old.level, level: updated.level, leveledUp: updated.level > old.level, ...updated };
}
async function getLeaderboard(guildId, limit = 10) {
  if (!guildId) throw new TypeError("guildId é obrigatório.");
  const data = await readData();
  return Object.entries(data[String(guildId)] || {})
    .map(([userId, record]) => ({ userId, ...normalize(record) }))
    .sort((a, b) => b.xp - a.xp || b.messages - a.messages)
    .slice(0, Math.max(1, Math.min(25, Math.floor(Number(limit) || 10))));
}
async function getUserPosition(guildId, userId) {
  const board = await getLeaderboard(guildId, 25);
  const index = board.findIndex(entry => entry.userId === String(userId));
  return index < 0 ? null : index + 1;
}
function createRankEmbed({ user, rankData, position = null }) {
  const xp = Math.max(0, Number(rankData?.xp) || 0);
  const level = levelFromXp(xp), base = xpForLevel(level), next = xpForLevel(level + 1);
  const progress = Math.max(0, xp - base), needed = Math.max(1, next - base);
  const percent = Math.max(0, Math.min(100, Math.floor(progress / needed * 100)));
  const filled = Math.round(percent / 10);
  const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
  const name = user?.globalName || user?.username || "Aventureiro";
  const embed = new EmbedBuilder().setColor(COLOR)
    .setAuthor({ name: "Yukina · Registro de jornada", ...(user?.displayAvatarURL ? { iconURL: user.displayAvatarURL({ size: 128 }) } : {}) })
    .setTitle("❄️ Perfil de experiência")
    .setDescription("A jornada de **" + name + "** sob o luar de Yukina.")
    .addFields(
      { name: "✧ Nível", value: "**" + level + "**", inline: true },
      { name: "❄️ XP total", value: "**" + xp.toLocaleString("pt-BR") + "**", inline: true },
      { name: "🏅 Posição", value: position ? "**#" + position + "**" : "Ainda sem posição", inline: true },
      { name: "🌙 Progresso para o nível " + (level + 1), value: bar + " **" + percent + "%**\n" + progress.toLocaleString("pt-BR") + " / " + needed.toLocaleString("pt-BR") + " XP" },
      { name: "💬 Mensagens contabilizadas", value: String(Math.max(0, Number(rankData?.messages) || 0)), inline: true }
    );
  if (user?.displayAvatarURL) embed.setThumbnail(user.displayAvatarURL({ size: 256 }));
  return embed.setFooter({ text: "Yukina · Continue participando para evoluir" }).setTimestamp();
}
function createLeaderboardEmbed(entries, resolveUser = id => "<@" + id + ">") {
  const lines = entries.length ? entries.map((entry, i) => {
    const medal = ["🥇", "🥈", "🥉"][i] || "**" + (i + 1) + ".**";
    return medal + " " + resolveUser(entry.userId) + " — **Nv. " + entry.level + "** · " + entry.xp.toLocaleString("pt-BR") + " XP";
  }) : ["Ainda não há registros de experiência neste servidor. A primeira mensagem pode iniciar essa jornada!"];
  return new EmbedBuilder().setColor(COLOR).setAuthor({ name: "Yukina · Quadro de honra" })
    .setTitle("🌸 Ranking de experiência").setDescription(lines.join("\n").slice(0, 4000))
    .setFooter({ text: "A experiência é contabilizada por servidor" }).setTimestamp();
}
module.exports = { XP_COOLDOWN_MS: COOLDOWN, xpForLevel, levelFromXp, getRankData, getLeaderboard, getUserPosition, processMessage, createRankEmbed, createLeaderboardEmbed, clearCooldowns: () => cooldowns.clear() };
