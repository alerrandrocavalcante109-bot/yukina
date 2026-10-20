"use strict";
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const pending = new Map();

function parseDuration(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,5})\s*(m|min|mins|minuto|minutos|h|hr|hrs|hora|horas|d|dia|dias|w|semana|semanas)$/i);
  if (!match) throw new Error("Duração inválida. Use 30m, 2h, 3d ou 1semana. Deixe vazio para banimento permanente.");
  const amount = Number(match[1]), unit = match[2].toLowerCase();
  const multiplier = /^m/.test(unit) ? 60000 : /^(h|hr|hrs|hora)/.test(unit) ? 3600000 : /^(d|dia)/.test(unit) ? 86400000 : 604800000;
  const ms = amount * multiplier;
  if (!Number.isSafeInteger(ms) || amount < 1 || ms > 365 * 86400000) throw new Error("A duração deve ser maior que zero e não pode ultrapassar 365 dias.");
  return ms;
}
function formatDuration(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes % 10080 === 0) return (minutes / 10080) + " semana(s)";
  if (minutes % 1440 === 0) return (minutes / 1440) + " dia(s)";
  if (minutes % 60 === 0) return (minutes / 60) + " hora(s)";
  return minutes + " minuto(s)";
}
function createConfirmation(data) {
  const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  pending.set(token, { ...data, createdAt: Date.now() });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("banir-membro:confirmar:" + token).setLabel("Banir usuário").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("banir-membro:silencioso:" + token).setLabel("Banimento silencioso").setStyle(ButtonStyle.Secondary)
  );
  const timer = setTimeout(() => pending.delete(token), 5 * 60 * 1000);
  timer.unref?.();
  return row;
}
async function createRequest({ guild, moderator, targetId, reason, durationValue, reply }) {
  if (!guild) return reply({ content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true });
  if (!moderator.permissions.has(PermissionFlagsBits.BanMembers)) return reply({ content: "Você precisa da permissão **Banir membros**.", ephemeral: true });
  if (targetId === moderator.id) return reply({ content: "Você não pode banir a si mesmo.", ephemeral: true });
  if (targetId === guild.client.user.id) return reply({ content: "Não posso banir a mim mesma.", ephemeral: true });
  let durationMs;
  try { durationMs = parseDuration(durationValue); } catch (error) { return reply({ content: "⚠️ " + error.message, ephemeral: true }); }
  const targetMember = await guild.members.fetch(targetId).catch(() => null);
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (targetMember) {
    if (targetMember.id === guild.ownerId) return reply({ content: "O dono do servidor não pode ser banido.", ephemeral: true });
    if (moderator.id !== guild.ownerId && targetMember.roles.highest.position >= moderator.roles.highest.position) return reply({ content: "Você não pode banir alguém com cargo igual ou superior ao seu.", ephemeral: true });
    if (botMember && targetMember.roles.highest.position >= botMember.roles.highest.position) return reply({ content: "Não consigo banir esse membro: o cargo dele está acima ou no mesmo nível do meu.", ephemeral: true });
  } else if (await guild.bans.fetch(targetId).catch(() => null)) {
    return reply({ content: "Esse usuário já está banido neste servidor.", ephemeral: true });
  }
  const safeReason = String(reason || "Nenhum motivo informado").trim().slice(0, 400);
  const row = createConfirmation({ guildId: guild.id, moderatorId: moderator.id, targetId, reason: safeReason, durationMs });
  const durationText = durationMs ? "\nDuração: **" + formatDuration(durationMs) + "**." : "\nDuração: **permanente**.";
  return reply({
    content: "<@" + moderator.id + ">, você vai banir <@" + targetId + "> do servidor?\n" +
      "Motivo: " + safeReason + "." + durationText + "\n\n⏳ **Tempo para aceitar: 5 minutos.**",
    components: [row], allowedMentions: { users: [moderator.id, targetId], parse: [] }, ephemeral: false
  });
}
module.exports = {
  data: new SlashCommandBuilder().setName("banirmembro").setDescription("Solicita confirmação antes de banir um membro.").setDMPermission(false)
    .addUserOption(o => o.setName("usuario").setDescription("Usuário que será banido").setRequired(true))
    .addStringOption(o => o.setName("motivo").setDescription("Motivo do banimento").setRequired(false).setMaxLength(400))
    .addStringOption(o => o.setName("duracao").setDescription("Opcional: 30m, 2h, 3d, 1semana; vazio = permanente").setRequired(false).setMaxLength(20)),
  aliases: ["banir", "ban", "membro", "banirmembro"],
  async execute(interaction) {
    return createRequest({ guild: interaction.guild, moderator: interaction.member, targetId: interaction.options.getUser("usuario", true).id,
      reason: interaction.options.getString("motivo") || "", durationValue: interaction.options.getString("duracao"), reply: payload => interaction.reply(payload) });
  },
  async prefixExecute(message) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    const target = message.mentions.users.first();
    if (!target) return message.reply("Uso: Ymembro @usuario [duração opcional] [motivo]. Exemplo: Ymembro @usuario 2d spam. Sem duração, o banimento é permanente.");
    const content = message.content.replace(/^\s*[Yy](?:banirmembro|banir|ban|membro)\b/i, "").trim();
    const withoutMention = content.replace(new RegExp("<@!?" + target.id + ">"), "").trim();
    const first = withoutMention.match(/^(\S+)/)?.[1] || "";
    let durationValue = null, reason = withoutMention;
    if (/^\d{1,5}\s*(m|min|mins|minuto|minutos|h|hr|hrs|hora|horas|d|dia|dias|w|semana|semanas)$/i.test(first)) {
      try { parseDuration(first); } catch (error) { return message.reply("⚠️ " + error.message); }
      durationValue = first; reason = withoutMention.slice(first.length).trim();
    }
    return createRequest({ guild: message.guild, moderator: message.member, targetId: target.id, reason, durationValue, reply: payload => message.reply(payload) });
  },
  _pending: pending,
  _formatDuration: formatDuration
};
