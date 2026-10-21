/**
 * Cargos por tempo de permanência configurados no painel da Yukina.
 * Não altera cargos de XP nem a hierarquia de membros do rank-system.js.
 */
const { PermissionFlagsBits } = require("discord.js");
const { getGuildSettings } = require("./guild-settings-store");

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
    const settings = await getGuildSettings(member.guild.id);
    const rules = Array.isArray(settings.timeRules)
      ? settings.timeRules
          .map((rule) => ({ days: Number(rule?.days), roleId: String(rule?.role || "") }))
          .filter((rule) => Number.isInteger(rule.days) && rule.days >= 1 && rule.roleId)
          .sort((a, b) => a.days - b.days)
      : [];

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
