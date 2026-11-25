"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const crypto = require("node:crypto");
const idioma = require("../systems/idioma");
const cargoLocale = require("../systems/idioma/locales/cargo");
const roleExpiryStorage = require("../system-storage").forSystem("role-expirations");

function parseDuration(value) {
  if (value == null || value === "") return null;
  const match = String(value).trim().toLowerCase().match(/^(\d+)(m|h|d|w)$/);
  if (!match) return NaN;
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount < 1) return NaN;
  const multiplier = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[match[2]];
  const result = amount * multiplier;
  return Number.isSafeInteger(result) && result <= 3650 * 86_400_000 ? result : NaN;
}

async function cancelRoleExpirations(guildId, userId, roleId) {
  const records = await roleExpiryStorage.list(guildId, { limit: 2000 });
  await Promise.all(records
    .filter(item => item.key.startsWith("expiry:") && item.value?.userId === userId && item.value?.roleId === roleId)
    .map(item => roleExpiryStorage.delete(guildId, item.key)));
}

async function applyRoleChange({ guild, moderator, target, role, action, actor, t, durationMs = null, notifyExpiration = false }) {
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
  if (!shouldAdd && !hasRole) {
    return { ok: true, text: t("doesNotHave", { user: target.user.tag, role: role.name }) };
  }
  if (shouldAdd && hasRole && !durationMs) {
    try {
      await cancelRoleExpirations(guild.id, target.id, role.id);
      return {
        ok: true,
        text: t("alreadyHas", { user: target.user.tag, role: role.name }) +
          " Qualquer prazo temporário anterior foi cancelado; o cargo permanecerá até ser retirado manualmente."
      };
    } catch (error) {
      console.error("[Yukina cargo] Falha ao tornar permanente o cargo:", error);
      return { ok: false, text: t("failure") };
    }
  }

  try {
    if (shouldAdd) {
      if (!hasRole) await target.roles.add(role, "Cargo atribuído por " + actor);
      // Evita manter vencimentos antigos quando o cargo é concedido ou renovado.
      await cancelRoleExpirations(guild.id, target.id, role.id);
      if (durationMs) {
        const expiresAt = new Date(Date.now() + durationMs);
        const recordId = crypto.randomUUID();
        await roleExpiryStorage.set(guild.id, "expiry:" + recordId, {
          userId: target.id,
          roleId: role.id,
          roleName: role.name,
          guildName: guild.name,
          expiresAt: expiresAt.toISOString(),
          notifyExpiration: Boolean(notifyExpiration),
          assignedBy: moderator.id
        });
      }
      if (!hasRole) await require("../staff-promotion-announcements").announcePromotion(guild.client, target, role).catch(() => {});
      const durationText = durationMs
        ? " Duração: " + formatDuration(durationMs) + "."
        : "";
      const notificationText = durationMs
        ? (notifyExpiration ? " A notificação de expiração está ativada." : " A notificação de expiração está desativada.")
        : "";
      const successText = hasRole
        ? t("alreadyHas", { user: target.user.tag, role: role.name }) + " O prazo do cargo foi atualizado."
        : t("added", { role: role.name, user: target.user.tag });
      return { ok: true, text: successText + durationText + notificationText };
    }

    await target.roles.remove(role, "Cargo retirado por " + actor);
    await cancelRoleExpirations(guild.id, target.id, role.id);
    return { ok: true, text: t("removed", { role: role.name, user: target.user.tag }) };
  } catch (error) {
    console.error("[Yukina cargo] Falha ao alterar cargo:", error);
    return { ok: false, text: t("failure") };
  }
}

function formatDuration(milliseconds) {
  const units = [["d", 86_400_000], ["h", 3_600_000], ["m", 60_000]];
  let remaining = milliseconds;
  const parts = [];
  for (const [label, size] of units) {
    const count = Math.floor(remaining / size);
    if (count) parts.push(count + label);
    remaining %= size;
  }
  return parts.join(" ") || "menos de 1m";
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
      .addChoices({ name: "Conceder", value: "add" }, { name: "Retirar", value: "remove" }))
    .addStringOption(option => option.setName("duracao").setDescription("Opcional: 10m, 2h, 7d ou 1w."))
    .addBooleanOption(option => option.setName("notificar_expiracao").setDescription("Enviar DM quando o cargo temporário expirar?")),

  aliases: ["dar-cargo", "tirar-cargo"],

  async execute(interaction) {
    const language = await idioma.getUserLanguage(interaction.user.id);
    const t = (key, variables) => cargoLocale.getMessage(language, key, variables);
    if (!interaction.inGuild()) return interaction.reply({ content: t("serverOnly"), flags: MessageFlags.Ephemeral });
    const targetUser = interaction.options.getUser("usuario", true);
    const selectedRole = interaction.options.getRole("cargo", true);
    const action = interaction.options.getString("acao", true);
    const durationInput = interaction.options.getString("duracao");
    const durationMs = parseDuration(durationInput);
    if (Number.isNaN(durationMs)) {
      return interaction.reply({ content: "🌙 Duração inválida. Use formatos como 10m, 2h, 7d ou 1w (máximo de 10 anos).", flags: MessageFlags.Ephemeral });
    }
    const notifyExpiration = interaction.options.getBoolean("notificar_expiracao") ?? false;
    const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const role = await interaction.guild.roles.fetch(selectedRole.id).catch(() => null);
    const result = await applyRoleChange({
      guild: interaction.guild, moderator, target, role, action,
      actor: interaction.user.tag, t, durationMs, notifyExpiration
    });
    return interaction.reply({ content: result.text, flags: result.ok ? undefined : MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  },

  async prefixExecute(message, args = []) {
    const language = await idioma.getUserLanguage(message.author.id);
    const t = (key, variables) => cargoLocale.getMessage(language, key, variables);
    if (!message.guild) return message.reply(t("serverOnly"));
    const target = message.mentions.members.first();
    const tokens = [...args];
    const actionText = String(tokens.find(token => ["add", "adicionar", "conceder", "dar", "remove", "remover", "retirar", "tirar"].includes(String(token).toLowerCase())) || "").toLowerCase();
    const action = ["add", "adicionar", "conceder", "dar"].includes(actionText) ? "add"
      : ["remove", "remover", "retirar", "tirar"].includes(actionText) ? "remove" : null;
    const notificationToken = tokens.find(token => ["true", "false", "sim", "não", "nao"].includes(String(token).toLowerCase()));
    const notifyExpiration = ["true", "sim"].includes(String(notificationToken || "").toLowerCase());
    const durationToken = tokens.find(token => /^(\d+)(m|h|d|w)$/i.test(String(token)));
    const durationMs = parseDuration(durationToken);
    const roleMention = message.mentions.roles.first();
    const ignored = new Set([actionText, notificationToken, durationToken].filter(Boolean).map(String));
    const roleName = tokens
      .filter(arg => !/^<@!?\d{17,20}>$/.test(String(arg)) && !/^<@&\d{17,20}>$/.test(String(arg)) && !ignored.has(String(arg)))
      .join(" ")
      .trim();
    const role = roleMention || (await message.guild.roles.fetch().catch(() => message.guild.roles.cache))
      .find(candidate => candidate.name.toLocaleLowerCase("pt-BR") === roleName.toLocaleLowerCase("pt-BR"));
    if (!target || !role || !action) return message.reply(t("usage"));
    if (durationToken && Number.isNaN(durationMs)) return message.reply("🌙 Duração inválida. Use 10m, 2h, 7d ou 1w.");
    const moderator = message.member;
    const result = await applyRoleChange({
      guild: message.guild, moderator, target, role, action,
      actor: message.author.tag, t, durationMs, notifyExpiration
    });
    return message.reply({ content: result.text, allowedMentions: { parse: [] } });
  }
};
