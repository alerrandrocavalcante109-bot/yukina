const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { getVipCollection } = require("../vip-store");

const OWNER_ID = "1533034328928555141";

const PLANS = {
  starter: "Starter",
  plus: "Plus",
  premium: "Premium",
  ultra: "Ultra",
  infinity: "Infinity",
};

function addPeriod(date, period) {
  const expiresAt = new Date(date);
  if (period === "annual") expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
  else expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  return expiresAt;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("plano-atribuir")
    .setDescription("Atribui um plano individual da Yukina para testes (somente proprietário).")
    .addUserOption(option =>
      option.setName("usuario")
        .setDescription("Conta que receberá o plano.")
        .setRequired(true))
    .addStringOption(option =>
      option.setName("plano")
        .setDescription("Plano que será atribuído.")
        .setRequired(true)
        .addChoices(
          { name: "Starter", value: "starter" },
          { name: "Plus", value: "plus" },
          { name: "Premium", value: "premium" },
          { name: "Ultra", value: "ultra" },
          { name: "Infinity", value: "infinity" }
        ))
    .addStringOption(option =>
      option.setName("duracao")
        .setDescription("Duração do plano.")
        .setRequired(true)
        .addChoices(
          { name: "30 dias (mensal)", value: "monthly" },
          { name: "365 dias (anual)", value: "annual" }
        )),

  async execute(interaction) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: "🌙 Este comando é reservado à administração da Yukina.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const target = interaction.options.getUser("usuario", true);
    const planKey = interaction.options.getString("plano", true);
    const period = interaction.options.getString("duracao", true);

    if (!PLANS[planKey] || !["monthly", "annual"].includes(period)) {
      return interaction.reply({
        content: "❄️ Plano ou duração inválidos.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const subscriptions = await getVipCollection();
      const now = new Date();
      const filter = { userId: String(target.id), guildId: { $exists: false } };
      const current = await subscriptions.findOne({
        ...filter,
        status: "active",
        expiresAt: { $gt: now },
      });
      const base = current?.expiresAt ? new Date(current.expiresAt) : now;
      const expiresAt = addPeriod(base, period);

      await subscriptions.updateOne(
        filter,
        {
          $set: {
            userId: String(target.id),
            planKey,
            period,
            status: "active",
            expiresAt,
            updatedAt: now,
            lastApprovedAt: now,
            remindersSent: [],
            source: "owner_test_command",
          },
          $setOnInsert: { createdAt: now },
          $unset: { guildId: "", roleId: "" },
        },
        { upsert: true }
      );

      return interaction.editReply({
        content: [
          "🌸 **Plano atribuído com sucesso!**",
          `**Usuário:** <@${target.id}>`,
          `**Plano:** ${PLANS[planKey]}`,
          `**Duração:** ${period === "annual" ? "365 dias" : "30 dias"}`,
          `**Validade até:** <t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
          "",
          "❄️ A assinatura já pode ser reconhecida pelo multiplicador do Daily.",
        ].join("\n"),
        allowedMentions: { users: [target.id] },
      });
    } catch (error) {
      console.error("[Plano Atribuir] Falha ao atribuir plano:", error);
      return interaction.editReply({
        content: "❄️ Não consegui salvar o plano no banco de dados. Verifique a conexão do MongoDB e os logs do bot.",
      });
    }
  },
};
