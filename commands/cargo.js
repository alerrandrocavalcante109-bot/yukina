"use strict";

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const temporaryRoles = require("../temporary-role-system");

const COLOR = 0xA7D8F0;

function makeEmbed(title, description, color = COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Yukina · Cuidando deste cantinho" })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cargo")
    .setDescription("《🎖️》Gerencia cargos temporários de membros.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName("membro")
        .setDescription("《❄️》Concede um cargo temporário a um membro.")
        .addUserOption(option =>
          option.setName("membro")
            .setDescription("《👤》Membro que receberá o cargo.")
            .setRequired(true))
        .addRoleOption(option =>
          option.setName("cargo")
            .setDescription("《🎖️》Cargo temporário que será concedido.")
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName("duracao")
            .setDescription("《⏳》Quantidade de tempo (mínimo 1 dia, máximo 1 ano).")
            .setMinValue(1)
            .setMaxValue(365)
            .setRequired(true))
        .addStringOption(option =>
          option.setName("unidade")
            .setDescription("《📅》Unidade da duração.")
            .addChoices(
              { name: "Dias", value: "dias" },
              { name: "Semanas", value: "semanas" },
              { name: "Meses (30 dias)", value: "meses" },
              { name: "Ano (365 dias)", value: "anos" }
            )
            .setRequired(true))
    ),

  async execute(interaction, client) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({
        embeds: [makeEmbed("❄️ Use em um servidor", "Este comando só pode ser usado dentro de um servidor.")],
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "membro") {
      return interaction.reply({
        embeds: [makeEmbed("🫧 Opção indisponível", "Use **/cargo membro** para conceder um cargo temporário.")],
        ephemeral: true,
      });
    }

    const actor = interaction.member;
    const targetUser = interaction.options.getUser("membro", true);
    const role = interaction.options.getRole("cargo", true);
    const amount = interaction.options.getInteger("duracao", true);
    const unit = interaction.options.getString("unidade", true);
    const unitDays = { dias: 1, semanas: 7, meses: 30, anos: 365 };
    const durationDays = amount * unitDays[unit];

    if (!actor.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        embeds: [makeEmbed("🔒 Permissão necessária", "Você precisa da permissão **Gerenciar cargos** para usar este comando.", 0xEFA6B8)],
        ephemeral: true,
      });
    }

    if (durationDays < 1 || durationDays > 365) {
      return interaction.reply({
        embeds: [makeEmbed("⏳ Duração inválida", "A duração precisa ser de **1 dia a 1 ano**. Para meses, cada mês conta como 30 dias.", 0xEFA6B8)],
        ephemeral: true,
      });
    }

    const guild = interaction.guild;
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        embeds: [makeEmbed("👤 Membro não encontrado", "Não consegui encontrar esse membro neste servidor.", 0xEFA6B8)],
        ephemeral: true,
      });
    }

    if (role.id === guild.id || role.managed || !botMember ||
        !botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
        role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        embeds: [makeEmbed("🪜 Hierarquia de cargos", "Não consigo conceder esse cargo. Verifique se tenho **Gerenciar cargos** e se meu cargo está acima do cargo escolhido.", 0xEFA6B8)],
        ephemeral: true,
      });
    }

    if (role.position >= actor.roles.highest.position && guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        embeds: [makeEmbed("🔒 Cargo acima de você", "Você só pode conceder cargos abaixo do seu cargo mais alto.", 0xEFA6B8)],
        ephemeral: true,
      });
    }

    if (member.roles.cache.has(role.id)) {
      const existing = await temporaryRoles.findActive(guild.id, member.id, role.id);
      if (!existing) {
        return interaction.reply({
          embeds: [makeEmbed("🎖️ O membro já possui o cargo", "Esse membro já tem o cargo, mas ele não está registrado como temporário pela Yukina. Remova o cargo primeiro ou escolha outro.", 0xEFA6B8)],
          ephemeral: true,
        });
      }
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await member.roles.add(role, "Cargo temporário concedido por " + interaction.user.tag + " via Yukina");
      const result = await temporaryRoles.createOrRenew({
        guildId: guild.id,
        guildName: guild.name,
        userId: member.id,
        roleId: role.id,
        roleName: role.name,
        grantedBy: interaction.user.id,
        durationDays,
        expiresAt: Date.now() + durationDays * 86_400_000,
      });

      const endTimestamp = Math.floor(result.expiresAt / 1000);
      const durationLabel = unit === "anos" ? amount + (amount === 1 ? " ano" : " anos")
        : unit === "meses" ? amount + (amount === 1 ? " mês" : " meses")
        : unit === "semanas" ? amount + (amount === 1 ? " semana" : " semanas")
        : amount + (amount === 1 ? " dia" : " dias");

      return interaction.editReply({
        embeds: [makeEmbed(
          "🎖️ Cargo temporário concedido!",
          "O cargo " + role.toString() + " foi concedido a " + member.toString() + ".\n\n" +
          "《⏳》**Duração:** " + durationLabel + "\n" +
          "《📅》**Termina:** <t:" + endTimestamp + ":F> (<t:" + endTimestamp + ":R>)\n\n" +
          "❄️ A Yukina enviará uma DM antes do vencimento para avisar que está chegando ao fim e orientar o membro a voltar ao servidor para solicitar a renovação."
        )],
      });
    } catch (error) {
      console.error("[Cargo temporário] Não consegui conceder/registrar o cargo:", error);
      return interaction.editReply({
        embeds: [makeEmbed("💧 Não consegui concluir", "Verifique minhas permissões, a hierarquia de cargos e a conexão do armazenamento. Nenhuma renovação será considerada concluída sem registro.", 0xEFA6B8)],
      });
    }
  },
};
