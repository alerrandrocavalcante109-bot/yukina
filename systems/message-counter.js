"use strict";

const storage = require("../system-storage").forSystem("message-counts");
const TIME_ZONE = "America/Sao_Paulo";
const hooked = new WeakSet();

function dateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function shiftDateKey(key, days) {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStartKey(key) {
  const weekday = dateFromKey(key).getUTCDay();
  return shiftDateKey(key, -(weekday === 0 ? 6 : weekday - 1));
}

async function increment(guildId, userId, key) {
  const collection = await require("../system-storage").getCollection();
  const filter = { system: "message-counts", guildId: String(guildId), userId: String(userId), key };
  const now = new Date();
  await collection.updateOne(
    filter,
    {
      $inc: { "value.count": 1 },
      $set: { ...filter, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
}

async function recordMessage(message) {
  if (!message.guild || !message.author || message.author.bot || message.webhookId) return;
  const today = dateKey();
  await increment(message.guild.id, message.author.id, "day:" + today);
  await increment(message.guild.id, message.author.id, "total");
}

async function getStats(guildId, userId) {
  const today = dateKey();
  const weekStart = weekStartKey(today);
  const monthStart = today.slice(0, 7) + "-01";
  const records = await storage.list(guildId, { userId, limit: 2000 });
  let day = 0, week = 0, month = 0, total = 0;
  for (const item of records) {
    const count = Math.max(0, Number(item.value?.count) || 0);
    if (item.key === "total") total = count;
    if (!item.key.startsWith("day:")) continue;
    const key = item.key.slice(4);
    if (key === today) day += count;
    if (key >= weekStart && key <= today) week += count;
    if (key >= monthStart && key <= today) month += count;
  }
  return { day, week, month, total, today, weekStart, monthStart };
}

function install(client) {
  if (hooked.has(client)) return;
  hooked.add(client);
  client.on("messageCreate", message => {
    recordMessage(message).catch(error => {
      console.error("[Mensagens] Não foi possível registrar uma mensagem:", error.message);
    });
  });
  console.log("[Mensagens] Contagem diária, semanal, mensal e total ativada (horário de Brasília).");
}

module.exports = { install, getStats, dateKey, weekStartKey };
