/**
 * Hierarquia de membros Yukina — XP + tempo de permanência.
 * Os dados são compartilhados com xp-level-system.js e persistidos no MongoDB quando configurado.
 */
const memberData = require("./member-data");
const xpMultiplierStorage = require("./system-storage").forSystem("xp-multipliers");
const { getVipCollection } = require("./vip-store");

const XP_COOLDOWN_MS = 60_000;
const XP_MIN = 30;
const XP_MAX = 46;
const TENURE_CHECK_MS = 10 * 60_000;

const lastXpAt = new Map();
const multiplierCache = new Map();
const MULTIPLIER_CACHE_MS = 10_000;
const planMultiplierCache = new Map();
const PLAN_XP_MULTIPLIERS = { starter: 1.1, plus: 1.2, premium: 1.35, ultra: 1.5, infinity: 1.75 };

async function getActivePlanXpMultiplier(userId) {
  const now = Date.now();
  const cached = planMultiplierCache.get(String(userId));
  if (cached && now < cached.cacheUntil && (!cached.expiresAt || now < cached.expiresAt)) {
    return cached.multiplier;
  }

  try {
    const subscriptions = await getVipCollection();
    const active = await subscriptions.find({
      userId: String(userId),
      status: "active",
      expiresAt: { $gt: new Date(now) }
    }).toArray();
    // Em caso de mais de uma assinatura ativa, prevalece o maior plano.
    let multiplier = 1;
    let expiresAt = 0;
    for (const subscription of active) {
      const value = PLAN_XP_MULTIPLIERS[String(subscription.planKey || "").toLowerCase()] || 1;
      if (value > multiplier) {
        multiplier = value;
        expiresAt = new Date(subscription.expiresAt).getTime();
      }
    }
    const cacheUntil = Math.min(now + MULTIPLIER_CACHE_MS, expiresAt || Infinity);
    planMultiplierCache.set(String(userId), { multiplier, expiresAt, cacheUntil });
    return multiplier;
  } catch (error) {
    console.error("[XP plano] Falha ao consultar assinatura de " + userId + ":", error.message);
    return 1;
  }
}

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
  // Se o membro tiver vários cargos configurados, aplica somente o maior multiplicador.
  // O cargo não precisa ser exclusivo: qualquer combinação de cargos é aceita.
  let highestMultiplier = null;
  for (const rule of rules || []) {
    const roleId = String(rule?.role || rule?.roleId || rule?.role_id || "");
    const value = Number(rule?.multiplier);
    if (roleId && member.roles.cache.has(roleId) && Number.isFinite(value) && value >= 0.1) {
      highestMultiplier = highestMultiplier === null
        ? value
        : Math.max(highestMultiplier, value);
    }
  }
  const planMultiplier = await getActivePlanXpMultiplier(member.id);
  return Math.max(highestMultiplier ?? 1, planMultiplier);
}


// Os cargos de XP e de tempo são aplicados pelos sistemas próprios, lendo as configurações salvas no painel.

// Só considera mensagens com texto real: mais de 5 caracteres,
 // pelo menos 6 letras e palavras formadas por letras (acentos incluídos).
 // Também bloqueia sequências artificiais como "aaaaaa" ou "kkkkkk".
function isValidXpMessage(content) {
  const text = String(content || "").trim();
  if (text.length <= 5) return false;

  const normalized = text.normalize("NFC").toLocaleLowerCase("pt-BR");
  const letters = normalized.match(/[\p{L}]/gu) || [];
  if (letters.length < 6) return false;

  // Não permite mensagens compostas apenas por números/símbolos ou links.
  if (!/[\p{L}]{1,}/u.test(normalized)) return false;
  if (/https?:\/\/|www\./i.test(normalized)) return false;

  // Rejeita spam de uma mesma letra repetida em sequência.
  if (/(.)\1{3,}/u.test(normalized)) return false;

  // Cada trecho de texto deve ser uma palavra; pontuação comum é permitida.
  const words = normalized.match(/[\p{L}]+/gu) || [];
  if (!words.length) return false;
  if (words.some((word) => word.length === 1 && words.length > 1)) return false;

  // Bloqueia repetição artificial da mesma palavra.
  if (new Set(words).size !== words.length) return false;

  return true;
}

function startRankSystem(client) {
  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;
    if (!isValidXpMessage(message.content)) return;

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
