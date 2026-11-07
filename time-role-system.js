/**
 * Cargos por tempo de permanência configurados no painel da Yukina.
 * Não altera cargos de XP nem a hierarquia de membros do rank-system.js.
 */
const { PermissionFlagsBits } = require("discord.js");
const { getGuildSettings } = require("./guild-settings-store");
const temporalStorage = require("./system-storage").forSystem("temporal-hierarchy");

const CHECK_INTERVAL_MS = 10 * 60_000;
const knownConfiguredRoleIds = new Map();
const memberLocks = new Set();

function tenureDays(member) {
  if (!member.joinedAt) return 0;
  return Math.max(0, (Date.now() - member.joinedAt.getTime()) / 86_400_000);
}

async function updateTimedRoles(member) {
  if (!member?.guild || member.user?.bot) return;
  const lockKey = member.guild.id + ":" + member.id;
  if (memberLocks.has(lockKey)) return;
  memberLocks.add(lockKey);

  try {
    let config = await temporalStorage.get(member.guild.id, "config", null);
    if (!config) {
      // Compatibilidade e migração segura de configurações anteriores.
      const legacy = await getGuildSettings(member.guild.id);
      if (Array.isArray(legacy.timeRules) || Array.isArray(legacy.timeManagedRoleIds)) {
        config = {
          timeRules: Array.isArray(legacy.timeRules) ? legacy.timeRules : [],
          timeManagedRoleIds: Array.isArray(legacy.timeManagedRoleIds) ? legacy.timeManagedRoleIds : [],
        };
        await temporalStorage.set(member.guild.id, "config", config);
        console.log("[Cargos temporais] Configuração antiga migrada para system-storage em " + member.guild.id + ".");
      } else {
        config = {};
      }
    }
    const rules = Array.isArray(config.timeRules)
      ? config.timeRules
          .map((rule) => ({ days: Number(rule?.days), roleId: String(rule?.roleId || rule?.role_id || rule?.role || "") }))
          .filter((rule) => Number.isInteger(rule.days) && rule.days >= 1 && rule.roleId)
          .sort((a, b) => a.days - b.days)
      : [];
    const settings = config;

    // Só gerencia cargos que o painel definiu para o sistema temporal.
    const remembered = knownConfiguredRoleIds.get(member.guild.id) || new Set();
    for (const rule of rules) remembered.add(rule.roleId);
    knownConfiguredRoleIds.set(member.guild.id, remembered);

    const managedIds = new Set([...remembered, ...rules.map(rule => rule.roleId), ...(Array.isArray(settings.timeManagedRoleIds) ? settings.timeManagedRoleIds.map(String) : [])]);
    const me = member.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      console.warn("[Cargos temporais] A Yukina precisa de Gerenciar cargos em " + member.guild.name + ".");
      return;
    }

    const days = tenureDays(member);
    let selectedRole = null;
    for (const rule of rules) {
      const role = member.guild.roles.cache.get(rule.roleId);
      if (!role || role.managed || role.position >= me.roles.highest.position) continue;
      if (days >= rule.days) selectedRole = role;
    }

    const current = member.roles.cache.filter(role => managedIds.has(role.id));
    const removeIds = current.filter(role => !selectedRole || role.id !== selectedRole.id).map(role => role.id);
    const hasSelected = selectedRole ? current.has(selectedRole.id) : false;

    if (removeIds.length) await member.roles.remove(removeIds, "Atualização de cargo por tempo de permanência da Yukina");
    if (selectedRole && !hasSelected) {
      await member.roles.add(selectedRole, "Cargo temporal configurado no painel da Yukina");
      const announcement = settings.timeAnnouncement;
      if (announcement?.enabled === true &&
          Array.isArray(announcement.roleIds) &&
          announcement.roleIds.map(String).includes(selectedRole.id) &&
          announcement.channelId) {
        const channel = await member.guild.channels.fetch(String(announcement.channelId)).catch(() => null);
        if (channel?.isTextBased?.() && typeof channel.send === "function") {
          const { EmbedBuilder } = require("discord.js");
          const color = selectedRole.color || 0xC4B5FD;
          const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: "Yukina • Conquista temporal", iconURL: member.client.user.displayAvatarURL() })
            .setDescription("🌸 **Uma nova etapa foi alcançada!**\n\n" + member.toString() + " recebeu o cargo **" + selectedRole.name + "** por seu tempo de permanência no servidor.")
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .addFields({ name: "Tempo de permanência", value: Math.floor(days) + " dia(s)", inline: true })
            .setTimestamp();
          await channel.send({ embeds: [embed], allowedMentions: { users: [member.id], parse: [] } })
            .catch(error => console.warn("[Cargos temporais] Não foi possível enviar o aviso em #" + (channel.name || channel.id) + ":", error.message));
        }
      }
    }
  } catch (error) {
    console.error("[Cargos temporais] Falha ao atualizar " + member.user?.tag + ":", error.message);
  } finally {
    memberLocks.delete(lockKey);
  }
}

function startTimedRoleSystem(client) {
  client.on("guildMemberAdd", async member => {
    await updateTimedRoles(member);
  });

  const initialize = async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await guild.roles.fetch();
        // Busca os membros uma vez na inicialização; a atualização periódica usa o cache.
        await guild.members.fetch().catch(error => {
          console.warn("[Cargos temporais] Não consegui buscar todos os membros de " + guild.name + ":", error.message);
        });
      } catch (error) {
        console.warn("[Cargos temporais] Falha ao preparar " + guild.name + ":", error.message);
      }
      for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await updateTimedRoles(member);
      }
    }
    console.log("[Cargos temporais] Sistema integrado ao painel de hierarquia temporal.");
  };

  if (client.isReady()) void initialize();
  else client.once("clientReady", initialize);

  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await updateTimedRoles(member);
      }
    }
  }, CHECK_INTERVAL_MS).unref?.();
}

module.exports = startTimedRoleSystem;
