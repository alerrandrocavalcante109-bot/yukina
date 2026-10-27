"use strict";

const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { MongoClient } = require("mongodb");
const storage = require("../system-storage").forSystem("economy");
const workNotifications = require("../systems/work-notifications");
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

const COLOR = 0xC58AE8;
const COOLDOWN_MS = 30 * 60 * 1000;
const MIN_REWARD = 10000;
const MAX_REWARD = 15000;
const locks = new Set();

const JOBS = [
  { title: "Mensageira das Lanternas", description: "Você atravessou as ruas de Yukina levando mensagens entre lanternas de papel. Cada palavra chegou ao destino sob o brilho da lua.", emoji: "🏮" },
  { title: "Guardião do Torii", description: "Você cuidou do caminho sagrado, afastou os espíritos travessos e deixou as fitas de oração dançando ao vento.", emoji: "⛩️" },
  { title: "Cuidadora do Jardim de Sakura", description: "Você varreu as pétalas do jardim e preparou um cantinho sereno para os visitantes apreciarem a floração.", emoji: "🌸" },
  { title: "Aprendiz do Arquivo Lunar", description: "Entre pergaminhos antigos e mapas celestes, você organizou os registros secretos da biblioteca de Yukina.", emoji: "🌙" },
  { title: "Companheira das Raposas Kitsune", description: "Você ajudou as kitsune da floresta a encontrar oferendas perdidas e recebeu em troca um aceno de suas caudas brilhantes.", emoji: "🦊" },
  { title: "Artesã de Amuletos", description: "Com fios coloridos, pequenos sinos e símbolos de boa sorte, você preparou omamori para proteger os viajantes.", emoji: "🎐" },
  { title: "Coletora de Cristais Celestes", description: "Ao cair da noite, você recolheu cristais luminosos nas colinas e os levou ao ateliê para guardar sua energia.", emoji: "💎" },
  { title: "Anfitriã da Casa de Chá", description: "Você serviu chá quentinho e wagashi aos viajantes, transformando uma pausa simples em um momento inesquecível.", emoji: "🍵" },
  { title: "Restauradora de Estrelas", description: "No observatório, você poliu os instrumentos e registrou constelações para que os sonhos de Yukina nunca perdessem o rumo.", emoji: "✨" },
  { title: "Mensageira do Festival", description: "Você ajudou a preparar os enfeites do matsuri, distribuiu pequenas lembranças e espalhou alegria pela vila.", emoji: "🏮" },
];

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("pt-BR");
}

function buildEmbed(user, job, reward, record, nextWorkAt) {
  const remaining = Math.max(0, nextWorkAt - Date.now());
  const minutes = Math.ceil(remaining / 60000);
  const hoursPart = Math.floor(minutes / 60);
  const minutesPart = minutes % 60;
  const wait = hoursPart > 0 ? (hoursPart + "h " + minutesPart + "min") : (minutesPart + " min");

  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · Crônicas de um dia", iconURL: user.displayAvatarURL({ size: 128 }) })
    .setTitle(job.emoji + " " + job.title)
    .setDescription(
      "「 O destino sorriu para você hoje. 」\n\n" +
      job.description +
      "\n\nSeu turno terminou, e a vila agradece sua dedicação. Que as Kizunas recebidas acompanhem você em sua próxima aventura."
    )
    .addFields(
      { name: "💴 Kizunas recebidas", value: "+" + formatNumber(reward) + " KZ", inline: true },
      { name: "🪙 Sua carteira", value: formatNumber(record.balance) + " KZ", inline: true },
      { name: "🌙 Próximo turno", value: "Em " + wait, inline: true },
      { name: "📜 Trabalhos concluídos", value: formatNumber(record.jobsCompleted), inline: true },
      { name: "🎎 Kizunas conquistadas", value: formatNumber(record.totalEarned) + " KZ no total", inline: true }
    )
    .setFooter({ text: "Yukina · Cada jornada deixa uma pequena luz no caminho." })
    .setTimestamp();
}

async function runWork({ guildId, user, reply, client }) {
  if (!guildId) return reply({ content: "⛩️ O comando **work** só pode ser usado dentro de um servidor.", ephemeral: true });

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
    if (updated.notificationEnabled) workNotifications.schedule(client, guildId, user.id, now);
    const notifyRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("yukina-work-notify:" + user.id)
        .setLabel(updated.notificationEnabled ? "Desativar aviso por DM" : "Receber aviso por DM")
        .setEmoji(updated.notificationEnabled ? "🔕" : "🔔")
        .setStyle(updated.notificationEnabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
    );
    return reply({ embeds: [embed], components: [notifyRow], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Yukina /work] Falha ao registrar trabalho:", error);
    return reply({
      content: "🌙 Os registros do reino não responderam desta vez. Tente novamente em instantes.",
      ephemeral: true,
    });
  } finally {
    locks.delete(lockKey);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Explore o universo de Yukina, cumpra um trabalho e receba Kizunas.")
    .setDMPermission(false),

  aliases: ["trabalhar", "trabalho"],

  async execute(interaction) {
    return runWork({
      guildId: interaction.guildId,
      user: interaction.user,
      client: interaction.client,
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
      client: message.client,
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
