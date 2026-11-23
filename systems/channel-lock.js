"use strict";
const { PermissionFlagsBits } = require("discord.js");
const languageSystem = require("./idioma");
const moderationLocale = require("./idioma/locales/moderation");
async function getTarget(message, args, optionName = "canal") {
  if (message) {
    const mentioned = message.mentions.channels.first();
    if (mentioned) return mentioned;
    const id = String(args?.[0] || "").replace(/[<#>]/g, "");
    if (/^\d{17,20}$/.test(id)) return message.guild.channels.fetch(id).catch(() => null);
    return message.channel;
  }
  return null;
}
async function changeChannel({ guild, channel, moderator, action, reply }) {
  const language = await languageSystem.getUserLanguage(moderator?.id);
  const t = (key, variables) => moderationLocale.getMessage(language, key, variables);
  if (!guild || !channel || channel.guildId !== guild.id) return reply(t("channelNotFound"));
  if (!moderator?.permissions?.has(PermissionFlagsBits.ManageChannels)) return reply(t("moderatorChannelPermission"));
  const bot = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!bot?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) return reply(t("botChannelPermission"));
  const everyone = guild.roles.everyone;
  const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
  const explicit = overwrite?.deny?.has(PermissionFlagsBits.SendMessages) || false;
  const effective = channel.permissionsFor(everyone)?.has(PermissionFlagsBits.SendMessages) ?? true;
  if (action === "lock") {
    if (explicit || !effective) return reply(t("lockAlready", { channel: channel.toString() }));
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason: "Bloqueio solicitado por " + moderator.user?.tag });
      return reply(t("lockSuccess", { channel: channel.toString() }));
    } catch (error) {
      console.error("[Yukina] Falha ao bloquear canal:", error);
      return reply(t("lockFailure"));
    }
  }
  if (action === "unlock") {
    if (!explicit) {
      if (!effective) return reply(t("unlockInherited"));
      return reply(t("unlockNotLocked", { channel: channel.toString() }));
    }
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, { reason: "Desbloqueio solicitado por " + moderator.user?.tag });
      return reply(t("unlockSuccess", { channel: channel.toString() }));
    } catch (error) {
      console.error("[Yukina] Falha ao desbloquear canal:", error);
      return reply(t("unlockFailure"));
    }
  }
}
module.exports = { changeChannel, getTarget };
