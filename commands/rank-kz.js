"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { MongoClient } = require("mongodb");

const COLOR = 0xC58AE8;
const FILE = path.join(process.cwd(), "data", "economia.json");
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let mongoClient;

function formatKz(value) {
  return Math.floor(Math.max(0, Number(value) || 0)).toLocaleString("pt-BR") + " KZ";
}

function readBalance(record) {
  const value = typeof record === "number"
    ? record
    : (record?.balance ?? record?.saldo ?? record?.wallet ?? record?.kizunas ?? 0);
  const balance = Number(value);
  return Number.isFinite(balance) && balance > 0 ? balance : 0;
}

async function getMongoRanking(guildId) {
  if (!MONGODB_URI) return null;
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, {
      appName: "Yukina-Rank-KZ",
      serverSelectionTimeoutMS: 10000,
    });
  }
  await mongoClient.connect();
  const docs = await mongoClient.db(MONGODB_DB).collection("economy_balances")
    .find({ guildId: String(guildId) }, { projection: { userId: 1, balance: 1, _id: 0 } })
    .toArray();

  if (!docs.length) return null;
  return docs
    .map(doc => ({ userId: String(doc.userId), balance: readBalance(doc.balance) }))
    .filter(doc => /^\d{15,22}$/.test(doc.userId))
    .sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));
}

async function getLocalRanking(guildId) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("[Rank KZ] Falha ao ler economia local:", error.message);
    return [];
  }

  const guild = data?.[String(guildId)];
  const source = guild && typeof guild === "object" && !Array.isArray(guild)
    ? guild
    : Object.fromEntries(Object.entries(data || {}).filter(([id]) => /^\d{15,22}$/.test(id)));

  return Object.entries(source)
    .map(([userId, record]) => ({ userId: String(userId), balance: readBalance(record) }))
    .filter(doc => /^\d{15,22}$/.test(doc.userId))
    .sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));
}

function medal(position) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return "❄️";
}

async function buildRanking(guild, requesterId) {
  let ranking = null;
  try {
    ranking = await getMongoRanking(guild.id);
  } catch (error) {
    console.error("[Rank KZ] Falha ao consultar MongoDB:", error.message || error);
  }
  if (!ranking) ranking = await getLocalRanking(guild.id);

  const positive = ranking.filter(entry => entry.balance > 0);
  const top = positive.slice(0, 10);
  const ownPosition = positive.findIndex(entry => entry.userId === String(requesterId));
  const own = ownPosition >= 0 ? positive[ownPosition] : null;

  const lines = top.length
    ? top.map((entry, index) => {
        const position = index + 1;
        const isRequester = entry.userId === String(requesterId);
        return medal(position) + " **#" + position + "** <@" + entry.userId + ">" +
          (isRequester ? " **· Você**" : "") +
          "\n　└ 💎 **" + formatKz(entry.balance) + "**";
      }).join("\n\n")
    : "Ainda não há saldos registrados neste servidor. Faça suas primeiras Kizunas e apareça no ranking!";

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({
      name: "Yukina · Arquivo da Economia",
      iconURL: guild.client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle("🌙 Ranking de Kizunas")
    .setDescription(
      "「 O brilho das Kizunas revela os maiores tesouros de Yukina 」\n\n" +
      lines
    )
    .addFields(
      { name: "👥 No ranking", value: String(positive.length) + " membro(s)", inline: true },
      { name: "💴 Moeda", value: "Kizunas · KZ", inline: true },
      { name: "🏆 Sua posição", value: own ? "#" + (ownPosition + 1) : "Sem posição", inline: true }
    )
    .setFooter({ text: "Yukina · Ranking do servidor • Atualizado a cada consulta" })
    .setTimestamp();

  if (own && ownPosition >= 10) {
    embed.addFields({
      name: "❄️ Sua classificação",
      value: "Você está em **#" + (ownPosition + 1) + "** com **" + formatKz(own.balance) + "**.",
      inline: false,
    });
  } else if (!own) {
    embed.addFields({
      name: "🌸 Comece sua jornada",
      value: "Seu saldo ainda não entrou no ranking. Junte KZ usando os sistemas de economia da Yukina.",
      inline: false,
    });
  }

  return embed;
}

async function run(guild, user, reply) {
  if (!guild) {
    return reply({ content: "❄️ O ranking de KZ só pode ser consultado dentro de um servidor." });
  }
  try {
    const embed = await buildRanking(guild, user.id);
    return reply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Yukina Rank KZ]", error);
    return reply({ content: "🫧 O arquivo de Kizunas está indisponível no momento. Tente novamente em instantes." });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank-kz")
    .setDescription("Veja os 10 maiores saldos de Kizunas deste servidor."),
  aliases: ["rankkz", "kzrank", "topkz", "rankkizunas"],
  async execute(interaction) {
    await interaction.deferReply();
    return run(interaction.guild, interaction.user, payload => interaction.editReply(payload));
  },
  async prefixExecute(message) {
    return run(message.guild, message.author, payload => message.reply(payload));
  },
};
