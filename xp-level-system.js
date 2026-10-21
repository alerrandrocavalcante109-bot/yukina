/**
 * Cargos de nível da Yukina — compartilha XP persistido no MongoDB com rank-system.js.
 * Não altera nem remove cargos da hierarquia por tempo de permanência.
 */
const { PermissionFlagsBits } = require("discord.js");
const memberData = require("./member-data");
const { getGuildSettings } = require("./guild-settings-store");
const xpStorage = require("./system-storage").forSystem("xp-level-roles");
const CHECK_INTERVAL_MS = 10 * 60_000;
const roleCache = new Map();
const updateLocks = new Set();

const LEVEL_ROLES = [
  { level: 1, name: "❄️・Nível 1 | Iniciante", xp: 0, color: 0xA7D8F0 },
  { level: 5, name: "🌱・Nível 5 | Aprendiz", xp: 500, color: 0xB7E4C7 },
  { level: 10, name: "🌸・Nível 10 | Explorador", xp: 1500, color: 0xF2A7C6 },
  { level: 15, name: "🩵・Nível 15 | Participante", xp: 3000, color: 0x83D6C5 },
  { level: 20, name: "🌙・Nível 20 | Dedicado", xp: 5000, color: 0x8ECAE6 },
  { level: 25, name: "✨・Nível 25 | Experiente", xp: 7500, color: 0xF4D58D },
  { level: 30, name: "💎・Nível 30 | Veterano", xp: 10500, color: 0x7DA0FA },
  { level: 40, name: "🪻・Nível 40 | Elite", xp: 15000, color: 0xB9A7E8 },
  { level: 50, name: "👑・Nível 50 | Mestre", xp: 20000, color: 0xFFD166 },
  { level: 60, name: "🌌・Nível 60 | Lendário", xp: 26000, color: 0x6C63FF },
  { level: 75, name: "🔮・Nível 75 | Mítico", xp: 35000, color: 0xC77DFF },
  { level: 100, name: "♾️・Nível 100 | Imortal", xp: 50000, color: 0xE0FBFC },
];

function getLevelRole(xp) {
  let selected = LEVEL_ROLES[0];
  for (const item of LEVEL_ROLES) {
    if (xp >= item.xp) selected = item;
  }
  return selected;
}

function getCurrentLevel(xp) {
  return getLevelRole(xp).level;
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
      .map((rule) => ({ level: Number(rule?.level), roleId: String(rule?.role || "") }))
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
    // Também limpa cargos padrão antigos, caso o servidor tenha migrado do modo automático
    // para regras personalizadas no painel.
    const legacyRoleIds = guild.roles.cache
      .filter(role => LEVEL_ROLES.some(item => item.name === role.name))
      .map(role => role.id);
    knownConfiguredRoleIds.set(guild.id, remembered);
    return { configured: true, roles, managedIds: new Set([...remembered, ...legacyRoleIds, ...validRules.map(rule => rule.roleId), ...(Array.isArray(settings.xpManagedRoleIds) ? settings.xpManagedRoleIds.map(String) : [])]) };
  }

  const roles = await ensureLevelRoles(guild);
  return { configured: false, roles: roles || new Map(), managedIds: new Set([...(roles || new Map()).values()].map(role => role.id)) };
}

async function ensureLevelRoles(guild) {
  const cached = roleCache.get(guild.id);
  if (cached && cached.every(([level, role]) => guild.roles.cache.has(role.id))) return new Map(cached);
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.warn("[Níveis XP] Yukina precisa da permissão Gerenciar cargos em " + guild.name + ".");
    return null;
  }

  const roles = new Map();
  for (const item of LEVEL_ROLES) {
    let role = guild.roles.cache.find((role) => role.name === item.name);
    if (!role) {
      try {
        role = await guild.roles.create({
          name: item.name,
          color: item.color,
          hoist: false,
          mentionable: false,
          permissions: [],
          reason: "Progressão automática de nível por XP da Yukina",
        });
      } catch (error) {
        console.error("[Níveis XP] Falha ao criar " + item.name + ":", error.message);
        return null;
      }
    }
    if (role.managed || role.position >= me.roles.highest.position) {
      console.warn("[Níveis XP] Coloque o cargo da Yukina acima de " + role.name + ".");
      return null;
    }
    roles.set(item.level, role);
  }
  return roles;
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
      const settings = await xpStorage.get(guild.id, "config", null) || await getGuildSettings(guild.id);
      if (!Array.isArray(settings.xpRules)) await ensureLevelRoles(guild);
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
