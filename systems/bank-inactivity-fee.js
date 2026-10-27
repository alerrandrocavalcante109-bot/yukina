"use strict";

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 3;
const DAILY_RATE = 0.03;

function formatKz(value) {
  return Math.floor(Number(value) || 0).toLocaleString("pt-BR");
}

/**
 * Aplica a taxa acumulada desde a última coleta do Daily.
 * A cobrança começa após 3 dias completos sem Daily e acumula 3% compostos por dia.
 * O contador fica na conta bancária para não cobrar duas vezes os mesmos dias.
 */
async function applyDailyInactivityFee({ db, guildId, userId, now = new Date() }) {
  const guild = String(guildId);
  const user = String(userId);
  const bank = db.collection("yukina_bank_accounts");
  const daily = db.collection("daily_claims");
  const ledger = db.collection("yukina_bank_transactions");

  const lastClaim = await daily.find({ guildId: guild, userId: user })
    .sort({ claimedAt: -1, day: -1 }).limit(1).next();

  if (!lastClaim) return { fee: 0, overdueDays: 0, balance: null };

  const lastClaimAt = lastClaim.claimedAt ? new Date(lastClaim.claimedAt) : null;
  if (!lastClaimAt || Number.isNaN(lastClaimAt.getTime())) {
    return { fee: 0, overdueDays: 0, balance: null };
  }

  const elapsedDays = Math.max(0, Math.floor((now.getTime() - lastClaimAt.getTime()) / DAY_MS));
  const overdueDays = Math.max(0, elapsedDays - GRACE_DAYS);
  const account = await bank.findOne({ guildId: guild, userId: user });
  if (!account) return { fee: 0, overdueDays, balance: 0 };

  const sameDailyCycle = account.feeBaseClaimedAt &&
    new Date(account.feeBaseClaimedAt).getTime() === lastClaimAt.getTime();
  const daysAlreadyCharged = sameDailyCycle ? Math.max(0, Number(account.feeDaysCharged) || 0) : 0;
  const daysToCharge = Math.max(0, overdueDays - daysAlreadyCharged);
  let balance = Math.max(0, Number(account.balance) || 0);
  let fee = 0;

  if (daysToCharge > 0 && balance > 0) {
    for (let i = 0; i < daysToCharge && balance > 0; i++) {
      const dailyFee = Math.min(balance, Math.max(1, Math.ceil(balance * DAILY_RATE)));
      fee += dailyFee;
      balance -= dailyFee;
    }
  }

  const update = {
    $set: {
      balance,
      updatedAt: now,
      feeBaseClaimedAt: lastClaimAt,
      feeDaysCharged: overdueDays,
      lastDailyInactivityCheckAt: now,
    },
  };
  await bank.updateOne({ _id: account._id }, update);

  if (fee > 0) {
    await ledger.insertOne({
      guildId: guild,
      userId: user,
      type: "taxa_daily",
      amount: fee,
      overdueDays,
      createdAt: now,
      description: "Taxa de inatividade do Daily (3% ao dia, composta)",
    });
  }

  return { fee, overdueDays, balance };
}

module.exports = { applyDailyInactivityFee, GRACE_DAYS, DAILY_RATE, formatKz };
