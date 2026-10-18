const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const pending = new Map();
const ACTIONS = {
  banir: { label: "banido", permission: PermissionFlagsBits.BanMembers, botPermission: PermissionFlagsBits.BanMembers },
  expulsar: { label: "expulso", permission: PermissionFlagsBits.KickMembers, botPermission: PermissionFlagsBits.KickMembers },
  timeout: { label: "colocado em timeout", permission: PermissionFlagsBits.ModerateMembers, botPermission: PermissionFlagsBits.ModerateMembers },
  "remover-timeout": { label: "retirado do timeout", permission: PermissionFlagsBits.ModerateMembers, botPermission: PermissionFlagsBits.ModerateMembers },
};

function hierarchyError(moderator, target, guild, botMember) {
  if (!moderator || !target || !botMember) return "Não consegui verificar os cargos e as permissões.";
  if (target.id === moderator.id) return "Você não pode aplicar esta ação em si mesmo.";
  if (target.id === guild.ownerId) return "A Yukina não permite aplicar esta ação ao dono do servidor.";
  if (moderator.id !== guild.ownerId && target.roles.highest.comparePositionTo(moderator.roles.highest) >= 0) return "Você só pode moderar membros com cargo inferior ao seu.";
  if (botMember.id !== guild.ownerId && target.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) return "Meu cargo precisa estar acima do cargo dessa pessoa para executar esta ação.";
  return null;
}

module.exports = {
  pending,
  ACTIONS,
  hierarchyError,
  data: new SlashCommandBuilder()
    .setName("moderar").setDescription("Executa ações de moderação após confirmação.")
    .addSubcommand(s => s.setName("banir").setDescription("Bane um membro após confirmação.")
      .addUserOption(o => o.setName("membro").setDescription("Membro que será banido.").setRequired(true))
      .addStringOption(o => o.setName("motivo").setDescription("Motivo da punição.").setMaxLength(400).setRequired(true)))
    .addSubcommand(s => s.setName("expulsar").setDescription("Expulsa um membro após confirmação.")
      .addUserOption(o => o.setName("membro").setDescription("Membro que será expulso.").setRequired(true))
      .addStringOption(o => o.setName("motivo").setDescription("Motivo da punição.").setMaxLength(400).setRequired(true)))
    .addSubcommand(s => s.setName("timeout").setDescription("Aplica timeout após confirmação.")
      .addUserOption(o => o.setName("membro").setDescription("Membro que receberá timeout.").setRequired(true))
      .addIntegerOption(o => o.setName("minutos").setDescription("Duração entre 1 e 40320 minutos.").setMinValue(1).setMaxValue(40320).setRequired(true))
      .addStringOption(o => o.setName("motivo").setDescription("Motivo da punição.").setMaxLength(400).setRequired(true)))
    .addSubcommand(s => s.setName("remover-timeout").setDescription("Retira timeout após confirmação.")
      .addUserOption(o => o.setName("membro").setDescription("Membro que terá timeout removido.").setRequired(true))
      .addStringOption(o => o.setName("motivo").setDescription("Motivo da ação.").setMaxLength(400).setRequired(false))),
  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Este comando só pode ser usado dentro de um servidor.", ephemeral: true });
    const action = interaction.options.getSubcommand();
    const config = ACTIONS[action];
    const user = interaction.options.getUser("membro", true);
    const reason = interaction.options.getString("motivo")?.trim() || "Motivo não informado.";
    const minutes = action === "timeout" ? interaction.options.getInteger("minutos", true) : null;
    const guild = interaction.guild;
    if (!interaction.memberPermissions?.has(config.permission)) return interaction.reply({ content: "Você não tem a permissão necessária para executar esta ação.", ephemeral: true });
    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) return interaction.reply({ content: "Não encontrei esse membro neste servidor.", ephemeral: true });
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const denial = hierarchyError(interaction.member, target, guild, botMember);
    if (denial) return interaction.reply({ content: denial, ephemeral: true });
    if (!botMember?.permissions.has(config.botPermission)) return interaction.reply({ content: "Preciso da permissão correspondente para executar essa ação. Confira minhas permissões e a posição do meu cargo.", ephemeral: true });

    const token = interaction.id + ":" + user.id;
    pending.set(token, { action, guildId: guild.id, targetId: user.id, moderatorId: interaction.user.id, reason, minutes, createdAt: Date.now() });
    const label = action === "banir" ? "Confirmar banir" : action === "expulsar" ? "Confirmar expulsar" : action === "timeout" ? "Confirmar timeout" : "Confirmar remoção";
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("moderar:confirmar:" + token).setLabel(label).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("moderar:cancelar:" + token).setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({
      content: "⚠️ **Confirme a ação de moderação**\\n\\nAção: **" + action + "**\\nMembro: " + user.tag + " (" + user.id + ")\\n" +
        (minutes ? "Duração: **" + minutes + " minuto(s)**\\n" : "") +
        "Motivo: " + reason + "\\n\\nA ação só será executada depois que você clicar em **" + label + "**. A confirmação expira em 60 segundos.",
      components: [row], ephemeral: true, allowedMentions: { parse: [] },
    });
    const timer = setTimeout(() => {
      const item = pending.get(token);
      if (item && Date.now() - item.createdAt >= 60000) pending.delete(token);
    }, 61000);
    timer.unref?.();
  },
};
