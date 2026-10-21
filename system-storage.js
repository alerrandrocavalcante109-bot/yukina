/**
 * Armazenamento universal dos sistemas da Yukina.
 *
 * Um único módulo para persistir dados de qualquer sistema no MongoDB Atlas.
 * Cada sistema tem seu próprio namespace, sem precisar criar conexão, coleção
 * ou funções de salvamento repetidas.
 *
 * Uso:
 *   const storage = require("./system-storage");
 *   const ranks = storage.forSystem("ranks");
 *   await ranks.set(guildId, "config", { enabled: true });
 *   const config = await ranks.get(guildId, "config", {});
 *   await ranks.update(guildId, "config", { enabled: false });
 *   await ranks.delete(guildId, "config");
 *
 * Opcional: userId pode ser passado para separar dados por membro.
 */
const { MongoClient } = require("mongodb");

const URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
const COLLECTION_NAME = (process.env.YUKINA_STORAGE_COLLECTION || "system_storage").trim();

let client = null;
let collection = null;
let connecting = null;
let indexesReady = false;

function normalizeId(value, label) {
  const result = String(value ?? "").trim();
  if (!result) throw new TypeError(label + " é obrigatório.");
  return result;
}

async function getCollection() {
  if (collection) return collection;
  if (!URI) throw new Error("MONGODB_URI não está configurada; o armazenamento da Yukina não pode salvar dados.");
  if (!connecting) {
    connecting = (async () => {
      client = client || new MongoClient(URI, {
        appName: "Yukina-SystemStorage",
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      });
      await client.connect();
      const coll = client.db(DB_NAME).collection(COLLECTION_NAME);
      if (!indexesReady) {
        await coll.createIndex(
          { system: 1, guildId: 1, userId: 1, key: 1 },
          { unique: true, name: "unique_system_scope_key" }
        );
        await coll.createIndex({ system: 1, guildId: 1, updatedAt: -1 }, { name: "system_recent_updates" });
        indexesReady = true;
      }
      collection = coll;
      return coll;
    })().catch((error) => {
      connecting = null;
      client = null;
      throw error;
    });
  }
  return connecting;
}

function forSystem(systemName) {
  const system = normalizeId(systemName, "O nome do sistema");

  function scope(guildId, key, userId) {
    const filter = {
      system,
      guildId: normalizeId(guildId, "guildId"),
      userId: userId == null || userId === "" ? "" : String(userId),
      key: normalizeId(key, "A chave"),
    };
    return filter;
  }

  return Object.freeze({
    /** Lê um valor salvo. Retorna fallback quando ainda não existe. */
    async get(guildId, key, fallback = null, userId = "") {
      const coll = await getCollection();
      const doc = await coll.findOne(scope(guildId, key, userId));
      return doc && Object.prototype.hasOwnProperty.call(doc, "value") ? doc.value : fallback;
    },

    /** Cria ou substitui um valor completo, com salvamento imediato no Atlas. */
    async set(guildId, key, value, userId = "") {
      const coll = await getCollection();
      const now = new Date();
      const filter = scope(guildId, key, userId);
      await coll.updateOne(
        filter,
        { $set: { ...filter, value, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
      return value;
    },

    /** Atualiza campos de um objeto salvo sem apagar os demais campos. */
    async update(guildId, key, patch, userId = "") {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        throw new TypeError("patch precisa ser um objeto.");
      }
      const coll = await getCollection();
      const filter = scope(guildId, key, userId);
      const current = await coll.findOne(filter);
      const currentValue = current?.value && typeof current.value === "object" && !Array.isArray(current.value)
        ? current.value
        : {};
      const value = { ...currentValue, ...patch };
      const now = new Date();
      await coll.updateOne(
        filter,
        { $set: { ...filter, value, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
      return value;
    },

    /** Apaga apenas a chave indicada deste sistema/servidor/membro. */
    async delete(guildId, key, userId = "") {
      const coll = await getCollection();
      const result = await coll.deleteOne(scope(guildId, key, userId));
      return result.deletedCount > 0;
    },

    /** Lista os registros deste sistema em um servidor. */
    async list(guildId, { userId, limit = 500 } = {}) {
      const coll = await getCollection();
      const filter = { system, guildId: normalizeId(guildId, "guildId") };
      if (userId != null && userId !== "") filter.userId = String(userId);
      const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
      const docs = await coll.find(filter).sort({ updatedAt: -1 }).limit(safeLimit).toArray();
      return docs.map(({ key, userId: ownerId, value, createdAt, updatedAt }) => ({
        key, userId: ownerId || null, value, createdAt, updatedAt,
      }));
    },
  });
}

module.exports = { forSystem, getCollection };
