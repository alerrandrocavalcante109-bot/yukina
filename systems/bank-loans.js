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
  const m = raw.match(/^(\\d+(?:\\.\\d+)?)(k|m|b)?$/);
  if (!m) return NaN;
  const n = Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1);
  return Number.isSafeInteger(Math.floor(n)) && n >= 1 ? Math.floor(n) : NaN;
}
const DAY_MS = 24 * 60 * 60 * 1000;
function loanTerms(amount) {
  if (amount <= 100000) return { days: null, dailyRate: 0, tier: "empréstimo comum" };
  if (amount <= 1000000) return { days: 3, dailyRate: 0.034, tier: "até 3 dias" };
  if (amount <= 10000000) return { days: 7, dailyRate: 0.047, tier: "até 7 dias" };
  if (amount <= 100000000) return { days: 14, dailyRate: 0.06, tier: "até 14 dias" };
  return { days: 30, dailyRate: 0.075, tier: "até 30 dias" };
}
function fmt(value) { return Math.floor(Number(value) || 0).toLocaleString("pt-BR"); }
async function applyOverdueInterest(guildId, userId) {
  const { bank, ledger } = await getCollections();
  const filter = { guildId: String(guildId), userId: String(userId) };
  const account = await bank.findOne(filter);
  let debt = Math.max(0, Number(account?.debt) || 0);
  const dueAt = account?.loanDueAt ? new Date(account.loanDueAt) : null;
  if (!debt || !dueAt || !Number.isFinite(dueAt.getTime())) return { debt, overdueDays: 0, interest: 0, dueAt };
  const now = new Date();
  const through = account?.loanInterestThrough ? new Date(account.loanInterestThrough) : dueAt;
  const elapsedDays = Math.floor((now.getTime() - Math.max(dueAt.getTime(), through.getTime())) / DAY_MS);
  if (elapsedDays <= 0) return { debt, overdueDays: 0, interest: 0, dueAt };
  const rate = Math.max(0, Number(account.loanDailyRate) || 0);
  if (!rate) return { debt, overdueDays: 0, interest: 0, dueAt };
  const interest = Math.ceil(debt * (Math.pow(1 + rate, elapsedDays) - 1));
  const newDebt = debt + interest;
  const newThrough = new Date(through.getTime() + elapsedDays * DAY_MS);
  const updated = await bank.updateOne(
    { ...filter, debt: account.debt, loanInterestThrough: account.loanInterestThrough ?? null },
    { $set: { debt: newDebt, loanInterestThrough: newThrough, updatedAt: now } }
  );
  if (updated.modifiedCount === 1) {
    await ledger.insertOne({ ...filter, type: "juros_atraso", amount: interest, debtBefore: debt, debtAfter: newDebt, overdueDays: elapsedDays, createdAt: now });
    return { debt: newDebt, overdueDays: elapsedDays, interest, dueAt };
  }
  const latest = await bank.findOne(filter, { projection: { debt: 1, loanDueAt: 1 } });
  return { debt: Math.max(0, Number(latest?.debt) || 0), overdueDays: 0, interest: 0, dueAt: latest?.loanDueAt || dueAt };
}
async function getDebt(guildId, userId) {
  const { bank } = await getCollections();
  const accrued = await applyOverdueInterest(guildId, userId);
  const doc = await bank.findOne({ guildId: String(guildId), userId: String(userId) });
  return {
    debt: Math.max(0, Number(doc?.debt) || 0),
    principal: Math.max(0, Number(doc?.loanPrincipal) || 0),
    dueAt: doc?.loanDueAt || null,
    dailyRate: Math.max(0, Number(doc?.loanDailyRate) || 0),
    accruedInterest: accrued.interest,
    overdueDays: accrued.overdueDays
  };
}
async function requestLoan(guildId, userId, input) {
  const amount = parseAmount(input);
  if (!Number.isSafeInteger(amount) || amount < 1000)
    return { ok: false, message: "Escolha um valor de pelo menos **1.000 KZ** (ex.: 5k ou 2m)." };
  const { wallet, bank, ledger } = await getCollections();
  const filter = { guildId: String(guildId), userId: String(userId) };
  const account = await bank.findOne(filter);
  if ((Number(account?.debt) || 0) > 0) return { ok: false, message: "Você já possui uma dívida ativa. Quite-a antes de solicitar outro empréstimo." };
  const principal = amount;
  const total = Math.ceil(amount * 1.05);
  const terms = loanTerms(amount);
  const now = new Date();
  const dueAt = terms.days ? new Date(now.getTime() + terms.days * DAY_MS) : null;
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const latest = await bank.findOne(filter, { session });
      if ((Number(latest?.debt) || 0) > 0) throw new Error("ACTIVE_DEBT");
      const loanFields = {
        debt: total, loanPrincipal: principal, loanTakenAt: now, updatedAt: now,
        loanDailyRate: terms.dailyRate,
        loanDueAt: dueAt,
        loanInterestThrough: dueAt,
        loanTermDays: terms.days
      };
      await bank.updateOne(filter, { $set: loanFields, $setOnInsert: { guildId: filter.guildId, userId: filter.userId, balance: 0, createdAt: now } }, { upsert: true, session });
      await wallet.updateOne(filter, { $inc: { balance: amount }, $set: { updatedAt: now }, $setOnInsert: { guildId: filter.guildId, userId: filter.userId, createdAt: now } }, { upsert: true, session });
      await ledger.insertOne({ ...filter, type: "emprestimo", amount, debtCreated: total, dueAt, dailyRate: terms.dailyRate, createdAt: now }, { session });
    });
  } catch (e) {
    if (e.message === "ACTIVE_DEBT") return { ok: false, message: "Você já possui uma dívida ativa. Quite-a antes de solicitar outro empréstimo." };
    throw e;
  } finally { await session.endSession(); }
  const deadlineText = terms.days
    ? " Prazo: **" + terms.days + " dias**. Após o prazo, os juros serão de **" + (terms.dailyRate * 100).toLocaleString("pt-BR") + "% ao dia**."
    : " Este valor não tem prazo de vencimento nem juros diários por atraso.";
  return {
    ok: true, debt: total, dueAt, dailyRate: terms.dailyRate,
    message: "Empréstimo aprovado: **" + fmt(amount) + " KZ** na carteira. Dívida inicial: **" + fmt(total) + " KZ**, com juros únicos de **5%**." + deadlineText
  };
}
async function repayLoan(guildId, userId, input) {
  await applyOverdueInterest(guildId, userId);
  const amount = parseAmount(input);
  if (!Number.isSafeInteger(amount)) return { ok: false, message: "Digite um valor válido, como **5000**, **5k** ou **1m**." };
  const { wallet, bank, ledger } = await getCollections();
  const filter = { guildId: String(guildId), userId: String(userId) };
  const [account, cash] = await Promise.all([bank.findOne(filter), wallet.findOne(filter)]);
  const debt = Math.max(0, Number(account?.debt) || 0);
  const balance = Math.max(0, Number(cash?.balance) || 0);
  if (!debt) return { ok: false, message: "Você não tem dívida ativa para pagar." };
  if (amount > debt) return { ok: false, message: "O pagamento não pode ser maior que sua dívida atual de **" + fmt(debt) + " KZ**." };
  if (amount > balance) return { ok: false, message: "Sua carteira tem apenas **" + fmt(balance) + " KZ**. Escolha um valor menor." };
  const session = client.startSession();
  let remaining = debt - amount;
  try {
    await session.withTransaction(async () => {
      const debit = await wallet.updateOne({ ...filter, balance: { $gte: amount } }, { $inc: { balance: -amount }, $set: { updatedAt: new Date() } }, { session });
      if (debit.modifiedCount !== 1) throw new Error("BALANCE_CHANGED");
      const debtUpdate = remaining === 0
        ? await bank.updateOne({ ...filter, debt: { $gte: amount } }, { $set: { debt: 0, loanPrincipal: 0, loanTakenAt: null, loanDueAt: null, loanDailyRate: 0, loanInterestThrough: null, loanTermDays: null, updatedAt: new Date() } }, { session })
        : await bank.updateOne({ ...filter, debt: { $gte: amount } }, { $inc: { debt: -amount }, $set: { updatedAt: new Date() } }, { session });
      if (debtUpdate.modifiedCount !== 1) throw new Error("DEBT_CHANGED");
      await ledger.insertOne({ ...filter, type: "pagamento_divida", amount, debtRemaining: remaining, createdAt: new Date() }, { session });
    });
  } catch (e) {
    if (e.message === "BALANCE_CHANGED") return { ok: false, message: "Seu saldo mudou durante a operação. Confira e tente novamente." };
    if (e.message === "DEBT_CHANGED") return { ok: false, message: "Sua dívida mudou durante a operação. Confira e tente novamente." };
    throw e;
  } finally { await session.endSession(); }
  return { ok: true, debt: remaining, message: "Você pagou **" + fmt(amount) + " KZ** da sua dívida. " + (remaining === 0 ? "Yatta~! Sua dívida foi quitada. 🌸" : "Dívida restante: **" + fmt(remaining) + " KZ**.") };
}
module.exports = { getCollections, getDebt, requestLoan, repayLoan, applyOverdueInterest, loanTerms };
