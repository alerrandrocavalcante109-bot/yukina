"use strict";

const COLLECTION_NAME = "yukina_ai_letters";
const TIME_ZONE = "America/Sao_Paulo";
const PRIVATE_RECIPIENTS = new Set(["1533034328928555141", "353909640381333504"]);
const ALLOWED_SOURCES = new Set(["creator_authored", "confirmed_event", "yukina_reflection"]);

function getCollection(baseCollection) {
  if (!baseCollection?.db) throw new Error("A conexão do MongoDB não está disponível.");
  return baseCollection.db.collection(COLLECTION_NAME);
}

async function ensureIndexes(baseCollection) {
  const collection = getCollection(baseCollection);
  await collection.createIndex({ letterId: 1 }, { unique: true });
  await collection.createIndex({ kind: 1, openAt: 1, status: 1 });
  await collection.createIndex({ recipientId: 1, createdAt: -1 });
}

function validateDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("A data da carta é inválida.");
  if (date.getTime() <= Date.now()) throw new Error("A data para reler a carta precisa estar no futuro.");
  return date;
}

async function createFutureLetter(baseCollection, {
  letterId, content, openAt, createdBy, source = "yukina_reflection"
} = {}) {
  const id = String(letterId || "").trim();
  const body = String(content || "").trim().slice(0, 5000);
  if (!id || !body) throw new Error("A carta precisa de identificador e conteúdo.");
  if (!ALLOWED_SOURCES.has(source)) throw new Error("A origem desta carta não é permitida.");
  const date = validateDate(openAt);
  const now = new Date();
  const doc = {
    letterId: id,
    kind: "future_self",
    recipientId: null,
    content: body,
    openAt: date,
    timeZone: TIME_ZONE,
    status: "pending",
    source,
    ...(createdBy ? { createdBy: String(createdBy) } : {}),
    createdAt: now,
    updatedAt: now
  };
  await getCollection(baseCollection).insertOne(doc);
  return { ...doc, _id: undefined };
}

async function createPrivateLetter(baseCollection, {
  letterId, content, recipientId, createdBy, source = "creator_authored"
} = {}) {
  const id = String(letterId || "").trim();
  const body = String(content || "").trim().slice(0, 5000);
  const recipient = String(recipientId || "").trim();
  if (!id || !body || !PRIVATE_RECIPIENTS.has(recipient)) {
    throw new Error("Carta privada exige conteúdo e destinatário autorizado (Criador ou mãe).");
  }
  if (!ALLOWED_SOURCES.has(source)) throw new Error("A origem desta carta não é permitida.");
  const now = new Date();
  const doc = {
    letterId: id,
    kind: "private",
    recipientId: recipient,
    content: body,
    status: "sealed",
    source,
    ...(createdBy ? { createdBy: String(createdBy) } : {}),
    createdAt: now,
    updatedAt: now
  };
  await getCollection(baseCollection).insertOne(doc);
  return { ...doc, _id: undefined };
}

async function getDueFutureLetters(baseCollection, { now = new Date(), limit = 10 } = {}) {
  return getCollection(baseCollection).find(
    { kind: "future_self", status: "pending", openAt: { $lte: now } },
    { projection: { _id: 0, letterId: 1, content: 1, openAt: 1, createdAt: 1 } }
  ).sort({ openAt: 1 }).limit(Math.max(1, Math.min(Number(limit) || 10, 30))).toArray();
}

async function markFutureLetterOpened(baseCollection, letterId) {
  return getCollection(baseCollection).updateOne(
    { letterId: String(letterId), kind: "future_self", status: "pending", openAt: { $lte: new Date() } },
    { $set: { status: "opened", openedAt: new Date(), updatedAt: new Date() } }
  );
}

async function getPrivateLettersForRecipient(baseCollection, recipientId, { limit = 20 } = {}) {
  const recipient = String(recipientId || "").trim();
  if (!PRIVATE_RECIPIENTS.has(recipient)) return [];
  return getCollection(baseCollection).find(
    { kind: "private", recipientId: recipient },
    { projection: { _id: 0 } }
  ).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(Number(limit) || 20, 50))).toArray();
}

function buildFutureLettersContext(letters = []) {
  if (!letters.length) return "";
  return "CARTAS PARA MEU EU DO FUTURO — cartas ficcionais escritas anteriormente e cuja data de releitura chegou. Leia como lembranças narrativas, sem afirmar que foram abertas ou respondidas se isso ainda não ocorreu:\n" +
    letters.map(letter => "Carta " + letter.letterId + ":\n" + letter.content).join("\n\n").slice(0, 6000);
}

module.exports = {
  TIME_ZONE,
  ensureIndexes,
  createFutureLetter,
  createPrivateLetter,
  getDueFutureLetters,
  markFutureLetterOpened,
  getPrivateLettersForRecipient,
  buildFutureLettersContext
};
