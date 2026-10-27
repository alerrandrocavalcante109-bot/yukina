"use strict";

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { MongoClient } = require("mongodb");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
const HISTORY_LIMIT = 15;
let mongoClient = null;
let proposals = null;
let bankTransactions = null;

async function getCollections() {
  if (proposals && bankTransactions) return { proposals, bankTransactions };
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, {
      appName: "Yukina-TransferHistory",
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
  }
  await mongoClient.connect();
  const db = mongoClient.db(MONGODB_DB);
  proposals = db.collection("yukina_pay_proposals");
  bankTransactions = db.collection("yukina_bank_transactions");
  await Promise.all([
    proposals.createIndex({ guildId: 1, status: 1, senderId: 1, completedAt: -1 }, { name: "transfer_history_sender" }),
    proposals.createIndex({ guildId: 1, status: 1, recipientId: 1, completedAt: -1 }, { name: "transfer_history_recipient" }),
    bankTransactions.createIndex({ guildId: 1, userId: 1, createdAt: -1 }, { name: "bank_ledger_user_history" }),
  ]);
  return { proposals, bankTransactions };
}

function format(value) {
  return Math.floor(Number(value) || 0).toLocaleString("pt-BR");
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function showHistory({ guild, user, send }) {
  if (!guild) {
    return send({ content: "❄️ O extrato de transferências só pode ser consultado dentro de um servidor.", ephemeral: true });
  }

  try {
    const { proposals: proposalCollection, bankTransactions: ledger } = await getCollections();
    const guildId = String(guild.id);
    const userId = String(user.id);
    const [transferRows, bankRows] = await Promise.all([
      proposalCollection.find({
        guildId,
        status: "completed",
        $or: [{ senderId: userId }, { recipientId: userId }],
      }).sort({ completedAt: -1 }).limit(HISTORY_LIMIT).toArray(),
      ledger.find({ guildId, userId }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).toArray(),
    ]);

    const entries = [
      ...transferRows.map(item => ({
        kind: String(item.senderId) === userId ? "sent" : "received",
        amount: Math.max(0, Number(item.amount) || 0),
        otherId: String(item.senderId) === userId ? item.recipientId : item.senderId,
        date: item.completedAt || item.createdAt,
      })),
      ...bankRows.map(item => ({
        kind: item.type === "depositar" ? "deposit" : "withdraw",
        amount: Math.max(0, Number(item.amount) || 0),
        date: item.createdAt,
      })),
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, HISTORY_LIMIT);

    const outgoingTotal = entries.reduce((sum, item) => sum + (item.kind === "sent" || item.kind === "deposit" ? item.amount : 0), 0);
    const incomingTotal = entries.reduce((sum, item) => sum + (item.kind === "received" || item.kind === "withdraw" ? item.amount : 0), 0);

    const details = entries.length
      ? entries.map(item => {
          if (item.kind === "sent") return "📤 **Transferência enviada** · " + format(item.amount) + " KZ\nPara: <@" + item.otherId + "> · " + formatDate(item.date);
          if (item.kind === "received") return "📥 **Transferência recebida** · " + format(item.amount) + " KZ\nDe: <@" + item.otherId + "> · " + formatDate(item.date);
          if (item.kind === "deposit") return "🏦 **Depósito no banco** · −" + format(item.amount) + " KZ\nDa carteira para o Banco Central · " + formatDate(item.date);
          return "👛 **Saque do banco** · +" + format(item.amount) + " KZ\nDo Banco Central para a carteira · " + formatDate(item.date);
        }).join("\n\n")
      : "Ainda não há movimentações concluídas registradas para sua carteira.";

    const embed = new EmbedBuilder()
      .setColor(0xA7D8F0)
      .setAuthor({ name: "Yukina · Extrato da carteira", iconURL: user.displayAvatarURL({ size: 128 }) })
      .setTitle("💴 Movimentações de Kizunas")
      .setDescription(
        "Movimentações recentes da sua carteira neste servidor.\n" +
        "🌸 **Entrou na carteira:** +" + format(incomingTotal) + " KZ\n" +
        "🍃 **Saiu da carteira:** −" + format(outgoingTotal) + " KZ\n\n" + details
      )
      .setFooter({ text: "Yukina · Exibindo até " + HISTORY_LIMIT + " movimentações recentes" })
      .setTimestamp();

    return send({ embeds: [embed], allowedMentions: { parse: [] }, ephemeral: false });
  } catch (error) {
    console.error("[Yukina Transferências] Falha ao consultar extrato:", error);
    return send({
      content: "🌙 Não consegui consultar seu extrato agora. Tente novamente em instantes.",
      ephemeral: true,
    });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transferencias")
    .setDescription("Mostra as Kizunas que entraram e saíram da sua carteira.")
    .setDMPermission(false),
  name: "transferencias",
  aliases: ["transferencia", "transferência", "transferências", "extrato", "historico", "histórico"],

  async execute(interaction) {
    return showHistory({
      guild: interaction.guild,
      user: interaction.user,
      send: async payload => {
        const { ephemeral, ...rest } = payload;
        if (interaction.replied || interaction.deferred) {
          return interaction.followUp({ ...rest, flags: ephemeral ? MessageFlags.Ephemeral : undefined });
        }
        return interaction.reply({ ...rest, flags: ephemeral ? MessageFlags.Ephemeral : undefined });
      },
    });
  },

  async prefixExecute(message) {
    return showHistory({
      guild: message.guild,
      user: message.author,
      send: payload => {
        const { ephemeral, ...rest } = payload;
        return message.channel.send(rest);
      },
    });
  },
};
