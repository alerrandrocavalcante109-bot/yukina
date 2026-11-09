"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");

async function applyRoleChange({ guild, moderator, target, role, action, actor }) {
  if (!guild || !moderator || !target || !role) return { ok: false, text: "❄️ Não consegui localizar o membro ou o cargo." };
  if (!moderator.permissions?.has(PermissionFlagsBits.ManageRoles) && !moderator.permissions?.has(PermissionFlagsBits.Administrator)) {
    return { ok: false, text: "🌙 Você precisa da permissão **Gerenciar cargos** para usar essa função." };
  }
  if (role.id === guild.id || role.managed) return { ok: false, text: "🫧 Esse cargo não pode ser atribuído ou retirado manualmente." };

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return { ok: false, text: "🫧 Preciso da permissão **Gerenciar cargos** para executar essa ação." };
  if (role.position >= botMember.roles.highest.position) return { ok: false, text: "🌙 Não posso alterar esse cargo porque ele está acima ou no mesmo nível do meu cargo mais alto." };
  if (moderator.id !== guild.ownerId && role.position >= moderator.roles.highest.position) return { ok: false, text: "🌸 Você não pode alterar um cargo que esteja acima ou no mesmo nível do seu cargo mais alto." };
  if (target.id === guild.ownerId && moderator.id !== guild.ownerId) return { ok: false, text: "🫧 Você não pode alterar os cargos do proprietário do servidor." };
  if (target.id !== moderator.id && moderator.id !== guild.ownerId && target.roles.highest.position >= moderator.roles.highest.position) {
    return { ok: false, text: "🌙 Você não pode alterar os cargos de um membro com cargo igual ou superior ao seu." };
  }

  const shouldAdd = action === "add";
  const hasRole = target.roles.cache.has(role.id);
  if ((shouldAdd && hasRole) || (!shouldAdd && !hasRole)) {
    return { ok: true, text: shouldAdd ? "🌸 **" + target.user.tag + "** já possui o cargo **" + role.name + "**." : "🌙 **" + target.user.tag + "** não possui o cargo **" + role.name + "**." };
  }
  try {
    if (shouldAdd) {
      await target.roles.add(role, "Cargo atribuído por " + actor);
      await require("../staff-promotion-announcements").announcePromotion(guild.client, target, role).catch(() => {});
      return { ok: true, text: "❄️ O cargo **" + role.name + "** foi concedido a **" + target.user.tag + "**." };
    }
    await target.roles.remove(role, "Cargo retirado por " + actor);
    return { ok: true, text: "🌙 O cargo **" + role.name + "** foi retirado de **" + target.user.tag + "**." };
  } catch (error) {
    console.error("[Yukina cargo] Falha ao alterar cargo:", error);
    return { ok: false, text: "🫧 Não consegui alterar esse cargo. Verifique a hierarquia e as permissões do bot." };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cargo")
    .setDescription("Conceder ou retirar um cargo de um membro.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(option => option.setName("usuario").setDescription("Membro que terá o cargo alterado.").setRequired(true))
    .addRoleOption(option => option.setName("cargo").setDescription("Cargo que será concedido ou retirado.").setRequired(true))
    .addStringOption(option => option.setName("acao").setDescription("Escolha a ação.").setRequired(true)
      .addChoices({ name: "Conceder", value: "add" }, { name: "Retirar", value: "remove" })),

  aliases: ["dar-cargo", "tirar-cargo"],

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", flags: MessageFlags.Ephemeral });
    const targetUser = interaction.options.getUser("usuario", true);
    const selectedRole = interaction.options.getRole("cargo", true);
    const action = interaction.options.getString("acao", true);
    const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const role = await interaction.guild.roles.fetch(selectedRole.id).catch(() => null);
    const result = await applyRoleChange({ guild: interaction.guild, moderator, target, role, action, actor: interaction.user.tag });
    return interaction.reply({ content: result.text, flags: result.ok ? undefined : MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  },

  async prefixExecute(message, args = []) {
    const target = message.mentions.members.first();
    const role = message.mentions.roles.first();
    const actionText = String(args[args.length - 1] || "").toLowerCase();
    const action = ["add", "adicionar", "conceder", "dar"].includes(actionText) ? "add"
      : ["remove", "remover", "retirar", "tirar"].includes(actionText) ? "remove" : null;
    if (!target || !role || !action) return message.reply("🌸 Use Ycargo @membro @cargo conceder ou Ycargo @membro @cargo retirar.");
    const result = await applyRoleChange({ guild: message.guild, moderator: message.member, target, role, action, actor: message.author.tag });
    return message.reply({ content: result.text, allowedMentions: { parse: [] } });
  }
};
