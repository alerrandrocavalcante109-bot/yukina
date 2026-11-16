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

// Nível 0 começa com 0 XP; cada 1.000 XP avança um nível.
function getCurrentLevel(xp) {
  const value = Math.max(0, Number(xp) || 0);
  return Math.floor(value / 1000);
}

const knownConfiguredRoleIds = new Map();
const lastAnnouncedMilestone = new Map();

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

    const announcementKey = member.guild.id + ":" + member.id;
    // No início do bot, registra marcos já alcançados para não repetir anúncios antigos.
    if (!announce && currentLevel % 5 === 0 && !lastAnnouncedMilestone.has(announcementKey)) {
      lastAnnouncedMilestone.set(announcementKey, currentLevel);
    }

    // A mensagem de evolução é enviada somente nos níveis 5, 10, 15, 20...
    if (announce && currentLevel % 5 === 0 &&
        lastAnnouncedMilestone.get(announcementKey) !== currentLevel) {
      const guildSettings = await getGuildSettings(member.guild.id, { force: true });
      const config = guildSettings.xpAnnouncement && typeof guildSettings.xpAnnouncement === "object" ? guildSettings.xpAnnouncement : {};
      let channel = config.channelId ? member.guild.channels.cache.get(String(config.channelId)) : member.guild.systemChannel;
      if (config.channelId && !channel) channel = await member.guild.channels.fetch(String(config.channelId)).catch(() => null);
      const me = member.guild.members.me;
      if (channel && channel.isTextBased?.() && channel.send &&
          channel.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel) &&
          channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
        const template = typeof config.message === "string" && config.message.trim()
          ? config.message.slice(0, 1800)
          : "{@usar} você acaba de subir para o nível {nivel} com ({xp})!";
        const members = memberData.getMembers();
        const ranking = Object.entries(members)
          .filter(([key, value]) => key.startsWith(member.guild.id + ":") && value && typeof value === "object")
          .sort((a, b) => (Number(b[1].xp) || 0) - (Number(a[1].xp) || 0));
        const rank = Math.max(1, ranking.findIndex(([key]) => key === member.guild.id + ":" + member.id) + 1);
        const avatar = member.displayAvatarURL({ extension: "png", size: 256 });
        const serverIcon = member.guild.iconURL({ extension: "png", size: 256 }) || "";
        const replacements = {
          "{usar Nome}": member.displayName,
          "{nivel}": String(currentLevel),
          "{xp}": xp.toLocaleString("pt-BR"),
          "{@usar}": member.toString(),
          "{id}": member.id,
          "{rank}": String(rank),
          "{foto server}": serverIcon,
          "{avatar}": avatar,
          "{nome server}": member.guild.name,
        };
        const message = template.replace(/\{usar Nome\\}|\{nivel\\}|\{xp\\}|\{@usar\\}|\{id\\}|\{rank\\}|\{foto server\\}|\{avatar\\}|\{nome server\\}/g, token => replacements[token] ?? token);
        const format = config.format === "embed" ? "embed" : "text";
        if (format === "embed") {
          const color = /^#[0-9a-f]{6}$/i.test(String(config.color || "")) ? parseInt(String(config.color).slice(1), 16) : 0xc4b5fd;
          const embed = {
            color,
            description: message,
            author: { name: member.displayName, icon_url: avatar },
            thumbnail: serverIcon ? { url: serverIcon } : undefined,
            footer: { text: member.guild.name },
          };
          await channel.send({ embeds: [embed], allowedMentions: { users: [member.id] } });
        } else {
          await channel.send({ content: message, allowedMentions: { users: [member.id] } });
        }
        lastAnnouncedMilestone.set(announcementKey, currentLevel);
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
