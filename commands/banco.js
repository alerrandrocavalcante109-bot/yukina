"use strict";

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { MongoClient } = require("mongodb");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let mongoClient = null;
let walletCollection = null;
let bankCollection = null;
let ledgerCollection = null;

async function getCollections() {
  if (walletCollection && bankCollection) return { walletCollection, bankCollection };
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, {
      appName: "Yukina-CentralBank",
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
  }
  await mongoClient.connect();
  const db = mongoClient.db(MONGODB_DB);
  walletCollection = db.collection("economy_balances");
  bankCollection = db.collection("yukina_bank_accounts");
  ledgerCollection = db.collection("yukina_bank_transactions");
  await Promise.all([
    walletCollection.createIndex({ guildId: 1, userId: 1 }, { unique: true, name: "unique_guild_user_balance" }),
    bankCollection.createIndex({ guildId: 1, userId: 1 }, { unique: true, name: "unique_guild_user_bank_account" }),
    ledgerCollection.createIndex({ guildId: 1, userId: 1, createdAt: -1 }, { name: "bank_ledger_user_history" }),
  ]);
  return { walletCollection, bankCollection };
}

function format(value) {
  return Math.floor(Number(value) || 0).toLocaleString("pt-BR");
}

function parseAmount(input, available, allowAll = false) {
  const raw = String(input ?? "").trim().toLowerCase().replace(/,/g, ".");
  if (allowAll && raw === "all") return Math.floor(Math.max(0, available));
  const match = raw.match(/^(\d+(?:\.\d+)?)(k|m|b|t)?$/i);
  if (!match) return NaN;
  const multiplier = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(match[2] || "").toLowerCase()] || 1;
  const amount = Number(match[1]) * multiplier;
  if (!Number.isSafeInteger(Math.floor(amount)) || amount < 1 || amount > Number.MAX_SAFE_INTEGER) return NaN;
  return Math.floor(amount);
}

async function getAccountBalances(guildId, userId) {
  const { walletCollection: wallet, bankCollection: bank } = await getCollections();
  const filter = { guildId: String(guildId), userId: String(userId) };
  const [walletDoc, bankDoc] = await Promise.all([
    wallet.findOne(filter, { projection: { balance: 1 } }),
    bank.findOne(filter, { projection: { balance: 1 } }),
  ]);
  return {
    wallet: Math.max(0, Number(walletDoc?.balance) || 0),
    bank: Math.max(0, Number(bankDoc?.balance) || 0),
  };
}

async function moveMoney({ guildId, userId, action, amountInput }) {
  const { walletCollection: wallet, bankCollection: bank } = await getCollections();
  const filter = { guildId: String(guildId), userId: String(userId) };
  const before = await getAccountBalances(guildId, userId);
  const source = action === "depositar" ? before.wallet : before.bank;
  const amount = parseAmount(amountInput, source, true);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return { ok: false, message: "💴 Informe um valor válido, como 5000, 1.5k, 2m ou all." };
  }
  if (source < amount) {
    return {
      ok: false,
      message: action === "depositar"
        ? "🍃 Você não tem KZ suficientes na carteira para esse depósito.\n**Carteira:** " + format(before.wallet) + " KZ"
        : "🍃 Você não tem KZ suficientes no banco para esse saque.\n**Banco:** " + format(before.bank) + " KZ",
    };
  }

  const session = mongoClient.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      if (action === "depositar") {
        const debit = await wallet.updateOne(
          { ...filter, balance: { $gte: amount } },
          { $inc: { balance: -amount }, $set: { updatedAt: now } },
          { session }
        );
        if (debit.modifiedCount !== 1) throw new Error("SOURCE_BALANCE_CHANGED");
        await bank.updateOne(
          filter,
          { $inc: { balance: amount }, $set: { updatedAt: now }, $setOnInsert: { guildId: filter.guildId, userId: filter.userId, createdAt: now } },
          { upsert: true, session }
        );
      } else {
        const debit = await bank.updateOne(
          { ...filter, balance: { $gte: amount } },
          { $inc: { balance: -amount }, $set: { updatedAt: now } },
          { session }
        );
        if (debit.modifiedCount !== 1) throw new Error("SOURCE_BALANCE_CHANGED");
        await wallet.updateOne(
          filter,
          { $inc: { balance: amount }, $set: { updatedAt: now }, $setOnInsert: { guildId: filter.guildId, userId: filter.userId, createdAt: now } },
          { upsert: true, session }
        );
      }
      await ledgerCollection.insertOne({
        guildId: filter.guildId,
        userId: filter.userId,
        type: action,
        amount,
        createdAt: now,
      }, { session });
    });
  } catch (error) {
    if (error.message === "SOURCE_BALANCE_CHANGED") {
      return { ok: false, message: "🌙 Seu saldo mudou durante a operação. Confira os saldos e tente novamente." };
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return { ok: true, amount, balances: await getAccountBalances(guildId, userId) };
}

function accountEmbed(user, balances) {
  return new EmbedBuilder()
    .setColor(0xA7D8F0)
    .setAuthor({ name: "Yukina · Banco Central", iconURL: user.displayAvatarURL({ size: 128 }) })
    .setTitle("🏦 Sua conta bancária")
    .setDescription("Guarde suas Kizunas no Banco Central da Yukina e mantenha sua carteira organizada.")
    .addFields(
      { name: "👛 Carteira", value: "**" + format(balances.wallet) + " KZ**", inline: true },
      { name: "🏦 Banco", value: "**" + format(balances.bank) + " KZ**", inline: true },
      { name: "💴 Patrimônio total", value: "**" + format(balances.wallet + balances.bank) + " KZ**", inline: false },
    )
    .setFooter({ text: "Yukina · Sem taxa de depósito ou saque" })
    .setTimestamp();
}

async function run({ guild, user, action, amountInput, send }) {
  if (!guild) return send({ content: "❄️ O Banco Central só funciona dentro de um servidor.", ephemeral: true });
  try {
    if (action === "saldo") {
      return send({ embeds: [accountEmbed(user, await getAccountBalances(guild.id, user.id))] });
    }
    if (action !== "depositar" && action !== "sacar") {
      return send({ content: "🏦 Use Ybanco saldo, Ybanco depositar 5k ou Ybanco sacar 2k.", ephemeral: true });
    }
    const result = await moveMoney({ guildId: guild.id, userId: user.id, action, amountInput });
    if (!result.ok) return send({ content: result.message, ephemeral: true });
    const verb = action === "depositar" ? "depositadas no banco" : "retiradas do banco";
    const embed = accountEmbed(user, result.balances)
      .setTitle(action === "depositar" ? "🌸 Depósito concluído" : "❄️ Saque concluído")
      .setDescription("**" + format(result.amount) + " KZ** foram " + verb + " com sucesso.\n\nSeu dinheiro continua seguro na conta da Yukina.");
    return send({ embeds: [embed] });
  } catch (error) {
    console.error("[Yukina Banco Central] Falha na operação:", error);
    return send({ content: "🌙 O Banco Central não conseguiu processar sua operação agora. Tente novamente em instantes.", ephemeral: true });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("banco")
    .setDescription("Acesse sua conta no Banco Central da Yukina.")
    .setDMPermission(false)
    .addSubcommand(sub => sub.setName("saldo").setDescription("Consulte sua carteira e sua conta bancária."))
    .addSubcommand(sub => sub.setName("depositar").setDescription("Deposite KZ da carteira no banco.")
      .addStringOption(option => option.setName("valor").setDescription("Valor em KZ, por exemplo 5000, 1.5k ou all.").setRequired(true).setMaxLength(32)))
    .addSubcommand(sub => sub.setName("sacar").setDescription("Retire KZ do banco para sua carteira.")
      .addStringOption(option => option.setName("valor").setDescription("Valor em KZ, por exemplo 5000, 1.5k ou all.").setRequired(true).setMaxLength(32))),

  name: "banco",
  aliases: ["bank", "bancocentral"],

  async execute(interaction) {
    const action = interaction.options.getSubcommand();
    const amountInput = action === "saldo" ? null : interaction.options.getString("valor");
    return run({
      guild: interaction.guild,
      user: interaction.user,
      action,
      amountInput,
      send: async payload => {
        const { ephemeral, ...rest } = payload;
        if (interaction.replied || interaction.deferred) {
          return interaction.followUp({ ...rest, flags: ephemeral ? MessageFlags.Ephemeral : undefined });
        }
        return interaction.reply({ ...rest, flags: ephemeral ? MessageFlags.Ephemeral : undefined });
      },
    });
  },

  async prefixExecute(message, args = []) {
    const action = String(args[0] || "saldo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedAction = action === "depositar" || action === "deposit" ? "depositar"
      : action === "sacar" || action === "saque" || action === "withdraw" ? "sacar" : "saldo";
    const amountInput = normalizedAction === "saldo" ? null : args[1];
    return run({
      guild: message.guild,
      user: message.author,
      action: normalizedAction,
      amountInput,
      send: payload => {
        const { ephemeral, ...rest } = payload;
        return message.reply(rest);
      },
    });
  },
};
