/**
 * Armazenamento compartilhado dos dados de membros.
 * MongoDB Atlas é usado quando MONGODB_URI está configurada; JSON local é fallback.
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "member-ranks.json");
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const DATABASE_NAME = (process.env.MONGODB_DB || "yukina").trim();
const COLLECTION_NAME = "member_ranks";

let store = { members: {} };
let mongoClient = null;
let collection = null;
let initPromise = null;

function loadLocal() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (parsed?.members && typeof parsed.members === "object") store = parsed;
    }
  } catch (error) {
    console.error("[Banco de membros] Não consegui ler o arquivo local:", error.message);
  }
}

function saveLocal() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = DATA_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(store, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (error) {
    console.error("[Banco de membros] Não consegui salvar o fallback local:", error.message);
  }
}

function keyFor(guildId, userId) {
  return String(guildId) + ":" + String(userId);
}

function getRecord(guildId, userId) {
  const key = keyFor(guildId, userId);
  if (!store.members[key]) store.members[key] = { xp: 0, joinedAt: null, rank: null };
  return store.members[key];
}

async function persistRecord(key) {
  if (!collection) {
    saveLocal();
    return;
  }
  const record = store.members[key];
  if (!record) return;
  try {
    await collection.updateOne(
      { _id: key },
      { $set: { xp: Number(record.xp) || 0, joinedAt: record.joinedAt || null, rank: record.rank || null, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    console.error("[MongoDB] Falha ao salvar progresso de membro:", error.message);
  }
}

async function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    loadLocal();
    if (!MONGODB_URI) {
      console.warn("[Banco de membros] MONGODB_URI não configurada; usando armazenamento local.");
      return;
    }

    try {
      mongoClient = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      await mongoClient.connect();
      const db = mongoClient.db(DATABASE_NAME);
      collection = db.collection(COLLECTION_NAME);

      const documents = await collection.find({}).toArray();
      const mongoKeys = new Set();
      for (const doc of documents) {
        if (!doc._id) continue;
        const key = String(doc._id);
        mongoKeys.add(key);
        store.members[key] = {
          xp: Math.max(0, Number(doc.xp) || 0),
          joinedAt: doc.joinedAt || null,
          rank: doc.rank || null,
        };
      }

      // Migra registros locais que ainda não existem no MongoDB, sem sobrescrever os do banco.
      for (const [key, record] of Object.entries(store.members)) {
        if (!mongoKeys.has(key)) {
          await collection.updateOne(
            { _id: key },
            { $set: { xp: Math.max(0, Number(record.xp) || 0), joinedAt: record.joinedAt || null, rank: record.rank || null, updatedAt: new Date() } },
            { upsert: true }
          );
        }
      }

      saveLocal();
      console.log("[MongoDB] Conectado. Dados de XP em " + DATABASE_NAME + "." + COLLECTION_NAME + ".");
    } catch (error) {
      collection = null;
      if (mongoClient) await mongoClient.close().catch(() => {});
      mongoClient = null;
      console.error("[MongoDB] Conexão falhou; usando fallback local:", error.message);
    }
  })();
  return initPromise;
}

function getMembers() {
  return store.members;
}

module.exports = { initialize, getRecord, getMembers, persistRecord, keyFor };
