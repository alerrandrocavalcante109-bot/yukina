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

async function getMongoStats(guildId, userId) {
  if (!MONGODB_URI) return null;
  if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, { appName: "Yukina-Economia", serverSelectionTimeoutMS: 10000 });
  await mongoClient.connect();
  const collection = mongoClient.db(MONGODB_DB).collection("economy_balances");
  const docs = await collection.find({ guildId: String(guildId) }, { projection: { userId: 1, balance: 1, _id: 0 } }).toArray();
  if (!docs.length) return null;
  const balances = new Map(docs.map(doc => [String(doc.userId), Math.max(0, Number(doc.balance) || 0)]));
  const balance = balances.has(String(userId)) ? balances.get(String(userId)) : 0;
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
function getLocalStats(data, guildId, userId) {
  const guild = data[String(guildId)] || {};
  const balances = new Map(Object.entries(guild).map(([id, record]) => [String(id), readRecordBalance(record)]));
  if (!balances.size) {
    for (const [id, record] of Object.entries(data)) {
      if (id === String(guildId) || !/^\d{15,22}$/.test(id)) continue;
      balances.set(id, readRecordBalance(record));
    }
  }
  const balance = balances.get(String(userId)) ?? readRecordBalance(data[String(userId)]);
  balances.set(String(userId), balance);
  const sorted = [...balances.values()].sort((a, b) => b - a);
  return { balance, rank: sorted.findIndex(value => value <= balance) + 1, total: sorted.length };
}
function format(value) {
  return Math.floor(value).toLocaleString("pt-BR");
}
async function run({ guild, target, requesterId, reply }) {
  if (!guild) return reply({ content: "❄️ Este comando só pode ser usado dentro de um servidor." });
  let stats;
  try {
    stats = await getMongoStats(guild.id, target.id);
  } catch (error) {
    console.error("[Yukina Economia] Falha ao consultar ranking no MongoDB:", error.message);
  }
  if (!stats) stats = getLocalStats(await readData(), guild.id, target.id);

  const isSelf = target.id === requesterId;
  const subject = isSelf ? "Você" : `**${target.globalName || target.username}**`;
  const balanceLine = isSelf
    ? `💰 Você tem **${format(stats.balance)} ${CURRENCY} (${SYMBOL})**.`
    : `💰 **${target.globalName || target.username}** tem **${format(stats.balance)} ${CURRENCY} (${SYMBOL})**.`;
  const rankLine = `🏆 **Rank no servidor:** #${stats.rank} de ${stats.total} membro(s) no ranking.`;
  return reply({ content: `${balanceLine}\n${rankLine}` });
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
module.exports = { makeCommand };
