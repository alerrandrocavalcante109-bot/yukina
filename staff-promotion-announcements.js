/**
 * Anúncios de promoção da equipe.
 * Publica quando um dos cargos de promoção configurados é adicionado ao membro.
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
    const configuredRoleIds = Array.isArray(config.roleIds)
      ? config.roleIds.map(String)
      : (config.roleId ? [String(config.roleId)] : []);
    const promotedRoleId = configuredRoleIds.find(id =>
      !oldMember.roles.cache.has(id) && newMember.roles.cache.has(id)
    );
    const channelId = String(config.channelId || "");
    const notificationRoleId = String(config.notificationRoleId || "");
    if (config.enabled === false || !promotedRoleId || !channelId) return;

    const lockKey = newMember.guild.id + ":" + newMember.id + ":" + promotedRoleId;
    if (locks.has(lockKey)) return;
    locks.add(lockKey);

    try {
      const role = await newMember.guild.roles.fetch(promotedRoleId).catch(() => null);
      const channel = await newMember.guild.channels.fetch(channelId).catch(() => null);
      const notificationRole = notificationRoleId
        ? await newMember.guild.roles.fetch(notificationRoleId).catch(() => null)
        : null;
      if (!role || !channel || !channel.isTextBased() || channel.type === ChannelType.GuildVoice) return;
      if (notificationRoleId && !notificationRole) {
        console.warn("[Promoção staff] O cargo de notificação configurado não existe mais no servidor.");
        return;
      }

      const me = newMember.guild.members.me || await newMember.guild.members.fetchMe().catch(() => null);
      const permissions = me && channel.permissionsFor(me);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
          !permissions.has(PermissionFlagsBits.SendMessages) ||
          (channel.isThread?.() && !permissions.has(PermissionFlagsBits.SendMessagesInThreads))) {
        console.warn("[Promoção staff] A Yukina não tem permissão para enviar anúncio no canal configurado.");
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
        content: notificationRole ? notificationRole.toString() : undefined,
        embeds: [embed],
        allowedMentions: { users: [newMember.id], roles: notificationRole ? [notificationRole.id] : [], parse: [] }
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
