"use strict";

const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { MongoClient } = require("mongodb");
const storage = require("../system-storage").forSystem("economy");
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let mongoClient = null;
let balancesCollection = null;

async function getBalancesCollection() {
  if (balancesCollection) return balancesCollection;
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, { appName: "Yukina-Work", serverSelectionTimeoutMS: 10000 });
  await mongoClient.connect();
  balancesCollection = mongoClient.db(MONGODB_DB).collection("economy_balances");
  await balancesCollection.createIndex({ guildId: 1, userId: 1 }, { unique: true, name: "unique_guild_user_balance" });
  return balancesCollection;
}

const COLOR = 0xA7D8F0;
const COOLDOWN_MS = 30 * 60 * 1000;
const MIN_REWARD = 80;
const MAX_REWARD = 220;
const locks = new Set();

const JOBS = [
  {
    title: "Mensageira do Santuário",
    description: "Você levou cartas entre o santuário e a vila, protegendo cada envelope da neve.",
    emoji: "📨",
  },
  {
    title: "Guardião das Lanternas",
    description: "Você acendeu as lanternas do caminho antes que a noite cobrisse tudo de gelo.",
    emoji: "🏮",
  },
  {
    title: "Coletora de Cristais",
    description: "Você encontrou cristais azul-gelo perto das montanhas e os levou para a oficina.",
    emoji: "💎",
  },
  {
    title: "Assistente da Biblioteca Lunar",
    description: "Você organizou livros antigos e ajudou a encontrar mapas celestes esquecidos.",
    emoji: "📚",
  },
  {
    title: "Cuidadora das Raposas da Neve",
    description: "Você cuidou das pequenas raposas do bosque e preparou um abrigo quentinho para elas.",
    emoji: "🦊",
  },
  {
    title: "Aprendiz de Astrônoma",
    description: "Você registrou as constelações da noite e entregou suas anotações ao observatório.",
    emoji: "🌌",
  },
  {
    title: "Florista de Sakura",
    description: "Você preparou buquês delicados para a feira da vila, mesmo com o frio da manhã.",
    emoji: "🌸",
  },
  {
    title: "Padeira da Vila",
    description: "Você ajudou a preparar pãezinhos quentinhos para os viajantes que chegaram com a neve.",
    emoji: "🥐",
  },
];

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("pt-BR");
}

function buildEmbed(user, job, reward, record, nextWorkAt) {
  const remaining = Math.max(0, nextWorkAt - Date.now());
  const minutes = Math.ceil(remaining / 60000);
  const hoursPart = Math.floor(minutes / 60);
  const minutesPart = minutes % 60;
  const wait = hoursPart > 0
    ? (hoursPart + "h " + minutesPart + "min")
    : (minutesPart + " min");

  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({
      name: "Yukina · Central de trabalhos",
      iconURL: user.displayAvatarURL({ size: 128 }),
    })
    .setTitle(job.emoji + " " + job.title)
    .setDescription(job.description)
    .addFields(
      { name: "❄️ Recompensa", value: "+" + formatNumber(reward) + " flocos", inline: true },
      { name: "💎 Sua carteira", value: formatNumber(record.balance) + " Kizunas (KZ)", inline: true },
      { name: "🌙 Próximo trabalho", value: "Disponível em " + wait, inline: true },
    )
    .setFooter({ text: "Yukina · Trabalhe com calma; até a neve precisa de pausa." })
    .setTimestamp();
}

async function runWork({ guildId, user, reply }) {
  if (!guildId) return reply({ content: "❄️ O comando **work** só pode ser usado dentro de um servidor.", ephemeral: true });

  const lockKey = guildId + ":" + user.id;
  if (locks.has(lockKey)) {
    return reply({ content: "🌙 A Yukina já está registrando seu trabalho. Aguarde um instante e tente novamente.", ephemeral: true });
  }

  locks.add(lockKey);
  try {
    const balances = await getBalancesCollection();
    const balanceDoc = await balances.findOne({ guildId: String(guildId), userId: String(user.id) });
    const record = await storage.get(guildId, "profile", {
      lastWorkAt: 0,
      totalEarned: 0,
      jobsCompleted: 0,
    }, user.id);

    const balance = Math.max(0, Number(balanceDoc?.balance) || 0);
    const lastWorkAt = Math.max(0, Number(record?.lastWorkAt) || 0);
    const now = Date.now();

    if (now - lastWorkAt < COOLDOWN_MS) {
      const availableAt = Math.ceil((lastWorkAt + COOLDOWN_MS) / 1000);
      return reply({
        content: "🫧 Você já cumpriu seu turno — a Yukina recomenda uma pausa aconchegante. Você poderá trabalhar novamente <t:" + availableAt + ":R>.",
        ephemeral: true,
      });
    }

    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    const reward = Math.floor(Math.random() * (MAX_REWARD - MIN_REWARD + 1)) + MIN_REWARD;
    const updated = {
      ...record,
      lastWorkAt: now,
      totalEarned: Math.max(0, Number(record?.totalEarned) || 0) + reward,
      jobsCompleted: Math.max(0, Number(record?.jobsCompleted) || 0) + 1,
    };

    // O saldo é gravado na mesma coleção usada pelo /saldo e pelo Daily.
    await balances.updateOne(
      { guildId: String(guildId), userId: String(user.id) },
      { $inc: { balance: reward }, $set: { updatedAt: new Date(now) }, $setOnInsert: { guildId: String(guildId), userId: String(user.id), createdAt: new Date(now) } },
      { upsert: true }
    );
    const balanceAfter = await balances.findOne({ guildId: String(guildId), userId: String(user.id) });
    updated.balance = Math.max(0, Number(balanceAfter?.balance) || balance + reward);
    await storage.set(guildId, "profile", updated, user.id);
    const embed = buildEmbed(user, job, reward, updated, now + COOLDOWN_MS);
    return reply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Yukina /work] Falha ao registrar trabalho:", error);
    return reply({
      content: "💧 Não consegui registrar sua recompensa agora. Tente novamente em instantes.",
      ephemeral: true,
    });
  } finally {
    locks.delete(lockKey);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Faça um trabalho no mundo da Yukina e ganhe flocos de neve.")
    .setDMPermission(false),

  aliases: ["trabalhar", "trabalho"],

  async execute(interaction) {
    return runWork({
      guildId: interaction.guildId,
      user: interaction.user,
      reply: (payload) => interaction.reply({
        ...payload,
        ...(payload.ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
      }),
    });
  },

  async prefixExecute(message) {
    return runWork({
      guildId: message.guildId,
      user: message.author,
      reply: (payload) => {
        if (payload.ephemeral) return message.reply(payload.content);
        return message.channel.send({
          ...payload,
          reply: { messageReference: message.id, failIfNotExists: false },
        });
      },
    });
  },
};
