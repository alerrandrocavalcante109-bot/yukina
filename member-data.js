/**
 * Armazenamento compartilhado dos dados de membros.
 * O MongoDB pode ser pausado temporariamente com MONGODB_ENABLED=false.
 * Nesse modo, os dados são guardados em JSON local até a conexão com o Atlas ser reativada.
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "member-ranks.json");
const MONGODB_ENABLED = (process.env.MONGODB_ENABLED || "false").trim().toLowerCase() === "true";
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
  const record = store.members[key];
  if (!record) return;

  if (!collection) {
    saveLocal();
    return;
  }

  try {
    await collection.updateOne(
      { _id: key },
      {
        $set: {
          xp: Math.max(0, Number(record.xp) || 0),
          joinedAt: record.joinedAt || null,
          rank: record.rank || null,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("[MongoDB] Falha ao persistir membro " + key + ":", error.message);
    throw error;
  }
}

function logConnectionFailure(error) {
  const message = String(error?.message || error || "erro desconhecido");
  console.error("[MongoDB] Falha na conexão/verificação:", {
    name: error?.name || "Error",
    code: error?.code || error?.codeName || "sem código",
    message: message.slice(0, 700),
  });
  if (/authentication failed|bad auth|auth failed/i.test(message)) {
    console.error("[MongoDB] Confira usuário, senha e permissões do Database User no Atlas.");
  } else if (/not whitelisted|ip access list|current ip/i.test(message)) {
    console.error("[MongoDB] Confira Network Access no Atlas e autorize o IP de saída do ambiente onde a Yukina está rodando.");
  } else if (/tls|ssl|certificate|alert number 80/i.test(message)) {
    console.error("[MongoDB] Falha TLS. Use Node.js LTS atualizado, mantenha TLS habilitado e confira rede/DNS; não desative a validação de certificados.");
  } else if (/querySrv|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(message)) {
    console.error("[MongoDB] Confira DNS, conexão de rede e se o cluster Atlas está ativo.");
  }
}

async function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    loadLocal();
    if (!MONGODB_ENABLED) {
      console.warn("[Banco de membros] MongoDB temporariamente desativado (MONGODB_ENABLED=false); usando armazenamento JSON local. Dados novos podem não persistir entre reinicializações do Render.");
      return;
    }
    if (!MONGODB_URI) {
      console.warn("[Banco de membros] MONGODB_ENABLED=true, mas MONGODB_URI não está configurada; usando armazenamento local.");
      return;
    }

    try {
      mongoClient = new MongoClient(MONGODB_URI, {
        appName: "Yukina",
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      });
      await mongoClient.connect();

      const db = mongoClient.db(DATABASE_NAME);
      await db.command({ ping: 1 });
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

      // Migra registros locais ausentes no Atlas, sem sobrescrever dados já existentes no banco.
      const localRecords = Object.entries(store.members);
      for (const [key, record] of localRecords) {
        if (mongoKeys.has(key)) continue;
        await collection.updateOne(
          { _id: key },
          {
            $set: {
              xp: Math.max(0, Number(record.xp) || 0),
              joinedAt: record.joinedAt || null,
              rank: record.rank || null,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }

      saveLocal();
      console.log("[MongoDB] Conexão verificada com ping. Banco: " + DATABASE_NAME + "; coleção: " + COLLECTION_NAME + ".");
    } catch (error) {
      collection = null;
      if (mongoClient) await mongoClient.close().catch(() => {});
      mongoClient = null;
      logConnectionFailure(error);
      throw new Error("A Yukina não pode iniciar com MONGODB_URI configurada porque não conseguiu conectar ao Atlas. Corrija as configurações do MongoDB e reinicie o serviço.");
    }
  })();

  return initPromise;
}

function getMembers() {
  return store.members;
}

module.exports = { initialize, getRecord, getMembers, persistRecord, keyFor };
