/**
 * Anúncios de promoção da equipe.
 * Compartilha a mesma rotina entre alterações externas e o comando /cargo.
 */
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { getGuildSettings } = require("./guild-settings-store");

const inFlight = new Set();
const recentlySent = new Map();
const DEDUPE_WINDOW_MS = 30_000;

async function announcePromotion(client, member, promotedRole) {
  if (!member?.guild || member.user?.bot || !promotedRole) return false;
  const roleId = String(promotedRole.id || promotedRole);
  const key = member.guild.id + ":" + member.id + ":" + roleId;
  const sentAt = recentlySent.get(key) || 0;
  if (inFlight.has(key) || Date.now() - sentAt < DEDUPE_WINDOW_MS) return false;
  inFlight.add(key);

  try {
    const settings = await getGuildSettings(member.guild.id, { force: true });
    const config = settings.staffPromotion && typeof settings.staffPromotion === "object"
      ? settings.staffPromotion
      : {};
    const configuredRoleIds = Array.isArray(config.roleIds)
      ? config.roleIds.map(String)
      : (config.roleId ? [String(config.roleId)] : []);
    if (config.enabled === false || !configuredRoleIds.includes(roleId)) return false;

    const role = typeof promotedRole === "object"
      ? promotedRole
      : await member.guild.roles.fetch(roleId).catch(() => null);
    const channelId = String(config.channelId || "");
    const notificationRoleId = String(config.notificationRoleId || "");
    const channel = channelId ? await member.guild.channels.fetch(channelId).catch(() => null) : null;
    const notificationRole = notificationRoleId
      ? await member.guild.roles.fetch(notificationRoleId).catch(() => null)
      : null;
    if (!role || !channel || !channel.isTextBased() || channel.type === ChannelType.GuildVoice) return false;
    if (notificationRoleId && !notificationRole) {
      console.warn("[Promoção staff] O cargo de notificação configurado não existe mais no servidor.");
      return false;
    }

    const me = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
    const permissions = me && channel.permissionsFor(me);
    if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions.has(PermissionFlagsBits.SendMessages) ||
        (channel.isThread?.() && !permissions.has(PermissionFlagsBits.SendMessagesInThreads))) {
      console.warn("[Promoção staff] A Yukina não tem permissão para enviar anúncio no canal configurado.");
      return false;
    }

    const embed = new EmbedBuilder()
      .setColor(role.color || 0xA7D8F0)
      .setAuthor({ name: "Yukina • Promoção da equipe", iconURL: client.user.displayAvatarURL() })
      .setTitle("❄️ Uma nova etapa começa!")
      .setDescription("Parabéns a " + member.toString() + " pela promoção para " + role.toString() + "!\n\nQue esta nova responsabilidade seja marcada por confiança, dedicação e muitas conquistas.")
      .addFields(
        { name: "Membro promovido", value: member.user.tag, inline: true },
        { name: "Novo cargo", value: role.name, inline: true }
      )
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await channel.send({
      content: notificationRole ? notificationRole.toString() : undefined,
      embeds: [embed],
      allowedMentions: { users: [member.id], roles: notificationRole ? [notificationRole.id] : [], parse: [] }
    });
    recentlySent.set(key, Date.now());
    console.log("[Promoção staff] Anúncio publicado para " + member.user.tag + " em " + member.guild.name + ".");
    return true;
  } catch (error) {
    console.error("[Promoção staff] Falha ao anunciar promoção:", error.message || error);
    return false;
  } finally {
    inFlight.delete(key);
  }
}

function startStaffPromotionAnnouncements(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (!newMember?.guild || newMember.user?.bot) return;
    try {
      const settings = await getGuildSettings(newMember.guild.id);
      const config = settings.staffPromotion && typeof settings.staffPromotion === "object"
        ? settings.staffPromotion
        : {};
      const configuredRoleIds = Array.isArray(config.roleIds)
        ? config.roleIds.map(String)
        : (config.roleId ? [String(config.roleId)] : []);
      const addedRoleId = configuredRoleIds.find(id =>
        !oldMember.roles.cache.has(id) && newMember.roles.cache.has(id)
      );
      if (addedRoleId) await announcePromotion(client, newMember, addedRoleId);
    } catch (error) {
      console.error("[Promoção staff] Falha ao verificar alteração de cargos:", error.message || error);
    }
  });
  console.log("[Promoção staff] Anúncios de promoção da equipe ativados.");
}

startStaffPromotionAnnouncements.announcePromotion = announcePromotion;
module.exports = startStaffPromotionAnnouncements;
