"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const idioma = require("../systems/idioma");
const cargoLocale = require("../systems/idioma/locales/cargo");

async function applyRoleChange({ guild, moderator, target, role, action, actor, t }) {
  if (!guild || !moderator || !target || !role) return { ok: false, text: t("missing") };
  if (!moderator.permissions?.has(PermissionFlagsBits.ManageRoles) && !moderator.permissions?.has(PermissionFlagsBits.Administrator)) {
    return { ok: false, text: t("permission") };
  }
  if (role.id === guild.id || role.managed) return { ok: false, text: t("roleInvalid") };

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return { ok: false, text: t("botPermission") };
  if (role.position >= botMember.roles.highest.position) return { ok: false, text: t("botHierarchy") };
  if (moderator.id !== guild.ownerId && role.position >= moderator.roles.highest.position) return { ok: false, text: t("modHierarchy") };
  if (target.id === guild.ownerId && moderator.id !== guild.ownerId) return { ok: false, text: t("ownerTarget") };
  if (target.id !== moderator.id && moderator.id !== guild.ownerId && target.roles.highest.position >= moderator.roles.highest.position) {
    return { ok: false, text: t("targetHierarchy") };
  }

  const shouldAdd = action === "add";
  const hasRole = target.roles.cache.has(role.id);
  if ((shouldAdd && hasRole) || (!shouldAdd && !hasRole)) {
    return {
      ok: true,
      text: shouldAdd
        ? t("alreadyHas", { user: target.user.tag, role: role.name })
        : t("doesNotHave", { user: target.user.tag, role: role.name })
    };
  }
  try {
    if (shouldAdd) {
      await target.roles.add(role, "Cargo atribuído por " + actor);
      await require("../staff-promotion-announcements").announcePromotion(guild.client, target, role).catch(() => {});
      return { ok: true, text: t("added", { role: role.name, user: target.user.tag }) };
    }
    await target.roles.remove(role, "Cargo retirado por " + actor);
    return { ok: true, text: t("removed", { role: role.name, user: target.user.tag }) };
  } catch (error) {
    console.error("[Yukina cargo] Falha ao alterar cargo:", error);
    return { ok: false, text: t("failure") };
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
    const language = await idioma.getUserLanguage(interaction.user.id);
    const t = (key, variables) => cargoLocale.getMessage(language, key, variables);
    if (!interaction.inGuild()) return interaction.reply({ content: t("serverOnly"), flags: MessageFlags.Ephemeral });
    const targetUser = interaction.options.getUser("usuario", true);
    const selectedRole = interaction.options.getRole("cargo", true);
    const action = interaction.options.getString("acao", true);
    const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const role = await interaction.guild.roles.fetch(selectedRole.id).catch(() => null);
    const result = await applyRoleChange({ guild: interaction.guild, moderator, target, role, action, actor: interaction.user.tag, t });
    return interaction.reply({ content: result.text, flags: result.ok ? undefined : MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  },

  async prefixExecute(message, args = []) {
    const language = await idioma.getUserLanguage(message.author.id);
    const t = (key, variables) => cargoLocale.getMessage(language, key, variables);
    if (!message.guild) return message.reply(t("serverOnly"));
    const target = message.mentions.members.first();
    const actionText = String(args[args.length - 1] || "").toLowerCase();
    const action = ["add", "adicionar", "conceder", "dar"].includes(actionText) ? "add"
      : ["remove", "remover", "retirar", "tirar"].includes(actionText) ? "remove" : null;
    const roleMention = message.mentions.roles.first();
    const roleName = args
      .filter(arg => !/^<@!?\\d{17,20}>$/.test(String(arg)) && !/^<@&\\d{17,20}>$/.test(String(arg)))
      .slice(0, -1)
      .join(" ")
      .trim();
    const role = roleMention || (await message.guild.roles.fetch().catch(() => message.guild.roles.cache))
      .find(candidate => candidate.name.toLocaleLowerCase("pt-BR") === roleName.toLocaleLowerCase("pt-BR"));
    if (!target || !role || !action) return message.reply(t("usage"));
    const result = await applyRoleChange({ guild: message.guild, moderator: message.member, target, role, action, actor: message.author.tag, t });
    return message.reply({ content: result.text, allowedMentions: { parse: [] } });
  }
};
