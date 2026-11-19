"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { SlashCommandBuilder } = require("discord.js");
const storage = require("../system-storage").forSystem("afk-status");
const DATA_FILE = path.join(process.cwd(), "data", "afk-status.json");
const MAX_MS = 30 * 86400000;
const active = new Map();
const hooked = new WeakSet();
let localData;

function loadLocal() {
  if (localData) return localData;
  try { localData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { localData = {}; }
  if (!localData || typeof localData !== "object" || Array.isArray(localData)) localData = {};
  return localData;
}
function saveLocal() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(localData || {}, null, 2));
    fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
  } catch (error) { console.error("[AFK] Falha no fallback local:", error.message); }
}
function parseDuration(raw) {
  if (!raw) return { ms: 0 };
  const match = String(raw).trim().toLowerCase().match(/^(\d+)(m|min|minuto|minutos|h|hr|hora|horas|d|dia|dias|w|semana|semanas)$/);
  if (!match) return null;
  const n = Number(match[1]), unit = match[2];
  const factor = /^(m|min|minuto|minutos)$/.test(unit) ? 60000
    : /^(h|hr|hora|horas)$/.test(unit) ? 3600000
    : /^(d|dia|dias)$/.test(unit) ? 86400000 : 604800000;
  const ms = n * factor;
  return Number.isSafeInteger(ms) && ms >= 60000 && ms <= MAX_MS ? { ms } : null;
}
function remainingLabel(ms) {
  if (ms <= 0) return "menos de 1 min";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return minutes + " min";
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return hours + " h";
  return Math.ceil(hours / 24) + " dia(s)";
}
function dateLabel(ms) {
  return new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function keyFor(guildId, userId) { return String(guildId) + ":" + String(userId); }
async function persist(guildId, userId, record) {
  const key = keyFor(guildId, userId);
  localData = loadLocal();
  if (record) localData[key] = record; else delete localData[key];
  saveLocal();
  try {
    if (record) await storage.set(guildId, "member", record, userId);
    else await storage.delete(guildId, "member", userId);
  } catch (error) { console.warn("[AFK] MongoDB indisponível; usando fallback local:", error.message); }
}
async function getStatus(guildId, userId) {
  const key = keyFor(guildId, userId);
  if (active.has(key)) {
    const cached = active.get(key);
    if (!cached.expiresAt || cached.expiresAt > Date.now()) return cached;
    active.delete(key);
    await persist(guildId, userId, null);
    return null;
  }
  try {
    const record = await storage.get(guildId, "member", null, userId);
    if (record && (!record.expiresAt || record.expiresAt > Date.now())) { active.set(key, record); return record; }
    if (record) await storage.delete(guildId, "member", userId);
  } catch {}
  const local = loadLocal()[key];
  if (local && (!local.expiresAt || local.expiresAt > Date.now())) { active.set(key, local); return local; }
  if (local) { delete loadLocal()[key]; saveLocal(); }
  return null;
}
function installHooks(client) {
  if (hooked.has(client)) return;
  hooked.add(client);
  client.on("messageCreate", async message => {
    if (!message.guild || message.author.bot) return;
    const own = await getStatus(message.guild.id, message.author.id);
    if (own) {
      active.delete(keyFor(message.guild.id, message.author.id));
      await persist(message.guild.id, message.author.id, null);
      await message.reply({ content: "🌸 **Yukina · Boas-vindas de volta**\nSua ausência foi encerrada automaticamente. Que bom ter você novamente sob o luar!", allowedMentions: { repliedUser: false } }).catch(() => {});
    }
    const mentions = [...message.mentions.users.values()].filter(user => !user.bot && user.id !== message.author.id).slice(0, 3);
    for (const user of mentions) {
      const record = await getStatus(message.guild.id, user.id);
      if (!record) continue;
      const reason = record.reason ? "\n📝 **Motivo:** " + record.reason : "";
      const until = record.expiresAt ? "\n🕰️ **Retorno previsto:** " + dateLabel(record.expiresAt) : "";
      const duration = record.expiresAt ? remainingLabel(record.expiresAt - Date.now()) + " restantes" : "sem prazo definido";
      await message.reply({
        content: "❄️ **Yukina · Refúgio de Neve**\n「 " + user.username + " está em um breve descanso. 」" + reason +
          "\n⏳ **Duração:** " + duration + until +
          "\n\n*Deixe uma estrelinha de paciência; a Yukina avisa quando houver retorno.*",
        allowedMentions: { repliedUser: false, parse: [] }
      }).catch(() => {});
    }
  });
}
function statusText(user, record) {
  return [
    "[ ausência ativa ]",
    "**Usuario:** " + user.toString(),
    record.reason ? "**motivo:**\\n### " + record.reason : "",
    "O estado de ausente está ativo, para desativar basta mandar algo em um canal que tenho permissão de acessar."
  ].filter(Boolean).join("\\n");
}
