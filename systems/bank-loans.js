"use strict";
const { MongoClient } = require("mongodb");
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let client, wallet, bank, ledger;
async function getCollections() {
  if (wallet && bank && ledger) return { wallet, bank, ledger, db: client.db(MONGODB_DB) };
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  if (!client) client = new MongoClient(MONGODB_URI, { appName: "Yukina-Bank-Loans", serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(MONGODB_DB);
  wallet = db.collection("economy_balances");
  bank = db.collection("yukina_bank_accounts");
  ledger = db.collection("yukina_bank_transactions");
  await Promise.all([
    wallet.createIndex({ guildId: 1, userId: 1 }, { unique: true, name: "unique_guild_user_balance" }),
    bank.createIndex({ guildId: 1, userId: 1 }, { unique: true, name: "unique_guild_user_bank_account" })
  ]);
  return { wallet, bank, ledger, db };
}
function parseAmount(input) {
  const raw = String(input || "").trim().toLowerCase().replace(/,/g, ".");
  const m = raw.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return NaN;
  const n = Number(m[1]) * ({ k: 1000, m: 1000000 }[m[2]] || 1);
  return Number.isSafeInteger(Math.floor(n)) && n >= 1 ? Math.floor(n) : NaN;
}
async function getDebt(guildId, userId) {
  const { bank } = await getCollections();
  const doc = await bank.findOne({ guildId: String(guildId), userId: String(userId) });
  return { debt: Math.max(0, Number(doc?.debt) || 0), principal: Math.max(0, Number(doc?.loanPrincipal) || 0) };
}
async function requestLoan(guildId, userId, input) {
  const amount = parseAmount(input);
  if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 100000)
    return { ok: false, message: "Escolha um valor entre **1.000 e 100.000 KZ** (ex.: 5k)." };
  const { wallet, bank, ledger } = await getCollections();
  const filter = { guildId: String(guildId), userId: String(userId) };
  const account = await bank.findOne(filter);
  if ((Number(account?.debt) || 0) > 0) return { ok: false, message: "Você já possui uma dívida ativa. Quite-a antes de solicitar outro empréstimo." };
  const principal = amount;
  const total = Math.ceil(amount * 1.10);
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const latest = await bank.findOne(filter, { session });
      if ((Number(latest?.debt) || 0) > 0) throw new Error("ACTIVE_DEBT");
      await bank.updateOne(filter, { $set: { debt: total, loanPrincipal: principal, loanTakenAt: new Date(), updatedAt: new Date() }, $setOnInsert: { guildId: filter.guildId, userId: filter.userId, balance: 0, createdAt: new Date() } }, { upsert: true, session });
      await wallet.updateOne(filter, { $inc: { balance: amount }, $set: { updatedAt: new Date() }, $setOnInsert: { guildId: filter.guildId, userId: filter.userId, createdAt: new Date() } }, { upsert: true, session });
      await ledger.insertOne({ ...filter, type: "emprestimo", amount, debtCreated: total, createdAt: new Date() }, { session });
    });
  } catch (e) {
    if (e.message === "ACTIVE_DEBT") return { ok: false, message: "Você já possui uma dívida ativa. Quite-a antes de solicitar outro empréstimo." };
    throw e;
  } finally { await session.endSession(); }
  return { ok: true, debt: total, message: "Empréstimo aprovado: **" + amount.toLocaleString("pt-BR") + " KZ** foram para sua carteira. A dívida total é **" + total.toLocaleString("pt-BR") + " KZ**, incluindo juros únicos de 10%." };
}
async function repayLoan(guildId, userId, input) {
  const amount = parseAmount(input);
  if (!Number.isSafeInteger(amount)) return { ok: false, message: "Digite um valor válido, como **5000** ou **5k**." };
  const { wallet, bank, ledger } = await getCollections();
  const filter = { guildId: String(guildId), userId: String(userId) };
  const [account, cash] = await Promise.all([bank.findOne(filter), wallet.findOne(filter)]);
  const debt = Math.max(0, Number(account?.debt) || 0);
  const balance = Math.max(0, Number(cash?.balance) || 0);
  if (!debt) return { ok: false, message: "Você não tem dívida ativa para pagar." };
  if (amount > debt) return { ok: false, message: "O pagamento não pode ser maior que sua dívida atual de **" + debt.toLocaleString("pt-BR") + " KZ**." };
  if (amount > balance) return { ok: false, message: "Sua carteira tem apenas **" + balance.toLocaleString("pt-BR") + " KZ**. Ganhe mais Kizunas ou escolha um valor menor." };
  const session = client.startSession();
  let remaining = debt - amount;
  try {
    await session.withTransaction(async () => {
      const debit = await wallet.updateOne({ ...filter, balance: { $gte: amount } }, { $inc: { balance: -amount }, $set: { updatedAt: new Date() } }, { session });
      if (debit.modifiedCount !== 1) throw new Error("BALANCE_CHANGED");
      await bank.updateOne({ ...filter, debt: { $gte: amount } }, { $inc: { debt: -amount }, $set: { updatedAt: new Date() } }, { session });
      await ledger.insertOne({ ...filter, type: "pagamento_divida", amount, debtRemaining: remaining, createdAt: new Date() }, { session });
    });
  } catch (e) {
    if (e.message === "BALANCE_CHANGED") return { ok: false, message: "Seu saldo mudou durante a operação. Confira e tente novamente." };
    throw e;
  } finally { await session.endSession(); }
  return { ok: true, debt: remaining, message: "Você pagou **" + amount.toLocaleString("pt-BR") + " KZ** da sua dívida. " + (remaining === 0 ? "Yatta~! Sua dívida foi quitada. 🌸" : "Continue aos poucos; a Yukina está torcendo por você.") };
}
module.exports = { getCollections, getDebt, requestLoan, repayLoan };
