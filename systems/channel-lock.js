"use strict";

const { PermissionFlagsBits } = require("discord.js");

async function getTarget(message, args, optionName = "canal") {
  if (message) {
    const mentioned = message.mentions.channels.first();
    if (mentioned) return mentioned;
    const id = String(args?.[0] || "").replace(/[<#>]/g, "");
    if (/^\d{17,20}$/.test(id)) {
      return message.guild.channels.fetch(id).catch(() => null);
    }
    return message.channel;
  }
  return null;
}

async function changeChannel({ guild, channel, moderator, action, reply }) {
  if (!guild || !channel || channel.guildId !== guild.id) {
    return reply("❄️ Não encontrei esse canal neste servidor.");
  }
  if (!moderator?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
    return reply("🌙 Você precisa da permissão **Gerenciar canais** para fazer isso.");
  }

  const bot = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!bot?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
    return reply("🫧 Preciso da permissão **Gerenciar canais** para alterar este canal.");
  }

  const everyone = guild.roles.everyone;
  const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
  const explicit = overwrite?.deny?.has(PermissionFlagsBits.SendMessages) || false;
  const effective = channel.permissionsFor(everyone)?.has(PermissionFlagsBits.SendMessages) ?? true;

  if (action === "lock") {
    if (explicit || !effective) {
      return reply("🌙 O canal " + channel.toString() + " já está bloqueado por uma configuração existente. Não alterei as permissões.");
    }
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, {
        reason: "Bloqueio solicitado por " + moderator.user?.tag
      });
      return reply("🔒 O canal " + channel.toString() + " foi bloqueado. Para conversar, utilize outro canal disponível.");
    } catch (error) {
      console.error("[Yukina] Falha ao bloquear canal:", error);
      return reply("🫧 Não consegui bloquear esse canal. Verifique minhas permissões.");
    }
  }

  if (action === "unlock") {
    if (!explicit) {
      if (!effective) return reply("🌙 O canal está com bloqueio herdado de uma categoria ou outra configuração. Não alterei as permissões.");
      return reply("❄️ O canal " + channel.toString() + " não possui um bloqueio explícito para remover.");
    }
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, {
        reason: "Desbloqueio solicitado por " + moderator.user?.tag
      });
      return reply("🔓 O canal " + channel.toString() + " foi desbloqueado conforme as permissões herdadas.");
    } catch (error) {
      console.error("[Yukina] Falha ao desbloquear canal:", error);
      return reply("🫧 Não consegui desbloquear esse canal. Verifique minhas permissões.");
    }
  }
}

module.exports = { changeChannel, getTarget };
