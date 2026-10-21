/**
 * Anúncios de promoção da equipe.
 * Publica somente quando o cargo configurado é adicionado a um membro.
 */
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { getGuildSettings } = require("./guild-settings-store");

const locks = new Set();

module.exports = function startStaffPromotionAnnouncements(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (!newMember?.guild || newMember.user?.bot) return;

    const settings = await getGuildSettings(newMember.guild.id);
    const config = settings.staffPromotion && typeof settings.staffPromotion === "object"
      ? settings.staffPromotion
      : {};
    const roleId = String(config.roleId || "");
    const channelId = String(config.channelId || "");
    if (!roleId || !channelId) return;

    // Apenas promoção: o cargo precisa ter sido adicionado nesta atualização.
    if (oldMember.roles.cache.has(roleId) || !newMember.roles.cache.has(roleId)) return;

    const lockKey = newMember.guild.id + ":" + newMember.id + ":" + roleId;
    if (locks.has(lockKey)) return;
    locks.add(lockKey);

    try {
      const role = newMember.guild.roles.cache.get(roleId);
      const channel = newMember.guild.channels.cache.get(channelId);
      if (!role || !channel || !channel.isTextBased() || channel.type === ChannelType.GuildVoice) return;

      const me = newMember.guild.members.me;
      const permissions = channel.permissionsFor(me);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
          !permissions.has(PermissionFlagsBits.SendMessages) ||
          (channel.isThread?.() && !permissions.has(PermissionFlagsBits.SendMessagesInThreads))) {
        console.warn("[Promoção staff] A Yukina não tem permissão para enviar anúncio em #" + channel.name + ".");
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(role.color || 0xA7D8F0)
        .setAuthor({ name: "Yukina • Promoção da equipe", iconURL: client.user.displayAvatarURL() })
        .setTitle("❄️ Uma nova etapa começa!")
        .setDescription("Parabéns a " + newMember.toString() + " pela promoção para " + role.toString() + "!\n\nQue esta nova responsabilidade seja marcada por confiança, dedicação e muitas conquistas.")
        .addFields(
          { name: "Membro promovido", value: newMember.user.tag, inline: true },
          { name: "Novo cargo", value: role.name, inline: true }
        )
        .setThumbnail(newMember.displayAvatarURL({ size: 256 }))
        .setTimestamp();

      await channel.send({
        embeds: [embed],
        allowedMentions: { users: [newMember.id], roles: [], parse: [] }
      });
      console.log("[Promoção staff] Anúncio publicado para " + newMember.user.tag + " em " + newMember.guild.name + ".");
    } catch (error) {
      console.error("[Promoção staff] Falha ao anunciar promoção:", error.message || error);
    } finally {
      locks.delete(lockKey);
    }
  });

  console.log("[Promoção staff] Anúncios de promoção da equipe ativados.");
};
