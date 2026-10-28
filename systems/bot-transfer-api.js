"use strict";

const crypto = require("node:crypto");
const { MongoClient } = require("mongodb");

const URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
let mongoClient = null;
let dbPromise = null;

async function getDb() {
  if (!URI) throw new Error("MONGODB_URI não está configurada.");
  if (!dbPromise) {
    mongoClient = mongoClient || new MongoClient(URI, { appName: "Yukina-BotTransferAPI", serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
    dbPromise = mongoClient.connect().then(() => mongoClient.db(DB_NAME)).catch(error => { dbPromise = null; mongoClient = null; throw error; });
  }
  const db = await dbPromise;
  await Promise.all([
    db.collection("bot_api_integrations").createIndex({ botId: 1 }, { unique: true, name: "unique_integrated_bot" }),
    db.collection("bot_api_currencies").createIndex({ code: 1 }, { unique: true, name: "unique_api_currency" }),
    db.collection("bot_api_balances").createIndex({ botId: 1, userId: 1, currency: 1 }, { unique: true, name: "unique_bot_user_currency" }),
    db.collection("bot_api_operations").createIndex({ botId: 1, idempotencyKey: 1 }, { unique: true, name: "unique_bot_operation" }),
    db.collection("bot_api_transfers").createIndex({ transferId: 1 }, { unique: true, name: "unique_transfer_id" }),
    db.collection("bot_api_transfers").createIndex({ createdAt: -1 }, { name: "transfer_history_date" }),
  ]);
  return db;
}

function hashKey(key) { return crypto.createHash("sha256").update(String(key)).digest("hex"); }
function newApiKey() { return "yk_live_" + crypto.randomBytes(32).toString("base64url"); }
function safeId(value) { return /^\d{17,20}$/.test(String(value || "")); }
function safeToken(value) { return /^[a-zA-Z0-9_-]{2,32}$/.test(String(value || "")); }
function validAmount(value) { return Number.isSafeInteger(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER; }

async function createIntegration(botId, createdBy) {
  if (!safeId(botId)) throw new Error("Informe um ID de bot Discord válido (17 a 20 dígitos).");
  const db = await getDb();
  const integrations = db.collection("bot_api_integrations");
  const existing = await integrations.findOne({ botId });
  if (existing?.active) throw new Error("Esse bot já está integrado. Revogue a integração antes de gerar outra chave.");
  const key = newApiKey();
  const now = new Date();
  await integrations.updateOne(
    { botId },
    { $set: { botId, keyHash: hashKey(key), active: true, createdBy: String(createdBy), createdAt: now, updatedAt: now } },
    { upsert: true }
  );
  return { botId, key };
}

async function revokeIntegration(botId) {\n  if (!safeId(botId)) throw new Error("Informe um ID de bot Discord válido.");\n  const db = await getDb();\n  const result = await db.collection("bot_api_integrations").updateOne({ botId, active: true }, { $set: { active: false, revokedAt: new Date(), updatedAt: new Date() } });\n  if (!result.modifiedCount) throw new Error("Não encontrei uma integração ativa para esse bot.");\n  return true;\n}\n\nasync function registerCurrency(code, name, symbol, createdBy) {
  code = String(code || "").trim().toUpperCase();
  name = String(name || "").trim().slice(0, 60);
  symbol = String(symbol || "").trim().slice(0, 12);
  if (!safeToken(code) || !name || !symbol) throw new Error("Código (2–32 caracteres), nome e símbolo são obrigatórios.");
  const db = await getDb();
  await db.collection("bot_api_currencies").updateOne(
    { code },
    { $set: { code, name, symbol, active: true, updatedAt: new Date(), updatedBy: String(createdBy) }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  return { code, name, symbol };
}

async function listCurrencies() {
  const db = await getDb();
  return db.collection("bot_api_currencies").find({ active: true }).sort({ code: 1 }).limit(100).toArray();
}

async function findIntegration(req, db) {
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(yk_live_[A-Za-z0-9_-]{30,})$/);
  if (!match) return null;
  const integration = await db.collection("bot_api_integrations").findOne({ keyHash: hashKey(match[1]), active: true });
  return integration || null;
}

async function handleRequest(req, res, url, sendJson, readBody) {
  if (!url.pathname.startsWith("/api/bot-transfer/")) return false;
  const respond = (status, data) => sendJson(res, status, data);
  if (req.method !== "POST") { respond(405, { error: "method_not_allowed", message: "Use POST nesta rota." }); return true; }

  let body;
  try { body = await readBody(req); }
  catch (_) { respond(400, { error: "invalid_json", message: "Corpo JSON inválido." }); return true; }
  if (!body || typeof body !== "object" || Array.isArray(body)) { respond(400, { error: "invalid_body", message: "Envie um objeto JSON." }); return true; }

  let db;
  try { db = await getDb(); }
  catch (error) { console.error("[Bot Transfer API] Banco indisponível:", error.message); respond(503, { error: "storage_unavailable", message: "Armazenamento temporariamente indisponível." }); return true; }
  const integration = await findIntegration(req, db);
  if (!integration) { respond(401, { error: "unauthorized", message: "Chave de integração inválida, revogada ou ausente." }); return true; }

  const balances = db.collection("bot_api_balances");
  const currencies = db.collection("bot_api_currencies");
  const operations = db.collection("bot_api_operations");
  const transfers = db.collection("bot_api_transfers");
  const now = new Date();

  try {
    if (url.pathname === "/api/bot-transfer/currencies") {
      const items = await currencies.find({ active: true }, { projection: { _id: 0, code: 1, name: 1, symbol: 1 } }).sort({ code: 1 }).limit(100).toArray();
      respond(200, { ok: true, currencies: items }); return true;
    }

    if (url.pathname === "/api/bot-transfer/balance") {
      const userId = String(body.userId || "");
      const currency = String(body.currency || "").toUpperCase();
      if (!safeId(userId) || !safeToken(currency)) { respond(400, { error: "invalid_parameters", message: "userId ou currency inválido." }); return true; }
      const currencyDoc = await currencies.findOne({ code: currency, active: true });
      if (!currencyDoc) { respond(404, { error: "currency_not_found", message: "Moeda não cadastrada na API." }); return true; }
      const account = await balances.findOne({ botId: integration.botId, userId, currency });
      respond(200, { ok: true, botId: integration.botId, userId, currency, balance: Math.max(0, Number(account?.balance) || 0) }); return true;
    }

    if (url.pathname === "/api/bot-transfer/credit") {
      const userId = String(body.userId || "");
      const currency = String(body.currency || "").toUpperCase();
      const amount = body.amount;
      const idempotencyKey = String(body.idempotencyKey || "");
      if (!safeId(userId) || !safeToken(currency) || !validAmount(amount) || !/^[\w.:-]{8,128}$/.test(idempotencyKey)) {
        respond(400, { error: "invalid_parameters", message: "Informe userId, moeda, amount inteiro positivo e idempotencyKey (8–128 caracteres)." }); return true;
      }
      if (!await currencies.findOne({ code: currency, active: true })) { respond(404, { error: "currency_not_found", message: "Moeda não cadastrada na API." }); return true; }
      const session = mongoClient.startSession();
      let duplicate = false;
      try {
        await session.withTransaction(async () => {
          const prior = await operations.findOne({ botId: integration.botId, idempotencyKey }, { session });
          if (prior) { duplicate = true; return; }
          await balances.updateOne(
            { botId: integration.botId, userId, currency },
            { $inc: { balance: amount }, $set: { updatedAt: now }, $setOnInsert: { botId: integration.botId, userId, currency, createdAt: now } },
            { upsert: true, session }
          );
          await operations.insertOne({ botId: integration.botId, idempotencyKey, type: "credit", userId, currency, amount, createdAt: now }, { session });
        });
      } finally { await session.endSession(); }
      const account = await balances.findOne({ botId: integration.botId, userId, currency });
      respond(duplicate ? 200 : 201, { ok: true, duplicate, balance: Math.max(0, Number(account?.balance) || 0), currency }); return true;
    }

    if (url.pathname === "/api/bot-transfer/transfer") {
      const sourceUserId = String(body.fromUserId || "");
      const destinationBotId = String(body.toBotId || "");
      const destinationUserId = String(body.toUserId || "");
      const currency = String(body.currency || "").toUpperCase();
      const amount = body.amount;
      const idempotencyKey = String(body.idempotencyKey || "");
      if (!safeId(sourceUserId) || !safeId(destinationBotId) || !safeId(destinationUserId) || !safeToken(currency) ||
          !validAmount(amount) || !/^[\w.:-]{8,128}$/.test(idempotencyKey)) {
        respond(400, { error: "invalid_parameters", message: "IDs, moeda, amount inteiro positivo e idempotencyKey (8–128 caracteres) são obrigatórios." }); return true;
      }
      if (destinationBotId === integration.botId) { respond(400, { error: "same_bot", message: "O bot de destino precisa ser diferente do bot de origem." }); return true; }
      const [destIntegration, currencyDoc] = await Promise.all([
        db.collection("bot_api_integrations").findOne({ botId: destinationBotId, active: true }),
        currencies.findOne({ code: currency, active: true })
      ]);
      if (!destIntegration) { respond(403, { error: "destination_not_integrated", message: "O bot de destino não está integrado à API da Yukina." }); return true; }
      if (!currencyDoc) { respond(404, { error: "currency_not_found", message: "Moeda não cadastrada ou desativada na API." }); return true; }

      const session = mongoClient.startSession();
      let duplicate = false;
      let insufficient = false;
      let transferId = crypto.randomUUID();
      try {
        await session.withTransaction(async () => {
          const prior = await transfers.findOne({ botId: integration.botId, idempotencyKey }, { session });
          if (prior) { duplicate = true; transferId = prior.transferId; return; }
          const debit = await balances.updateOne(
            { botId: integration.botId, userId: sourceUserId, currency, balance: { $gte: amount } },
            { $inc: { balance: -amount }, $set: { updatedAt: now } },
            { session }
          );
          if (debit.modifiedCount !== 1) { insufficient = true; throw new Error("INSUFFICIENT_BALANCE"); }
          await balances.updateOne(
            { botId: destinationBotId, userId: destinationUserId, currency },
            { $inc: { balance: amount }, $set: { updatedAt: now }, $setOnInsert: { botId: destinationBotId, userId: destinationUserId, currency, createdAt: now } },
            { upsert: true, session }
          );
          await transfers.insertOne({
            transferId, botId: integration.botId, fromUserId: sourceUserId,
            toBotId: destinationBotId, toUserId: destinationUserId, currency, amount,
            idempotencyKey, createdAt: now, status: "completed"
          }, { session });
        });
      } catch (error) {
        if (error.message !== "INSUFFICIENT_BALANCE") throw error;
      } finally { await session.endSession(); }
      if (insufficient) { respond(409, { error: "insufficient_balance", message: "Saldo insuficiente na conta da API; nenhum valor foi transferido." }); return true; }
      const saved = await transfers.findOne({ botId: integration.botId, idempotencyKey });
      respond(duplicate ? 200 : 201, { ok: true, duplicate, transferId: saved?.transferId || transferId, fromBotId: integration.botId, fromUserId: sourceUserId, toBotId: destinationBotId, toUserId: destinationUserId, currency, amount, status: "completed", createdAt: saved?.createdAt || now }); return true;
    }

    if (url.pathname === "/api/bot-transfer/history") {
      const limit = Math.max(1, Math.min(50, Number(body.limit) || 20));
      const records = await transfers.find({ $or: [{ botId: integration.botId }, { toBotId: integration.botId }] }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray();
      respond(200, { ok: true, transfers: records }); return true;
    }

    respond(404, { error: "not_found", message: "Rota da API de transferência não encontrada." }); return true;
  } catch (error) {
    if (error?.code === 11000) {
      respond(200, { ok: true, duplicate: true, message: "Esta operação já foi processada." }); return true;
    }
    console.error("[Bot Transfer API] Falha na operação:", error.message || error);
    respond(500, { error: "internal_error", message: "Não foi possível concluir a operação." }); return true;
  }
}

module.exports = { createIntegration, revokeIntegration, registerCurrency, listCurrencies, handleRequest };
