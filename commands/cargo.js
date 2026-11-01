"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cargo")
    .setDescription("Adicionar ou retirar um cargo de um membro.")
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Membro que terá o cargo alterado.")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName("cargo")
        .setDescription("Cargo que será adicionado ou retirado.")
        .setRequired(true)
    ),

  async execute(interaction) {
    const { guild, user } = interaction;

    if (!guild) {
      return interaction.reply({
        content: "❄️ Este comando só pode ser usado dentro de um servidor.",
        ephemeral: true,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: "🌙 Você precisa da permissão **Gerenciar cargos** para usar este comando.",
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser("usuario", true);
    const selectedRole = interaction.options.getRole("cargo", true);

    if (selectedRole.id === guild.id || selectedRole.managed) {
      return interaction.reply({
        content: "🫧 Esse cargo não pode ser atribuído ou retirado manualmente.",
        ephemeral: true,
      });
    }

    const moderator = await guild.members.fetch(user.id).catch(() => null);
    const target = await guild.members.fetch(targetUser.id).catch(() => null);
    const role = await guild.roles.fetch(selectedRole.id).catch(() => null);
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);

    if (!target || !role || !moderator || !botMember) {
      return interaction.reply({
        content: "❄️ Não consegui localizar o membro, o cargo ou as permissões necessárias.",
        ephemeral: true,
      });
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: "🫧 Preciso da permissão **Gerenciar cargos** para executar essa ação.",
        ephemeral: true,
      });
    }

    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: "🌙 Não posso alterar esse cargo porque ele está acima ou no mesmo nível do meu cargo mais alto.",
        ephemeral: true,
      });
    }

    if (
      moderator.id !== guild.ownerId &&
      role.position >= moderator.roles.highest.position
    ) {
      return interaction.reply({
        content: "🌸 Você não pode alterar um cargo que esteja acima ou no mesmo nível do seu cargo mais alto.",
        ephemeral: true,
      });
    }

    const hasRole = target.roles.cache.has(role.id);

    try {
      if (hasRole) {
        await target.roles.remove(role, "Cargo retirado por " + user.tag);
        return interaction.reply({
          content: "🌙 O cargo **" + role.name + "** foi retirado de **" + target.user.tag + "**.",
          allowedMentions: { parse: [] },
        });
      }

      await target.roles.add(role, "Cargo atribuído por " + user.tag);
      return interaction.reply({
        content: "❄️ O cargo **" + role.name + "** foi atribuído a **" + target.user.tag + "**.",
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error("[Yukina /cargo] Falha ao alterar cargo:", error);
      return interaction.reply({
        content: "🫧 Não consegui alterar esse cargo. Verifique a hierarquia e as permissões do bot.",
        ephemeral: true,
      });
    }
  },
};
