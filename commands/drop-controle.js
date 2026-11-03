"use strict";

const { SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { MongoClient } = require("mongodb");

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

const fmt = value => Math.floor(Number(value) || 0).toLocaleString("pt-BR");
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
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "❄️ Apenas a equipe com permissão de Gerenciar Servidor pode usar este controle.", flags: MessageFlags.Ephemeral });
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
      if (!config) return interaction.editReply("🌙 Não encontrei uma configuração ativa do Drop Automático neste servidor.");

      if (action === "pause" || action === "resume") {
        const channelIds = selectedChannel ? [String(selectedChannel.id)] : (config.channelIds || []).map(String);
        const validIds = channelIds.filter(id => config.channelIds?.includes(id));
        if (!validIds.length) return interaction.editReply("❄️ O canal selecionado não pertence à configuração do Drop.");
        const dropAuto = require("../components/buttons/drop-auto");
        for (const id of validIds) {
          if (action === "pause") await dropAuto.pauseChannel(config, id);
          else await dropAuto.resumeChannel(interaction.client, config, id);
        }
        return interaction.editReply(action === "pause"
          ? "⏸️ Drop Automático pausado em: " + validIds.map(id => "<#" + id + ">").join(", ")
          : "▶️ Drop Automático retomado em: " + validIds.map(id => "<#" + id + ">").join(", ") + ". O próximo horário foi reagendado.");
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
        const embed = new EmbedBuilder().setColor(0xA7D8F0).setTitle("🌸 Estatísticas do Drop Automático")
          .addFields(
            { name: "🎁 Drops realizados", value: fmt(total), inline: true },
            { name: "⌛ Drops ativos", value: fmt(active), inline: true },
            { name: "🌙 Drops encerrados", value: fmt(ended), inline: true },
            { name: "🏆 Prêmios entregues", value: fmt(paidCount), inline: true },
            { name: "💴 KZ distribuídas", value: fmt(totalPaid) + " KZ", inline: true },
            { name: "📦 Entregas pendentes", value: fmt(pending), inline: true },
            { name: "📢 Canais configurados", value: fmt((configFresh?.channelIds || []).length), inline: true },
            { name: "🌸 Plano", value: PLAN_NAMES[config.planKey] || config.planKey, inline: true }
          ).setFooter({ text: "Yukina · Registros persistentes do Drop" }).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      if (action === "history") {
        const limit = interaction.options.getInteger("quantidade") || 5;
        const docs = await runs.find({ guildId: String(interaction.guildId) }).sort({ createdAt: -1 }).limit(limit).toArray();
        if (!docs.length) return interaction.editReply("🌙 Ainda não há Drops registrados neste servidor.");
        const lines = docs.map((run, index) => {
          const winners = (run.winners || []).length ? run.winners.map(id => "<@" + id + ">").join(", ") : "Sem vencedores";
          return "**" + (index + 1) + ".** " + (run.status === "active" ? "Em andamento" : run.status === "paying" ? "Processando" : "Encerrado") +
            " · " + fmt(run.reward) + " KZ\nCanal: <#" + run.channelId + "> · Participantes: " + (run.participantCount ?? Object.keys(run.entries || {}).length) +
            "\nVencedores: " + winners;
        });
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xA7D8F0).setTitle("📜 Histórico de Drops").setDescription(lines.join("\n\n")).setFooter({ text: "Exibindo os " + docs.length + " registros mais recentes." })] });
      }

      if (action === "failures") {
        const docs = await attempts.find({ guildId: String(interaction.guildId), status: "failed" }).sort({ finishedAt: -1 }).limit(10).toArray();
        if (!docs.length) return interaction.editReply("🌸 Não há falhas de pagamento registradas.");
        const lines = docs.map((item, index) => "**" + (index + 1) + ".** <@" + item.userId + "> · tentativa " + item.attempt + "/5\nDrop: `" + item.runId + "`\nMotivo: " + String(item.error || "Não informado").slice(0, 300));
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xE8C878).setTitle("⚠️ Falhas de pagamento").setDescription(lines.join("\n\n")).setFooter({ text: "Exibindo as 10 falhas mais recentes." })] });
      }

      if (action === "pending") {
        const docs = await payouts.find({ guildId: String(interaction.guildId), status: { $in: ["waiting_member", "staff_review", "creating_channel"] } }).sort({ createdAt: 1 }).limit(10).toArray();
        if (!docs.length) return interaction.editReply("🌸 Não há recompensas pendentes neste momento.");
        const lines = docs.map((p, i) => "**" + (i + 1) + ".** <@" + p.userId + "> · **" + fmt(p.amount) + " KZ**\nStatus: `" + p.status + "` · Drop: `" + p.runId + "`" + (p.privateChannelId ? " · Canal: <#" + p.privateChannelId + ">" : ""));
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xE8C878).setTitle("📦 Recompensas pendentes").setDescription(lines.join("\n\n")).setFooter({ text: "Até 10 entregas pendentes." })] });
      }
    } catch (error) {
      console.error("[Drop Controle] Falha ao executar ação:", error);
      return interaction.editReply("❄️ Não consegui consultar o sistema de Drops. Verifique os logs e tente novamente.");
    }
  }
};
