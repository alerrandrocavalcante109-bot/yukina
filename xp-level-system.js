/**
 * Cargos de nível da Yukina — compartilha XP persistido no MongoDB com rank-system.js.
 * Não altera nem remove cargos da hierarquia por tempo de permanência.
 */
const { PermissionFlagsBits } = require("discord.js");
const memberData = require("./member-data");
const { getGuildSettings } = require("./guild-settings-store");
const xpStorage = require("./system-storage").forSystem("xp-level-roles");
const CHECK_INTERVAL_MS = 10 * 60_000;
const updateLocks = new Set();

const LEVEL_THRESHOLDS = [
  [1, 0], [5, 500], [10, 1500], [15, 3000], [20, 5000], [25, 7500],
  [30, 10500], [40, 15000], [50, 20000], [60, 26000], [75, 35000], [100, 50000],
];
function getCurrentLevel(xp) {
  const value = Math.max(0, Number(xp) || 0);
  // Interpola entre os marcos de XP para que qualquer nível de 1 a 100
  // configurado no painel possa realmente conceder o cargo selecionado.
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    const [nextLevel, nextXp] = LEVEL_THRESHOLDS[i];
    const [previousLevel, previousXp] = LEVEL_THRESHOLDS[i - 1];
    if (value < nextXp) {
      const xpPerLevel = (nextXp - previousXp) / (nextLevel - previousLevel);
      return Math.min(nextLevel - 1, previousLevel + Math.floor((value - previousXp) / xpPerLevel));
    }
  }
  const [lastLevel, lastXp] = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  if (value >= lastXp) return Math.min(100, lastLevel + Math.floor((value - lastXp) / 1000));
  return 1;
}

const knownConfiguredRoleIds = new Map();

async function resolveXpRoles(guild) {
  let settings = await xpStorage.get(guild.id, "config", null);
  if (!settings) {
    const legacy = await getGuildSettings(guild.id);
    if (Array.isArray(legacy.xpRules) || Array.isArray(legacy.xpManagedRoleIds)) {
      settings = {
        xpRules: Array.isArray(legacy.xpRules) ? legacy.xpRules : [],
        xpManagedRoleIds: Array.isArray(legacy.xpManagedRoleIds) ? legacy.xpManagedRoleIds : [],
      };
      await xpStorage.set(guild.id, "config", settings);
      console.log("[Níveis XP] Configuração antiga migrada para system-storage em " + guild.id + ".");
    } else {
      settings = legacy;
    }
  }
  // Uma lista vazia também é uma configuração explícita do painel.
  if (Array.isArray(settings.xpRules)) {
    const validRules = settings.xpRules
      .map((rule) => ({ level: Number(rule?.level), roleId: String(rule?.roleId || rule?.role_id || rule?.role || "") }))
      .filter((rule) => Number.isInteger(rule.level) && rule.level >= 1 && rule.roleId);
    const roles = new Map();
    const remembered = knownConfiguredRoleIds.get(guild.id) || new Set();
    const me = guild.members.me;
    for (const rule of validRules) {
      const role = guild.roles.cache.get(rule.roleId);
      if (role && !role.managed && me?.permissions.has(PermissionFlagsBits.ManageRoles) &&
          role.position < me.roles.highest.position) {
        roles.set(rule.level, role);
        remembered.add(role.id);
      } else if (role && (role.managed || !me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
          role.position >= me.roles.highest.position)) {
        console.warn("[Níveis XP] O cargo configurado para o nível " + rule.level +
          " não pode ser gerenciado pela Yukina. Confira permissões e hierarquia.");
      }
    }
    knownConfiguredRoleIds.set(guild.id, remembered);
    return { configured: true, roles, managedIds: new Set([...remembered, ...validRules.map(rule => rule.roleId), ...(Array.isArray(settings.xpManagedRoleIds) ? settings.xpManagedRoleIds.map(String) : [])]) };
  }

  // Sem regras salvas, o sistema fica inativo: nunca cria cargos automaticamente.
  settings = { xpRules: [], xpManagedRoleIds: [] };
  await xpStorage.set(guild.id, "config", settings);
  return { configured: true, roles: new Map(), managedIds: new Set() };
}

async function updateLevel(member, announce = false) {
  if (!member || member.user.bot || !member.guild) return;
  const resolved = await resolveXpRoles(member.guild);
  if (!resolved) return;

  const record = memberData.getRecord(member.guild.id, member.id);
  const xp = Math.max(0, Number(record.xp) || 0);
  const currentLevel = getCurrentLevel(xp);
  let selected = null;
  for (const [level, role] of [...resolved.roles.entries()].sort((a, b) => a[0] - b[0])) {
    if (currentLevel >= level) selected = { level, role };
  }
  const managedIds = resolved.managedIds;
  const current = member.roles.cache.filter((role) => managedIds.has(role.id));
  const selectedRole = selected?.role || null;
  const hadSelected = selectedRole ? current.has(selectedRole.id) : false;
  const removeIds = current.filter((role) => !selectedRole || role.id !== selectedRole.id).map((role) => role.id);

  try {
    if (removeIds.length) await member.roles.remove(removeIds, "Atualização de cargo por nível de XP");
    if (selectedRole && !hadSelected) await member.roles.add(selectedRole, "Cargo automático por nível de XP da Yukina");

    if (announce && selectedRole && !hadSelected) {
      const channel = member.guild.systemChannel;
      if (channel && channel.viewable &&
          channel.permissionsFor(member.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
        await channel.send({
          content: "✨ Parabéns, " + member.toString() + "! Você alcançou o nível **" + selected.level +
            "** e recebeu o cargo **" + selectedRole.name + "** com **" + xp.toLocaleString("pt-BR") + " XP**!",
          allowedMentions: { users: [member.id] },
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error("[Níveis XP] Não consegui atualizar " + member.user.tag + ":", error.message);
  }
}

function startXpLevelSystem(client) {
  client.on("guildMemberAdd", async (member) => {
    if (member.user.bot) return;
    await memberData.initialize();
    await updateLevel(member, false);
  });

  // O sistema de XP emite esse evento depois de persistir o XP novo.
  client.on("yukinaXpUpdated", async (member) => {
    await memberData.initialize();
    await updateLevel(member, true);
  });

  const initializeXpLevels = async () => {
    await memberData.initialize();
    for (const guild of client.guilds.cache.values()) {
      await resolveXpRoles(guild);
      for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await updateLevel(member, false);
      }
    }
    console.log("[Níveis XP] Cargos automáticos integrados ao painel por nível de XP.");
  };
  if (client.isReady()) void initializeXpLevels();
  else client.once("clientReady", initializeXpLevels);

  setInterval(async () => {
    await memberData.initialize();
    for (const guild of client.guilds.cache.values()) {
      for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await updateLevel(member, false);
      }
    }
  }, CHECK_INTERVAL_MS).unref?.();
}

module.exports = startXpLevelSystem;
