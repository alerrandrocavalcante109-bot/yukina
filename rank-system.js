/**
 * Hierarquia de membros Yukina — XP + tempo de permanência.
 * Os dados são compartilhados com xp-level-system.js e persistidos no MongoDB quando configurado.
 */
const memberData = require("./member-data");
const xpMultiplierStorage = require("./system-storage").forSystem("xp-multipliers");

const XP_COOLDOWN_MS = 60_000;
const XP_MIN = 8;
const XP_MAX = 15;
const TENURE_CHECK_MS = 10 * 60_000;

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


// Os cargos de XP e de tempo são aplicados pelos sistemas próprios, lendo as configurações salvas no painel.

function startRankSystem(client) {
  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;
    await memberData.initialize();
    const key = memberData.keyFor(message.guild.id, message.author.id);
    const now = Date.now();
    if (now - (lastXpAt.get(key) || 0) < XP_COOLDOWN_MS) return;
    lastXpAt.set(key, now);

    const record = memberData.getRecord(message.guild.id, message.author.id);
    if (!record.joinedAt) record.joinedAt = message.member.joinedAt?.toISOString() || new Date().toISOString();
    const baseXp = XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1));
    const multiplier = await getXpMultiplier(message.guild.id, message.member);
    const gainedXp = Math.max(1, Math.round(baseXp * multiplier));
    record.xp += gainedXp;
    await memberData.persistRecord(key);
    client.emit("yukinaXpUpdated", message.member);
    if (multiplier > 1) {
      console.log("[XP multiplicador] " + message.author.tag + " recebeu " + gainedXp + " XP (base " + baseXp + " × " + multiplier + ") em " + message.guild.name + ".");
    }
  });

  console.log("[XP] Progressão de XP ativa; cargos gerenciados exclusivamente pelas regras salvas no painel.");
}

module.exports = startRankSystem;
