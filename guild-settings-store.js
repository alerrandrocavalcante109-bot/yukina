/**
 * Leitura compartilhada das configurações salvas pelo painel da Yukina.
 * Usa a mesma coleção guild_settings que a API do painel.
 */
const { MongoClient } = require("mongodb");

const URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
let client = null;
let collection = null;
let connecting = null;
const cache = new Map();
const CACHE_TTL_MS = 30_000;

async function getCollection() {
  if (collection) return collection;
  if (!URI) return null;
  if (!connecting) {
    connecting = (async () => {
      client = client || new MongoClient(URI, { appName: "Yukina-GuildSettings", serverSelectionTimeoutMS: 10000 });
      await client.connect();
      collection = client.db(DB_NAME).collection("guild_settings");
      return collection;
    })().catch((error) => {
      connecting = null;
      console.warn("[Configurações do painel] Mongo indisponível:", error.message);
      return null;
    });
  }
  return connecting;
}

async function getGuildSettings(guildId, { force = false } = {}) {
  const key = String(guildId);
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.settings;
  try {
    const coll = await getCollection();
    if (!coll) return {};
    const doc = await coll.findOne({ guildId: key }, { projection: { settings: 1 } });
    const settings = doc?.settings && typeof doc.settings === "object" ? doc.settings : {};
    cache.set(key, { at: Date.now(), settings });
    return settings;
  } catch (error) {
    console.error("[Configurações do painel] Não consegui ler configurações do servidor " + key + ":", error.message);
    return cached?.settings || {};
  }
}

function invalidateGuildSettings(guildId) {
  cache.delete(String(guildId));
}

module.exports = { getGuildSettings, invalidateGuildSettings };
