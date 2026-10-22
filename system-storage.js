/**
 * Persistência por sistema (XP, hierarquia temporal, etc.).
 * Preferência: MongoDB Atlas. Fallback: JSON local em data/system-storage.json
 * para a Yukina iniciar mesmo com Atlas pausado ou inacessível.
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

const URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
const MONGODB_ENABLED = (process.env.MONGODB_ENABLED || "true").trim().toLowerCase() !== "false";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "system-storage.json");

let client = null;
let db = null;
let connecting = null;
let mongoAvailable = null;
let localStore = null;

function loadLocal() {
  if (localStore) return localStore;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      localStore = parsed && typeof parsed === "object" ? parsed : {};
    } else {
      localStore = {};
    }
  } catch (error) {
    console.error("[system-storage] Falha ao ler JSON local:", error.message);
    localStore = {};
  }
  return localStore;
}

function saveLocal() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = DATA_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(localStore || {}, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (error) {
    console.error("[system-storage] Falha ao salvar JSON local:", error.message);
  }
}

function localKey(system, guildId, key, userId) {
  return [system, guildId, key, userId || ""].join("::");
}

function normalizeId(value, label) {
  const result = String(value ?? "").trim();
  if (!result) throw new TypeError(label + " é obrigatório.");
  return result;
}

async function getCollection() {
  if (!MONGODB_ENABLED || !URI) {
    mongoAvailable = false;
    return null;
  }
  if (db) return db.collection("system_storage");
  if (mongoAvailable === false) return null;

  if (!connecting) {
    connecting = (async () => {
      try {
        client = client || new MongoClient(URI, {
          appName: "Yukina-SystemStorage",
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        });
        await client.connect();
        db = client.db(DB_NAME);
        await db.command({ ping: 1 });
        mongoAvailable = true;
        console.log("[system-storage] MongoDB conectado (" + DB_NAME + ").");
        return db.collection("system_storage");
      } catch (error) {
        mongoAvailable = false;
        connecting = null;
        console.warn("[system-storage] Mongo indisponível; usando JSON local:", error.message);
        return null;
      }
    })();
  }
  return connecting;
}

function forSystem(systemName) {
  const system = String(systemName || "default").trim() || "default";

  function scope(guildId, key, userId = "") {
    return {
      system,
      guildId: normalizeId(guildId, "guildId"),
      key: normalizeId(key, "key"),
      userId: userId == null || userId === "" ? "" : String(userId),
    };
  }

  return {
    async get(guildId, key, userId = "") {
      const coll = await getCollection();
      const filter = scope(guildId, key, userId);
      if (coll) {
        try {
          const doc = await coll.findOne(filter);
          return doc?.value ?? null;
        } catch (error) {
          console.warn("[system-storage] get falhou, tentando local:", error.message);
        }
      }
      const store = loadLocal();
      const entry = store[localKey(system, filter.guildId, filter.key, filter.userId)];
      return entry?.value ?? null;
    },

    async set(guildId, key, value, userId = "") {
      const coll = await getCollection();
      const filter = scope(guildId, key, userId);
      const now = new Date();
      if (coll) {
        try {
          await coll.updateOne(
            filter,
            { $set: { ...filter, value, updatedAt: now }, $setOnInsert: { createdAt: now } },
            { upsert: true }
          );
          return value;
        } catch (error) {
          console.warn("[system-storage] set falhou, salvando local:", error.message);
        }
      }
      const store = loadLocal();
      const id = localKey(system, filter.guildId, filter.key, filter.userId);
      const prev = store[id];
      store[id] = {
        ...filter,
        value,
        createdAt: prev?.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      };
      saveLocal();
      return value;
    },

    async patch(guildId, key, patch, userId = "") {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        throw new TypeError("patch precisa ser um objeto.");
      }
      const coll = await getCollection();
      const filter = scope(guildId, key, userId);
      if (coll) {
        try {
          const current = await coll.findOne(filter);
          const currentValue =
            current?.value && typeof current.value === "object" && !Array.isArray(current.value)
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
        } catch (error) {
          console.warn("[system-storage] patch falhou, salvando local:", error.message);
        }
      }
      const store = loadLocal();
      const id = localKey(system, filter.guildId, filter.key, filter.userId);
      const prev = store[id];
      const currentValue =
        prev?.value && typeof prev.value === "object" && !Array.isArray(prev.value) ? prev.value : {};
      const value = { ...currentValue, ...patch };
      const now = new Date();
      store[id] = {
        ...filter,
        value,
        createdAt: prev?.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      };
      saveLocal();
      return value;
    },

    async delete(guildId, key, userId = "") {
      const coll = await getCollection();
      const filter = scope(guildId, key, userId);
      if (coll) {
        try {
          const result = await coll.deleteOne(filter);
          return result.deletedCount > 0;
        } catch (error) {
          console.warn("[system-storage] delete falhou, tentando local:", error.message);
        }
      }
      const store = loadLocal();
      const id = localKey(system, filter.guildId, filter.key, filter.userId);
      if (!(id in store)) return false;
      delete store[id];
      saveLocal();
      return true;
    },

    async list(guildId, { userId, limit = 500 } = {}) {
      const coll = await getCollection();
      const gid = normalizeId(guildId, "guildId");
      const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
      if (coll) {
        try {
          const filter = { system, guildId: gid };
          if (userId != null && userId !== "") filter.userId = String(userId);
          const docs = await coll.find(filter).sort({ updatedAt: -1 }).limit(safeLimit).toArray();
          return docs.map(({ key, userId: ownerId, value, createdAt, updatedAt }) => ({
            key,
            userId: ownerId || null,
            value,
            createdAt,
            updatedAt,
          }));
        } catch (error) {
          console.warn("[system-storage] list falhou, tentando local:", error.message);
        }
      }
      const store = loadLocal();
      const prefix = system + "::" + gid + "::";
      const out = [];
      for (const [id, entry] of Object.entries(store)) {
        if (!id.startsWith(prefix)) continue;
        if (userId != null && userId !== "" && String(entry.userId || "") !== String(userId)) continue;
        out.push({
          key: entry.key,
          userId: entry.userId || null,
          value: entry.value,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        });
        if (out.length >= safeLimit) break;
      }
      return out;
    },
  };
}

module.exports = { forSystem, getCollection };
