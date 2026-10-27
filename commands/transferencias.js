"use strict";

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { MongoClient } = require("mongodb");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
const HISTORY_LIMIT = 15;
let mongoClient = null;
let proposals = null;

async function getProposals() {
  if (proposals) return proposals;
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, {
      appName: "Yukina-TransferHistory",
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
  }
  await mongoClient.connect();
  proposals = mongoClient.db(MONGODB_DB).collection("yukina_pay_proposals");
  await proposals.createIndex(
    { guildId: 1, status: 1, senderId: 1, completedAt: -1 },
    { name: "transfer_history_sender" }
  );
  await proposals.createIndex(
    { guildId: 1, status: 1, recipientId: 1, completedAt: -1 },
    { name: "transfer_history_recipient" }
  );
  return proposals;
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
    const collection = await getProposals();
    const userId = String(user.id);
    const entries = await collection.find({
      guildId: String(guild.id),
      status: "completed",
      $or: [{ senderId: userId }, { recipientId: userId }],
    })
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .toArray();

    const outgoing = entries.filter(item => String(item.senderId) === userId);
    const incoming = entries.filter(item => String(item.recipientId) === userId);
    const outgoingTotal = outgoing.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
    const incomingTotal = incoming.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);

    const embed = new EmbedBuilder()
      .setColor(0xA7D8F0)
      .setAuthor({ name: "Yukina · Extrato da carteira", iconURL: user.displayAvatarURL({ size: 128 }) })
      .setTitle("💴 Transferências de Kizunas")
      .setDescription(
        "Aqui está o movimento recente da sua carteira neste servidor.\n" +
        "🌸 **Entrou:** +" + format(incomingTotal) + " KZ\n" +
        "🍃 **Saiu:** −" + format(outgoingTotal) + " KZ\n\n" +
        (entries.length
          ? entries.map(item => {
              const sent = String(item.senderId) === userId;
              const otherId = sent ? item.recipientId : item.senderId;
              const amount = format(item.amount);
              return (sent ? "📤 **Saiu**" : "📥 **Entrou") + " · " + amount + " KZ\n" +
                (sent ? "Para" : "De") + ": <@" + otherId + "> · " + formatDate(item.completedAt || item.createdAt);
            }).join("\n\n")
          : "Ainda não há transferências concluídas registradas para sua carteira.")
      )
      .setFooter({ text: "Yukina · Exibindo até " + HISTORY_LIMIT + " transferências concluídas" })
      .setTimestamp();

    return send({
      embeds: [embed],
      allowedMentions: { parse: [] },
      ephemeral: false,
    });
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
