/**
 * Hierarquia de membros Yukina — XP + tempo de permanência.
 * Os dados são compartilhados com xp-level-system.js e persistidos no MongoDB quando configurado.
 */
const { PermissionFlagsBits } = require("discord.js");
const memberData = require("./member-data");
const xpMultiplierStorage = require("./system-storage").forSystem("xp-multipliers");

const XP_COOLDOWN_MS = 60_000;
const XP_MIN = 8;
const XP_MAX = 15;
const TENURE_CHECK_MS = 10 * 60_000;

const RANKS = [
  { key: "novato", name: "❄️・Novato", color: 0xA7D8F0, xp: 0, days: 0 },
  { key: "membro", name: "🌸・Membro", color: 0xF2A7C6, xp: 100, days: 3 },
  { key: "veterano", name: "🌙・Veterano", color: 0x8ECAE6, xp: 500, days: 14 },
  { key: "lenda", name: "✨・Lenda", color: 0xF4D58D, xp: 1500, days: 45 },
];

const lastXpAt = new Map();
const multiplierCache = new Map();
const MULTIPLIER_CACHE_MS = 60_000;

async function getXpMultiplier(guildId, member) {
  const cached = multiplierCache.get(guildId);
  let rules;
  if (cached && Date.now() - cached.at < MULTIPLIER_CACHE_MS) {
    rules = cached.rules;
  } else {
    try {
      const config = await xpMultiplierStorage.get(guildId, "config", null);
      rules = Array.isArray(config?.multiplierRules) ? config.multiplierRules : null;
      if (!rules) {
        // Compatibilidade com servidores que ainda têm regras apenas no armazenamento antigo.
        const { getGuildSettings } = require("./guild-settings-store");
        const legacy = await getGuildSettings(guildId);
        rules = Array.isArray(legacy.multiplierRules) ? legacy.multiplierRules : [];
        if (Array.isArray(legacy.multiplierRules)) {
          await xpMultiplierStorage.set(guildId, "config", { multiplierRules: rules });
          console.log("[XP multiplicador] Configuração antiga migrada em " + guildId + ".");
        }
      }
      multiplierCache.set(guildId, { rules, at: Date.now() });
    } catch (error) {
      console.error("[XP multiplicador] Falha ao carregar regras de " + guildId + ":", error.message);
      return 1;
    }
  }
  let multiplier = 1;
  for (const rule of rules || []) {
    const roleId = String(rule?.role || "");
    const value = Number(rule?.multiplier);
    if (roleId && member.roles.cache.has(roleId) && Number.isFinite(value) && value >= 0.1) {
      multiplier = Math.max(multiplier, value);
    }
  }
  return multiplier;
}


function daysSince(date) {
  if (!date) return 0;
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 86_400_000);
}

async function ensureRankRoles(guild) {
  // A hierarquia nunca cria cargos automaticamente: usa apenas cargos já existentes.
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.warn("[Hierarquia] Yukina precisa da permissão Gerenciar cargos em " + guild.name + ".");
    return null;
  }

  const roles = new Map();
  for (const rank of RANKS) {
    const role = guild.roles.cache.find((item) => item.name === rank.name);
    if (!role) {
      console.warn("[Hierarquia] O cargo " + rank.name + " não existe em " + guild.name + "; não será criado automaticamente.");
      return null;
    }
    if (role.managed || role.position >= me.roles.highest.position) {
      console.warn("[Hierarquia] O cargo " + role.name + " está acima do cargo da Yukina; ajuste a hierarquia no Discord.");
      return null;
    }
    roles.set(rank.key, role);
  }
  return roles;
}

function rankFor(record, joinedAt) {
  const tenure = daysSince(joinedAt);
  let chosen = RANKS[0];
  for (const rank of RANKS) {
    if (record.xp >= rank.xp && tenure >= rank.days) chosen = rank;
  }
  return chosen;
}

async function updateMemberRank(member, announce = false) {
  if (!member || member.user.bot || !member.guild) return;
  const roles = await ensureRankRoles(member.guild);
  if (!roles) return;

  const record = memberData.getRecord(member.guild.id, member.id);
  const joinedAt = member.joinedAt || (record.joinedAt ? new Date(record.joinedAt) : new Date());
  if (!record.joinedAt) record.joinedAt = joinedAt.toISOString();
  const chosen = rankFor(record, joinedAt);
  const chosenRole = roles.get(chosen.key);
  if (!chosenRole) return;

  const rankRoleIds = new Set([...roles.values()].map((role) => role.id));
  const currentRankRoles = member.roles.cache.filter((role) => rankRoleIds.has(role.id));
  const alreadyHasChosen = currentRankRoles.has(chosenRole.id);
  const removeIds = currentRankRoles.filter((role) => role.id !== chosenRole.id).map((role) => role.id);

  try {
    if (removeIds.length) await member.roles.remove(removeIds, "Atualização da hierarquia de membros Yukina");
    if (!alreadyHasChosen) await member.roles.add(chosenRole, "Cargo automático da hierarquia Yukina");
    const changed = record.rank !== chosen.key || !alreadyHasChosen;
    record.rank = chosen.key;
    await memberData.persistRecord(memberData.keyFor(member.guild.id, member.id));

    if (announce && changed) {
      const channel = member.guild.systemChannel;
      if (channel && channel.viewable && channel.permissionsFor(member.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
        const description = chosen.key === "novato"
          ? "Boas-vindas à comunidade! Que sua jornada comece sob o luar de Yukina."
          : "Sua jornada continua! Você alcançou o patamar **" + chosen.name + "** graças à sua participação e ao tempo na comunidade.";
        await channel.send({
          content: chosen.key === "novato" ? "❄️ " + member.toString() + " recebeu o cargo **" + chosen.name + "**. " + description
            : "🌙 Parabéns, " + member.toString() + "! " + description,
          allowedMentions: { users: [member.id] },
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error("[Hierarquia] Não consegui atualizar os cargos de " + member.user.tag + ":", error.message);
  }
}

function startRankSystem(client) {
  client.on("guildMemberAdd", async (member) => {
    if (member.user.bot) return;
    await memberData.initialize();
    const record = memberData.getRecord(member.guild.id, member.id);
    record.joinedAt = member.joinedAt?.toISOString() || new Date().toISOString();
    await memberData.persistRecord(memberData.keyFor(member.guild.id, member.id));
    await updateMemberRank(member, true);
  });

  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;
    await memberData.initialize();
    const key = memberData.keyFor(message.guild.id, message.author.id);
    const now = Date.now();
    if (now - (lastXpAt.get(key) || 0) < XP_COOLDOWN_MS) return;
    lastXpAt.set(key, now);

    const record = memberData.getRecord(message.guild.id, message.author.id);
    if (!record.joinedAt) record.joinedAt = message.member.joinedAt?.toISOString() || new Date().toISOString();
    const before = rankFor(record, message.member.joinedAt || new Date(record.joinedAt));
    const baseXp = XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1));
    const multiplier = await getXpMultiplier(message.guild.id, message.member);
    const gainedXp = Math.max(1, Math.round(baseXp * multiplier));
    record.xp += gainedXp;
    await memberData.persistRecord(key);
    client.emit("yukinaXpUpdated", message.member);
    const after = rankFor(record, message.member.joinedAt || new Date(record.joinedAt));
    if (multiplier > 1) {
      console.log("[XP multiplicador] " + message.author.tag + " recebeu " + gainedXp + " XP (base " + baseXp + " × " + multiplier + ") em " + message.guild.name + ".");
    }
    if (after.key !== before.key) await updateMemberRank(message.member, true);
  });

  const initializeRanks = async () => {
    await memberData.initialize();
    for (const guild of client.guilds.cache.values()) {
      await ensureRankRoles(guild);
      for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await updateMemberRank(member, false);
      }
    }
    console.log("[Hierarquia] Progressão por XP e tempo ativada.");
  };
  if (client.isReady()) void initializeRanks();
  else client.once("clientReady", initializeRanks);

  setInterval(async () => {
    await memberData.initialize();
    for (const guild of client.guilds.cache.values()) {
      for (const member of guild.members.cache.values()) {
        if (member.user.bot) continue;
        const record = memberData.getRecord(guild.id, member.id);
        await updateMemberRank(member, record.rank !== null);
      }
    }
  }, TENURE_CHECK_MS).unref?.();
}

module.exports = startRankSystem;
