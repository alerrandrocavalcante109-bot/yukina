"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { SlashCommandBuilder } = require("discord.js");
const { MongoClient } = require("mongodb");

const FILE = path.join(process.cwd(), "data", "economia.json");
const CURRENCY = "Kizunas";
const SYMBOL = "KZ";
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let mongoClient;
let cache;

async function getMongoStats(userId) {
  if (!MONGODB_URI) return null;
  if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, { appName: "Yukina-Economia", serverSelectionTimeoutMS: 10000 });
  await mongoClient.connect();
  const collection = mongoClient.db(MONGODB_DB).collection("economy_balances");
  const docs = await collection.find({}, { projection: { userId: 1, balance: 1, _id: 0 } }).toArray();
  const balances = new Map(docs.map(doc => [String(doc.userId), Math.max(0, Number(doc.balance) || 0)]));
  const balance = balances.get(String(userId)) || 0;
  balances.set(String(userId), balance);
  const sorted = [...balances.values()].sort((a, b) => b - a);
  return { balance, rank: sorted.findIndex(value => value <= balance) + 1, total: sorted.length };
}
async function readData() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8"));
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code !== "ENOENT") console.error("[Yukina Economia] Falha ao ler saldo:", error.message);
    cache = {};
  }
  return cache;
}
function readRecordBalance(record) {
  const value = typeof record === "number" ? record : (record?.balance ?? record?.saldo ?? record?.wallet ?? record?.kizunas ?? 0);
  const balance = Number(value);
  return Number.isFinite(balance) && balance > 0 ? balance : 0;
}
async function getEconomyRanking(localUserIds = null) {
  const allowed = Array.isArray(localUserIds) ? new Set(localUserIds.map(String)) : null;
  if (MONGODB_URI) {
    try {
      if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, { appName: "Yukina-Economia", serverSelectionTimeoutMS: 10000 });
      await mongoClient.connect();
      const docs = await mongoClient.db(MONGODB_DB).collection("economy_balances")
        .find({}, { projection: { userId: 1, balance: 1, _id: 0 } }).toArray();
      if (docs.length) {
        return docs.map(doc => ({
          userId: String(doc.userId),
          balance: Math.max(0, Number(doc.balance) || 0)
        })).filter(doc => /^\\d{15,22}$/.test(doc.userId) && doc.balance > 0 && (!allowed || allowed.has(doc.userId)))
          .sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));
      }
    } catch (error) {
      console.error("[Yukina Economia] Falha ao carregar ranking global:", error.message || error);
    }
  }

  // Compatibilidade temporária com o JSON antigo: servidor -> usuário -> saldo.
  const data = await readData();
  const flattened = new Map();
  for (const [key, value] of Object.entries(data)) {
    if (/^\\d{15,22}$/.test(key)) {
      flattened.set(key, Math.max(flattened.get(key) || 0, readRecordBalance(value)));
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [userId, record] of Object.entries(value)) {
        if (!/^\\d{15,22}$/.test(userId)) continue;
        flattened.set(userId, Math.max(flattened.get(userId) || 0, readRecordBalance(record)));
      }
    }
  }
  return [...flattened.entries()].map(([userId, balance]) => ({ userId, balance }))
    .filter(doc => doc.balance > 0 && (!allowed || allowed.has(doc.userId)))
    .sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));
}
function format(value) {
  return Math.floor(value).toLocaleString("pt-BR");
}
async function run({ guild, target, requesterId, reply }) {
  if (!guild) return reply({ content: "❄️ Este comando só pode ser usado dentro de um servidor." });
  let stats;
  try {
    stats = await getMongoStats(target.id);
  } catch (error) {
    console.error("[Yukina Economia] Falha ao consultar ranking no MongoDB:", error.message);
  }
  if (!stats) {
    const ranking = await getEconomyRanking();
    const existing = ranking.find(entry => entry.userId === String(target.id));
    const balance = existing?.balance || 0;
    const rank = existing ? ranking.findIndex(entry => entry.userId === String(target.id)) + 1 : ranking.length + 1;
    stats = { balance, rank, total: ranking.length + (existing ? 0 : 1) };
  }

  const isSelf = target.id === requesterId;
  const balanceLine = isSelf
    ? `💰 Você tem **${format(stats.balance)} ${CURRENCY} (${SYMBOL})**.`
    : `💰 **${target.globalName || target.username}** tem **${format(stats.balance)} ${CURRENCY} (${SYMBOL})**.`;
  const rankLine = stats.balance > 0
    ? `\n🏆 **Rank global de KZ:** #${stats.rank} de ${stats.total} usuário(s) no ranking.`
    : "";
  return reply({ content: `${balanceLine}${rankLine}` });
}
function makeCommand(name, description) {
  return {
    data: new SlashCommandBuilder().setName(name).setDescription(description)
      .addUserOption(option => option.setName("usuario").setDescription("Veja o saldo de outra pessoa").setRequired(false)),
    async execute(interaction) {
      const target = interaction.options.getUser("usuario") || interaction.user;
      await run({ guild: interaction.guild, target, requesterId: interaction.user.id, reply: payload => interaction.reply(payload) });
    },
    async prefixExecute(message, args = []) {
      const target = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0].replace(/[<@!>]/g, "")).catch(() => null) : null) || message.author;
      await run({ guild: message.guild, target, requesterId: message.author.id, reply: payload => message.reply(payload) });
    }
  };
}
module.exports = { makeCommand, getEconomyRanking };
