"use strict";

const { SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { MongoClient } = require("mongodb");
const { getUserLanguage, translate } = require("../systems/idioma");
const messages = require("../systems/idioma/locales/drop-controle");

const URI = (process.env.MONGODB_URI || "").trim();
const DB = (process.env.MONGODB_DB || "Yukina").trim();
let mongo, db, connecting;

async function getDb() {
  if (db) return db;
  if (!URI) throw new Error("MONGODB_URI não configurada.");
  if (!connecting) connecting = (async () => {
    mongo = mongo || new MongoClient(URI, { appName: "Yukina-Drop-Control", serverSelectionTimeoutMS: 10000 });
    await mongo.connect();
    db = mongo.db(DB);
    return db;
  })().catch(error => { connecting = null; mongo = null; throw error; });
  return connecting;
}

const fmt = (value, language) => Math.floor(Number(value) || 0).toLocaleString(language || "pt-BR");
const tr = (language, key, vars = {}) => translate(language, key, vars);
const PLAN_NAMES = { starter: "Starter", plus: "Plus", premium: "Premium", ultra: "Ultra", infinity: "Infinity" };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("drop-controle")
    .setDescription("[administração] Gerencia os Drops Automáticos da Yukina.")
    .setDMPermission(false)
    .addStringOption(option => option.setName("acao").setDescription("O que deseja consultar ou fazer?").setRequired(true).addChoices(
      { name: "Estatísticas", value: "stats" },
      { name: "Histórico recente", value: "history" },
      { name: "Pausar canal ou todos", value: "pause" },
      { name: "Retomar canal ou todos", value: "resume" },
      { name: "Recompensas pendentes", value: "pending" },
      { name: "Falhas de pagamento", value: "failures" }
    ))
    .addChannelOption(option => option.setName("canal").setDescription("Canal específico; sem seleção, aplica a todos os canais configurados.").addChannelTypes(ChannelType.GuildText))
    .addIntegerOption(option => option.setName("quantidade").setDescription("Quantidade de registros no histórico (1 a 10).").setMinValue(1).setMaxValue(10)),

  async execute(interaction) {
    const language = await getUserLanguage(interaction.user.id);
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: tr(language, "perm"), flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const database = await getDb();
      const configs = database.collection("drop_auto_configs");
      const runs = database.collection("drop_auto_runs");
      const ledger = database.collection("drop_auto_payout_ledger");
      const payouts = database.collection("drop_auto_manual_payouts");
      const attempts = database.collection("drop_auto_payout_attempts");
      const action = interaction.options.getString("acao", true);
      const selectedChannel = interaction.options.getChannel("canal");
      const config = await configs.findOne({ guildId: String(interaction.guildId), status: "active" });
      if (!config) return interaction.editReply(tr(language, "none"));

      if (action === "pause" || action === "resume") {
        const channelIds = selectedChannel ? [String(selectedChannel.id)] : (config.channelIds || []).map(String);
        const validIds = channelIds.filter(id => config.channelIds?.includes(id));
        if (!validIds.length) return interaction.editReply(tr(language, "invalid"));
        const dropAuto = require("../components/buttons/drop-auto");
        for (const id of validIds) {
          if (action === "pause") await dropAuto.pauseChannel(config, id);
          else await dropAuto.resumeChannel(interaction.client, config, id);
        }
        return interaction.editReply(action === "pause"
          ? tr(language, "pause", { channels: validIds.map(id => "<#" + id + ">").join(", ") })
          : tr(language, "resume", { channels: validIds.map(id => "<#" + id + ">").join(", ") }));
      }

      if (action === "stats") {
        const filter = { guildId: String(interaction.guildId) };
        const [total, active, ended, paid, manual, pending, configFresh] = await Promise.all([
          runs.countDocuments(filter),
          runs.countDocuments({ ...filter, status: "active" }),
          runs.countDocuments({ ...filter, status: "ended" }),
          ledger.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]).toArray(),
          payouts.aggregate([
            { $match: { guildId: String(interaction.guildId), status: "delivered" } },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
          ]).toArray(),
          payouts.countDocuments({ guildId: String(interaction.guildId), status: { $in: ["waiting_member", "staff_review", "creating_channel"] } }),
          configs.findOne({ _id: config._id })
        ]);
        const paidInfo = paid[0] || { total: 0, count: 0 };
        const manualInfo = manual[0] || { total: 0, count: 0 };
        const totalPaid = paidInfo.total + manualInfo.total;
        const paidCount = paidInfo.count + manualInfo.count;
        const embed = new EmbedBuilder().setColor(0xA7D8F0).setTitle(tr(language, "stats"))
          .addFields(
            { name: tr(language, "runs"), value: fmt(total, language), inline: true },
            { name: tr(language, "active"), value: fmt(active, language), inline: true },
            { name: tr(language, "ended"), value: fmt(ended, language), inline: true },
            { name: tr(language, "paid"), value: fmt(paidCount, language), inline: true },
            { name: tr(language, "kz"), value: fmt(totalPaid, language) + " KZ", inline: true },
            { name: tr(language, "pending"), value: fmt(pending, language), inline: true },
            { name: tr(language, "channels"), value: fmt((configFresh?.channelIds || []).length, language), inline: true },
            { name: tr(language, "plan"), value: PLAN_NAMES[config.planKey] || config.planKey, inline: true }
          ).setFooter({ text: tr(language, "footer") }).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      if (action === "history") {
        const limit = interaction.options.getInteger("quantidade") || 5;
        const docs = await runs.find({ guildId: String(interaction.guildId) }).sort({ createdAt: -1 }).limit(limit).toArray();
        if (!docs.length) return interaction.editReply(tr(language, "noHistory"));
        const lines = docs.map((run, index) => {
          const winners = (run.winners || []).length ? run.winners.map(id => "<@" + id + ">").join(", ") : tr(language, "noWinners");
          return "**" + (index + 1) + ".** " + (run.status === "active" ? tr(language, "inProgress") : run.status === "paying" ? tr(language, "processing") : tr(language, "closed")) +
            " · " + fmt(run.reward) + " KZ\nCanal: <#" + run.channelId + "> · Participantes: " + (run.participantCount ?? Object.keys(run.entries || {}).length) +
            "\n" + tr(language, "winners") + ": " + winners;
        });
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xA7D8F0).setTitle(tr(language, "history")).setDescription(lines.join("\n\n")).setFooter({ text: tr(language, "historyFooter", { count: docs.length }) })] });
      }

      if (action === "failures") {
        const docs = await attempts.find({ guildId: String(interaction.guildId), status: "failed" }).sort({ finishedAt: -1 }).limit(10).toArray();
        if (!docs.length) return interaction.editReply(tr(language, "noFailures"));
        const lines = docs.map((item, index) => "**" + (index + 1) + ".** <@" + item.userId + "> · tentativa " + item.attempt + "/5\nDrop: `" + item.runId + "`\nMotivo: " + String(item.error || tr(language, "notInformed")).slice(0, 300));
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xE8C878).setTitle(tr(language, "failures")).setDescription(lines.join("\n\n")).setFooter({ text: tr(language, "failureFooter") })] });
      }

      if (action === "pending") {
        const docs = await payouts.find({ guildId: String(interaction.guildId), status: { $in: ["waiting_member", "staff_review", "creating_channel"] } }).sort({ createdAt: 1 }).limit(10).toArray();
        if (!docs.length) return interaction.editReply(tr(language, "noPending"));
        const lines = docs.map((p, i) => "**" + (i + 1) + ".** <@" + p.userId + "> · **" + fmt(p.amount, language) + " KZ**\nStatus: `" + p.status + "` · Drop: `" + p.runId + "`" + (p.privateChannelId ? " · " + tr(language, "privateChannel") + ": <#" + p.privateChannelId + ">" : ""));
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xE8C878).setTitle(tr(language, "pendingTitle")).setDescription(lines.join("\n\n")).setFooter({ text: tr(language, "pendingFooter") })] });
      }
    } catch (error) {
      console.error("[Drop Controle] Falha ao executar ação:", error);
      return interaction.editReply(tr(language, "error"));
    }
  }
};
