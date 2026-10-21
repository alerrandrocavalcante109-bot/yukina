const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const PLANS = {
  starter: { name: "Starter", monthly: 790, annual: 7990 },
  plus: { name: "Plus", monthly: 990, annual: 9990 },
  premium: { name: "Premium", monthly: 1490, annual: 14990 },
  ultra: { name: "Ultra", monthly: 1990, annual: 19990 },
  infinity: { name: "Infinity", monthly: 2990, annual: 29990 },
};
const money = cents => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vip-comprar")
    .setDescription("Abre um atendimento privado para comprar um plano Yukina VIP.")
    .addStringOption(option => option.setName("plano").setDescription("Plano VIP desejado").setRequired(true)
      .addChoices(
        { name: "Starter", value: "starter" }, { name: "Plus", value: "plus" },
        { name: "Premium", value: "premium" }, { name: "Ultra", value: "ultra" },
        { name: "Infinity", value: "infinity" },
      ))
    .addStringOption(option => option.setName("periodo").setDescription("Duração do plano").setRequired(true)
      .addChoices({ name: "Mensal", value: "monthly" }, { name: "Anual", value: "annual" })),
  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ content: "Use este comando dentro do servidor da Yukina.", ephemeral: true });
    }
    const expectedGuild = (process.env.VIP_GUILD_ID || "").trim();
    if (interaction.guildId !== expectedGuild) {
      return interaction.reply({ content: "Este fluxo de compra só está habilitado no servidor oficial da Yukina.", ephemeral: true });
    }
    const pixKey = (process.env.VIP_PIX_KEY || "").trim();
    const adminId = (process.env.VIP_ADMIN_ID || "").trim();
    if (!pixKey || !/^\d{17,20}$/.test(adminId) || !/^\d{17,20}$/.test(expectedGuild)) {
      return interaction.reply({ content: "As compras VIP ainda não estão configuradas pela equipe. Tente novamente mais tarde.", ephemeral: true });
    }
    const planKey = interaction.options.getString("plano", true);
    const period = interaction.options.getString("periodo", true);
    const plan = PLANS[planKey];
    const amount = plan[period];
    const existing = interaction.guild.channels.cache.find(channel =>
      channel.type === ChannelType.GuildText &&
      channel.topic === `yukina-vip:${interaction.user.id}:${planKey}:${period}`
    );
    if (existing) {
      return interaction.reply({ content: `Você já tem um atendimento aberto para essa compra: ${existing}`, ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const admin = await guild.members.fetch(adminId).catch(() => null);
    if (!admin) {
      return interaction.editReply("Não consegui encontrar o administrador configurado neste servidor. Avise a equipe.");
    }
    const safeName = interaction.user.username.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 35) || "membro";
    const channel = await guild.channels.create({
      name: `compra-vip-${safeName}`.slice(0, 90),
      type: ChannelType.GuildText,
      topic: `yukina-vip:${interaction.user.id}:${planKey}:${period}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: admin.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] },
      ],
      reason: `Atendimento de compra VIP solicitado por ${interaction.user.id}`,
    });
    const embed = new EmbedBuilder()
      .setColor(0xA855F7)
      .setTitle("❄️ Compra de plano VIP — Yukina")
      .setDescription([
        `Olá ${interaction.user}, este é seu atendimento privado.`,
        "",
        `**Plano:** ${plan.name}`,
        `**Período:** ${period === "annual" ? "Anual" : "Mensal"}`,
        `**Valor:** ${money(amount)}`,
        "",
        "**Pix (chave):**",
        `\`\`\`${pixKey}\`\`\``,
        "",
        "Depois de pagar, envie aqui o comprovante ou o identificador da transação. A equipe vai conferir o pagamento manualmente. **Enviar comprovante não significa aprovação automática.**",
        "Por segurança, somente o administrador autorizado pode aprovar ou cancelar esta compra.",
      ].join("\n"))
      .setFooter({ text: `Pedido de ${interaction.user.tag} · ID ${interaction.user.id}` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`vip:approve:${interaction.user.id}:${planKey}:${period}`).setLabel("Compra feita com sucesso").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`vip:cancel:${interaction.user.id}:${planKey}:${period}`).setLabel("Compra cancelada").setStyle(ButtonStyle.Danger),
    );
    await channel.send({ content: `<@${interaction.user.id}> <@${admin.id}>`, embeds: [embed], components: [row], allowedMentions: { users: [interaction.user.id, admin.id] } });
    await interaction.editReply(`Atendimento privado criado: ${channel}. Faça o pagamento somente após conferir o plano e o valor no canal.`);
  },
};
