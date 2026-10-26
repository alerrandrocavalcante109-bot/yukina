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
    "❄️ **Yukina · Refúgio de Neve**",
    "",
    "「 Seu descanso foi registrado com carinho. 」",
    "🌙 **Estado:** Ausente",
    "👤 **Membro:** " + user.username,
    "⏳ **Duração:** " + (record.expiresAt ? remainingLabel(record.expiresAt - Date.now()) : "até você voltar"),
    record.expiresAt ? "🕰️ **Retorno previsto:** " + dateLabel(record.expiresAt) : "",
    "📝 **Motivo:** " + (record.reason || "não informado"),
    "",
    "*Cuide de si. Que a neve proteja seu caminho até o retorno.*"
  ].filter(Boolean).join("\n");
}
async function run(guild, user, durationRaw, reasonRaw, reply, client) {
  installHooks(client);
  const key = keyFor(guild.id, user.id);
  const existing = await getStatus(guild.id, user.id);
  if (existing && !durationRaw && !reasonRaw) {
    active.delete(key);
    await persist(guild.id, user.id, null);
    return reply("🌸 **Yukina · Boas-vindas de volta**\nSua ausência foi encerrada. Que bom ter você novamente!");
  }
  const duration = parseDuration(durationRaw);
  if (durationRaw && !duration) return reply("🫧 **Duração inválida.** Use 30m, 2h, 1d ou 1semana. O limite é de 30 dias.");
  const record = {
    userId: user.id,
    username: user.username,
    reason: String(reasonRaw || "").trim().slice(0, 350),
    startedAt: Date.now(),
    expiresAt: duration && duration.ms ? Date.now() + duration.ms : null
  };
  active.set(key, record);
  await persist(guild.id, user.id, record);
  return reply(statusText(user, record));
}
module.exports = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Registra sua ausência com motivo e previsão de retorno.")
    .setDMPermission(false)
    .addStringOption(option => option.setName("duracao").setDescription("Ex.: 30m, 2h, 1d ou 1semana; vazio = sem prazo").setRequired(false).setMaxLength(20))
    .addStringOption(option => option.setName("motivo").setDescription("Por que ficará ausente?").setRequired(false).setMaxLength(350)),
  name: "afk",
  aliases: ["ausente", "ausentar"],
  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: "❄️ Use este comando dentro de um servidor.", ephemeral: true });
    await run(
      interaction.guild, interaction.user,
      interaction.options.getString("duracao"),
      interaction.options.getString("motivo"),
      text => interaction.reply({ content: text }),
      interaction.client
    );
  },
  async prefixExecute(message, args = [], client) {
    if (!message.guild) return message.reply("❄️ Use este comando dentro de um servidor.");
    let duration = null;
    if (args[0] && parseDuration(args[0])) duration = args.shift();
    const reason = args.join(" ").replace(/^motivo\s*:?\s*/i, "");
    await run(message.guild, message.author, duration, reason, text => message.channel.send(text), client || message.client);
  }
};
