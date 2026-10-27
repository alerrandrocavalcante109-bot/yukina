"use strict";

const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { MongoClient } = require("mongodb");
const { applyDailyInactivityFee, formatKz } = require("../systems/bank-inactivity-fee");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let mongoClient = null;
let walletCollection = null;
let bankCollection = null;
let ledgerCollection = null;

async function getCollections() {
  if (walletCollection && bankCollection) return { walletCollection, bankCollection, db: mongoClient.db(MONGODB_DB) };
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
  return { walletCollection, bankCollection, db };
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
  const { db } = await getCollections();
  const feeResult = await applyDailyInactivityFee({ db, guildId, userId });
  const before = await getAccountBalances(guildId, userId);
  const source = action === "depositar" ? before.wallet : before.bank;
  const amount = parseAmount(amountInput, source, true);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return { ok: false, message: "❄️ Informe um valor válido para continuar." };
  }
  if (source < amount) {
    return {
      ok: false,
      message: action === "depositar"
        ? "❄️ Você não tem KZ suficientes na carteira."
        : "🌸 Você não tem KZ suficientes no banco.",
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
      return { ok: false, message: "🫧 **Yukina:** Seu saldo mudou durante a operação. Confira os valores e tente mais uma vez, tá bem?" };
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return { ok: true, amount, balances: await getAccountBalances(guildId, userId), fee: feeResult.fee, overdueDays: feeResult.overdueDays };
}

function accountEmbed(user, balances) {
  return new EmbedBuilder()
    .setColor(0xA7D8F0)
    .setAuthor({ name: "❄️ Yukina · Banco Central" })
    .setTitle("🌙 Um cantinho seguro para suas Kizunas")
    .setDescription("Oii~! Sou a Yukina, e vou cuidar do seu pequeno tesouro. 💙\n\nGuarde suas Kizunas aqui, mas não se esqueça do Daily! Após **3 dias completos sem coletá-lo**, uma taxa de **3% ao dia** será descontada do saldo bancário. A taxa continua acumulando enquanto você não voltar.")
    .addFields(
      { name: "👛 Carteira", value: "**" + format(balances.wallet) + " KZ**", inline: true },
      { name: "🏦 Banco", value: "**" + format(balances.bank) + " KZ**", inline: true },
      { name: "💴 Patrimônio total", value: "**" + format(balances.wallet + balances.bank) + " KZ**", inline: false },
      { name: "❄️ Taxa por inatividade do Daily", value: "**3% ao dia após 3 dias sem coletar**\nA cobrança acumula diariamente até você voltar ao Daily. Cuide das suas Kizunas, tá bem? 🌸", inline: false },
    )
    .setFooter({ text: "Yukina • Cuide das suas Kizunas e volte para o Daily ♡" })
    .setTimestamp();
}

async function run({ guild, user, action, amountInput, send }) {
  if (!guild) return send({ content: "❄️ **Yukina:** O Banco Central fica dentro de um servidor do Discord, tá bem? 🌸", ephemeral: true });
  try {
    if (action === "saldo") {
      const { db } = await getCollections();
      const feeResult = await applyDailyInactivityFee({ db, guildId: guild.id, userId: user.id });
      const balances = await getAccountBalances(guild.id, user.id);
      const debtInfo = await require("../systems/bank-loans").getDebt(guild.id, user.id);
      const feeText = feeResult.fee > 0
        ? "\n\n🫧 **Taxa aplicada:** -" + formatKz(feeResult.fee) + " KZ (" + feeResult.overdueDays + " dia(s))."
        : "";
      const container = new ContainerBuilder()
        .setAccentColor(0xA7D8F0)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          "## ❄️ Yukina · Banco Central\n" +
          "*Seu cantinho para guardar e cuidar das Kizunas.* 💙\n" +
          "━━━━━━━━━━━━━━━━━━━━\n" +
          "### 💴 Visão geral da conta\n" +
          "👛 **Carteira**\n" + format(balances.wallet) + " KZ\n\n" +
          "🏦 **Saldo no banco**\n" + format(balances.bank) + " KZ\n\n" +
          "💎 **Patrimônio total**\n" + format(balances.wallet + balances.bank) + " KZ\n" +
          "━━━━━━━━━━━━━━━━━━━━\n" +
          "### 📜 Empréstimo\n" +
          "**Dívida atual:** " + format(debtInfo.debt) + " KZ\n" +
          (debtInfo.dueAt ? "⏳ **Vencimento:** <t:" + Math.floor(new Date(debtInfo.dueAt).getTime() / 1000) + ":R>\n📈 **Juros por atraso:** " + (debtInfo.dailyRate * 100).toLocaleString("pt-BR") + "% ao dia\n" : (debtInfo.debt > 0 ? "🌸 Este empréstimo não possui prazo de vencimento.\n" : "🌸 Você não tem empréstimos ativos no momento.\n")) +
          "━━━━━━━━━━━━━━━━━━━━\n" +
          "### ❄️ Cuide das suas Kizunas\n" +
          "A taxa por inatividade do Daily é de **3% ao dia**, após 3 dias completos sem coletar. A cobrança acumula até você voltar." + feeText +
          "\n\n**O que deseja fazer?** Use os botões abaixo ou os comandos `Ybanco depositar 5k` e `Ybanco sacar 2k`. 🌙"
        ))
        .addActionRowComponents(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("yukina-bank:loan:" + user.id).setLabel("Pedir empréstimo").setEmoji("💴").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("yukina-bank:debt:" + user.id).setLabel("Ver dívida").setEmoji("📜").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("yukina-bank:repay:" + user.id).setLabel("Pagar dívida").setEmoji("🌙").setStyle(ButtonStyle.Success)
        ));
      return send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
    if (action !== "depositar" && action !== "sacar") {
      return send({ content: "🌙 **Yukina · Como usar o Banco Central**\\n`Ybanco saldo` — ver sua conta\\n`Ybanco depositar 5k` — guardar 5.000 KZ\\n`Ybanco sacar 2k` — retirar 2.000 KZ\\n\\nLembrete: após 3 dias sem Daily, a taxa é de **3% ao dia**. Não se esqueça de coletar, nee~ 💙", ephemeral: true });
    }
    const result = await moveMoney({ guildId: guild.id, userId: user.id, action, amountInput });
    if (!result.ok) return send({ content: result.message, ephemeral: true });
    const message = action === "depositar"
      ? "❄️ Você depositou " + format(result.amount) + " KZ no banco."
      : "🌸 Você sacou " + format(result.amount) + " KZ do banco.";
    const feeNotice = result.fee > 0
      ? "\n❄️ Taxa aplicada: -" + formatKz(result.fee) + " KZ."
      : "";
    return send({ content: message + feeNotice });
  } catch (error) {
    console.error("[Yukina Banco Central] Falha na operação:", error);
    return send({ content: "🫧 **Yukina:** Ah, parece que o Banco Central está descansando por um instante... Tente novamente daqui a pouquinho, por favor. ❄️", ephemeral: true });
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
          return interaction.followUp({ ...rest, flags: (rest.flags || 0) | (ephemeral ? MessageFlags.Ephemeral : 0) });
        }
        return interaction.reply({ ...rest, flags: (rest.flags || 0) | (ephemeral ? MessageFlags.Ephemeral : 0) });
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
