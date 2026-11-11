"use strict";

const { PermissionFlagsBits } = require("discord.js");
const { MongoClient } = require("mongodb");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let mongoClient;
let balancesCollection;

async function getBalancesCollection() {
  if (balancesCollection) return balancesCollection;
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, { appName: "Yukina-AddKZ", serverSelectionTimeoutMS: 10000 });
  await mongoClient.connect();
  balancesCollection = mongoClient.db(MONGODB_DB).collection("economy_balances");
  return balancesCollection;
}

function parseAmount(raw) {
  let value = String(raw || "").trim().toLowerCase().replace(/\s+/g, "");
  const suffix = value.match(/^(\d+(?:[.,]\d+)?)\s*([km])$/);
  if (suffix) {
    const base = Number(suffix[1].replace(",", "."));
    const amount = base * (suffix[2] === "k" ? 1_000 : 1_000_000);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }
  value = value.replace(/[.](?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function format(value) {
  return Math.floor(value).toLocaleString("pt-BR");
}

function isAllowed(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.ManageGuild));
}

async function addKz(users, amount) {
  const balances = await getBalancesCollection();
  const now = new Date();
  const results = [];
  for (const user of users) {
    const doc = await balances.findOneAndUpdate(
      { userId: String(user.id) },
      {
        $inc: { balance: amount },
        $set: { updatedAt: now },
        $setOnInsert: { userId: String(user.id), createdAt: now }
      },
      { upsert: true, returnDocument: "after" }
    );
    const balance = Number(doc?.balance ?? doc?.value?.balance) || amount;
    results.push({ user, balance });
  }
  return results;
}

module.exports = {
  aliases: ["addkz", "adicionarkz"],

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só pode ser usado em um servidor.");
    if (!isAllowed(message.member)) {
      return message.reply("❄️ Você precisa da permissão Gerenciar servidor ou Administrador para usar este comando.");
    }

    const mentions = [...message.mentions.users.values()].filter(user => !user.bot);
    const amountText = args.filter(arg => !/^<@!?\d+>$/.test(arg)).join("");
    const amount = parseAmount(amountText);

    if (!mentions.length || !amount) {
      return message.reply("🫧 Use: Yaddkz @membro valor. Exemplos: Yaddkz @membro 5k ou Yaddkz @membro1 @membro2 1.5m");
    }

    try {
      const results = await addKz(mentions, amount);
      const lines = results.map(({ user, balance }) => "• " + user + " — novo saldo: **" + format(balance) + " KZ**");
      return message.reply({
        content: "🌸 **" + format(amount) + " KZ adicionadas para " + results.length + " membro(s)!**\n" + lines.join("\n"),
        allowedMentions: { users: [] }
      });
    } catch (error) {
      console.error("[Yukina addkz] Falha ao adicionar KZ:", error);
      return message.reply("🌙 Não consegui atualizar as carteiras. Verifique a conexão com o banco de dados e tente novamente.");
    }
  }
};
