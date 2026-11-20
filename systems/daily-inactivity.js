"use strict";

const { MongoClient } = require("mongodb");
const { getVipCollection } = require("./vip-store");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
const GUILD_ID = (process.env.VIP_GUILD_ID || "").trim();
const HOUR = 60 * 60 * 1000;
const CHECK_INTERVAL = 5 * 60 * 1000;
const WARNING_AFTER = 60 * HOUR;
const CHARGE_AFTER = 72 * HOUR;

const PLAN_DISCOUNTS = {
  starter: 0.37,
  plus: 0.41,
  premium: 0.69,
  ultra: 0.80,
  infinity: 1.00,
};
const PLAN_WEIGHT = { starter: 1, plus: 2, premium: 3, ultra: 4, infinity: 5 };

let mongoClient;
let running = false;

function getBaseRate(balance) {
  if (balance > 100_000_000) return 0.50;
  if (balance > 50_000_000) return 0.15;
  if (balance > 10_000_000) return 0.07;
  if (balance > 1_000_000) return 0.05;
  return 0;
}

async function getBestActivePlan(vipCollection, userId, now) {
  const subscriptions = await vipCollection.find({
    guildId: GUILD_ID,
    userId: String(userId),
    status: "active",
    expiresAt: { $gt: now },
  }).toArray();
  return subscriptions
    .filter(item => PLAN_WEIGHT[String(item.planKey || "").toLowerCase()])
    .sort((a, b) =>
      PLAN_WEIGHT[String(b.planKey).toLowerCase()] -
      PLAN_WEIGHT[String(a.planKey).toLowerCase()]
    )[0] || null;
}

async function sendWarning(client, userId, balance) {
  const user = await client.users.fetch(String(userId));
  await user.send({
    content:
      "🌙 **Aviso de inatividade — Yukina**\n\n" +
      "Você está há 2 dias e 12 horas sem coletar seu **/daily**. " +
      "Daqui a 12 horas, se continuar sem coletar, poderá receber uma taxa de inatividade sobre suas Kizunas.\n\n" +
      "💰 **Saldo atual:** " + Math.floor(balance).toLocaleString("pt-BR") + " KZ\n" +
      "🌸 Colete seu Daily antes do prazo para evitar a cobrança.",
    allowedMentions: { parse: [] },
  });
}

async function sendChargeNotice(client, userId, balanceBefore, fee, rate, planKey) {
  const user = await client.users.fetch(String(userId));
  const planText = planKey
    ? "\n💎 **Plano aplicado:** " + planKey[0].toUpperCase() + planKey.slice(1)
    : "";
  await user.send({
    content:
      "❄️ **Taxa de inatividade aplicada**\n\n" +
      "Como você permaneceu 3 dias sem coletar o **/daily**, a Yukina aplicou a taxa única deste período.\n\n" +
      "💰 **Saldo anterior:** " + Math.floor(balanceBefore).toLocaleString("pt-BR") + " KZ\n" +
      "📉 **Taxa efetiva:** " + (rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + "%\n" +
      "🪙 **KZ descontadas:** " + Math.floor(fee).toLocaleString("pt-BR") + " KZ\n" +
      "💠 **Saldo restante:** " + Math.floor(balanceBefore - fee).toLocaleString("pt-BR") + " KZ" +
      planText,
    allowedMentions: { parse: [] },
  });
}

async function processUser(client, db, vipCollection, userId, now) {
  const claims = db.collection("daily_claims");
  const balances = db.collection("economy_balances");
  const states = db.collection("daily_inactivity_state");
  const userKey = String(userId);

  const lastClaim = await claims.find({ userId: userKey })
    .sort({ claimedAt: -1, day: -1 }).limit(1).next();
  if (!lastClaim?.claimedAt) return;

  const lastClaimAt = new Date(lastClaim.claimedAt);
  const inactiveFor = now.getTime() - lastClaimAt.getTime();
  if (!Number.isFinite(lastClaimAt.getTime()) || inactiveFor < WARNING_AFTER) return;

  let state = await states.findOne({ guildId: GUILD_ID, userId: userKey });
  if (!state || new Date(state.lastClaimAt).getTime() !== lastClaimAt.getTime()) {
    await states.updateOne(
      { guildId: GUILD_ID, userId: userKey },
      {
        $set: {
          guildId: GUILD_ID,
          userId: userKey,
          lastClaimAt,
          warningSentAt: null,
          chargedAt: null,
          fee: null,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    state = await states.findOne({ guildId: GUILD_ID, userId: userKey });
  }

  const balanceDoc = await balances.findOne({ userId: userKey });
  const balance = Math.max(0, Number(balanceDoc?.balance) || 0);

  if (!state.warningSentAt && balance >= 100_000) {
    try {
      await sendWarning(client, userKey, balance);
      await states.updateOne(
        { guildId: GUILD_ID, userId: userKey, lastClaimAt, warningSentAt: null },
        { $set: { warningSentAt: now, updatedAt: now } }
      );
      state.warningSentAt = now;
    } catch (error) {
      console.warn("[Daily Inatividade] Falha ao enviar aviso para " + userKey + ":", error?.message || error);
    }
  }

  if (inactiveFor < CHARGE_AFTER || state.chargedAt || !state.warningSentAt) return;
  if (now.getTime() - new Date(state.warningSentAt).getTime() < 12 * HOUR) return;

  const freshBalanceDoc = await balances.findOne({ userId: userKey });
  const freshBalance = Math.max(0, Number(freshBalanceDoc?.balance) || 0);
  const baseRate = getBaseRate(freshBalance);
  if (!baseRate) {
    await states.updateOne(
      { guildId: GUILD_ID, userId: userKey, lastClaimAt, chargedAt: null },
      { $set: { chargedAt: now, fee: 0, updatedAt: now } }
    );
    return;
  }

  let plan = null;
  try {
    plan = await getBestActivePlan(vipCollection, userKey, now);
  } catch (error) {
    console.warn("[Daily Inatividade] Falha ao consultar plano de " + userKey + ":", error?.message || error);
  }
  const planKey = String(plan?.planKey || "").toLowerCase();
  const discount = PLAN_DISCOUNTS[planKey] || 0;
  const effectiveRate = baseRate * (1 - discount);
  const fee = Math.min(freshBalance, Math.floor(freshBalance * effectiveRate));

  if (fee <= 0) {
    await states.updateOne(
      { guildId: GUILD_ID, userId: userKey, lastClaimAt, chargedAt: null },
      { $set: { chargedAt: now, fee: 0, baseRate, effectiveRate, planKey: planKey || null, updatedAt: now } }
    );
    return;
  }

  // Registra a cobrança e debita a carteira na mesma transação para evitar duplicidade
  // ou perda da cobrança caso o processo seja interrompido entre as duas operações.
  const session = mongoClient.startSession();
  let charged = false;
  try {
    await session.withTransaction(async () => {
      const reservation = await states.updateOne(
        { guildId: GUILD_ID, userId: userKey, lastClaimAt, chargedAt: null },
        { $set: { chargedAt: now, fee, baseRate, effectiveRate, planKey: planKey || null, updatedAt: now } },
        { session }
      );
      if (!reservation.modifiedCount) return;

      const debit = await balances.updateOne(
        { userId: userKey, balance: { $gte: fee } },
        { $inc: { balance: -fee }, $set: { updatedAt: now } },
        { session }
      );
      if (!debit.modifiedCount) throw new Error("Saldo alterado antes da cobrança; transação cancelada.");
      charged = true;
    });
  } finally {
    await session.endSession();
  }
  if (!charged) return;

  try {
    await sendChargeNotice(client, userKey, freshBalance, fee, effectiveRate, planKey);
  } catch (error) {
    console.warn("[Daily Inatividade] Taxa aplicada, mas não foi possível enviar DM para " + userKey + ":", error?.message || error);
  }
  console.log("[Daily Inatividade] Taxa única aplicada a " + userKey + ": " + fee + " KZ.");
}

async function run(client) {
  if (running || !MONGODB_URI || !client.isReady()) return;
  if (!/^\d{17,20}$/.test(GUILD_ID)) {
    console.warn("[Daily Inatividade] VIP_GUILD_ID inválido; sistema pausado.");
    return;
  }
  running = true;
  try {
    if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, {
      appName: "Yukina-Daily-Inactivity",
      serverSelectionTimeoutMS: 10000,
    });
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const claims = db.collection("daily_claims");
    const states = db.collection("daily_inactivity_state");
    await states.createIndex({ guildId: 1, userId: 1 }, { unique: true });
    const vipCollection = await getVipCollection();
    const userIds = await claims.distinct("userId", { guildId: GUILD_ID });
    const now = new Date();
    for (const userId of userIds) {
      await processUser(client, db, vipCollection, userId, now);
    }
  } catch (error) {
    console.error("[Daily Inatividade] Falha na verificação:", error?.message || error);
  } finally {
    running = false;
  }
}

module.exports = function startDailyInactivity(client) {
  if (!MONGODB_URI) {
    console.warn("[Daily Inatividade] MONGODB_URI ausente; sistema desativado.");
    return;
  }
  void run(client);
  const timer = setInterval(() => void run(client), CHECK_INTERVAL);
  timer.unref?.();
  console.log("[Daily Inatividade] Aviso após 60h e cobrança única após 72h ativados.");
};
