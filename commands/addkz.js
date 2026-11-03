"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
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
  await balancesCollection.createIndex({ guildId: 1, userId: 1 }, { unique: true, name: "unique_guild_user_balance" });
  return balancesCollection;
}

function parseAmount(raw) {
  let value = String(raw || "").trim().toLowerCase().replace(/\s+/g, "");
  const suffix = value.match(/^(\d+(?:[.,]\d+)?)\s*([km])$/);
  if (suffix) {
    const base = Number(suffix[1].replace(",", "."));
    const multiplier = suffix[2] === "k" ? 1_000 : 1_000_000;
    const amount = base * multiplier;
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

async function addKz(guildId, users, amount) {
  const balances = await getBalancesCollection();
  const now = new Date();
  const results = [];
  for (const user of users) {
    const doc = await balances.findOneAndUpdate(
      { guildId: String(guildId), userId: String(user.id) },
      {
        $inc: { balance: amount },
        $set: { updatedAt: now },
        $setOnInsert: { guildId: String(guildId), userId: String(user.id), createdAt: now }
      },
      { upsert: true, returnDocument: "after" }
    );
    const balance = Number(doc?.balance ?? doc?.value?.balance) || amount;
    results.push({ user, balance });
  }
  return results;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addkz")
    .setDescription("[administração] Adiciona Kizunas à carteira de um membro.")
    .addUserOption(option => option.setName("usuario").setDescription("Membro que receberá as Kizunas.").setRequired(true))
    .addIntegerOption(option => option.setName("valor").setDescription("Quantidade de Kizunas (ex.: 5000).").setRequired(true).setMinValue(1).setMaxValue(2147483647))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  aliases: ["addkz", "adicionarkz"],

  async execute(interaction) {
    if (!isAllowed(interaction.member)) {
      return interaction.reply({ content: "❄️ Você precisa da permissão Gerenciar servidor ou Administrador para usar este comando.", flags: MessageFlags.Ephemeral });
    }
    const user = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("valor");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const result = (await addKz(interaction.guildId, [user], amount))[0];
      return interaction.editReply("🌸 Foram adicionadas **+" + format(amount) + " KZ** para " + result.user + ". Novo saldo: **" + format(result.balance) + " KZ**.");
    } catch (error) {
      console.error("[Yukina addkz] Falha ao adicionar KZ:", error);
      return interaction.editReply("🌙 Não consegui atualizar a carteira. Verifique a conexão com o banco de dados e tente novamente.");
    }
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só pode ser usado em um servidor.");
    if (!isAllowed(message.member)) {
      return message.reply("❄️ Você precisa da permissão Gerenciar servidor ou Administrador para usar este comando.");
    }

    const mentions = [...message.mentions.users.values()].filter(user => !user.bot);
    const separatorIndex = args.indexOf(">");
    if (separatorIndex < 0) {
      return message.reply("🫧 Use: Yaddkz @membro1 @membro2 > valor");
    }
    const amount = parseAmount(args.slice(separatorIndex + 1).join(""));
    if (!mentions.length || !amount) {
      return message.reply("🫧 Informe pelo menos um membro e um valor válido. Exemplos: Yaddkz @membro > 5k ou Yaddkz @membro > 1.5m");
    }

    try {
      const results = await addKz(message.guildId, mentions, amount);
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
