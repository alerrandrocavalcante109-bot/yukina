const { MongoClient } = require("mongodb");

const uri = (process.env.MONGODB_URI || "").trim();
const dbName = (process.env.MONGODB_DB || "yukina").trim();
let client;
let collection;

async function getVipCollection() {
  if (collection) return collection;
  if (!uri) throw new Error("MONGODB_URI não está configurada; não é possível persistir assinaturas VIP.");
  if (!client) client = new MongoClient(uri, { appName: "Yukina-VIP", serverSelectionTimeoutMS: 10000 });
  await client.connect();
  collection = client.db(dbName).collection("vip_subscriptions");
  await collection.createIndex({ guildId: 1, userId: 1 }, { unique: true });
  await collection.createIndex({ status: 1, expiresAt: 1 });
  return collection;
}

function addPeriod(date, period) {
  const result = new Date(date);
  if (period === "annual") result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

async function activateSubscription({ guildId, userId, planKey, period, roleId }) {
  const col = await getVipCollection();
  const now = new Date();
  const current = await col.findOne({ guildId, userId, status: "active" });
  const base = current?.expiresAt && new Date(current.expiresAt) > now ? new Date(current.expiresAt) : now;
  const expiresAt = addPeriod(base, period);
  await col.updateOne(
    { guildId, userId },
    { $set: { guildId, userId, planKey, period, roleId, status: "active", expiresAt, updatedAt: now, lastApprovedAt: now, remindersSent: [] },
      $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  return expiresAt;
}

module.exports = { getVipCollection, activateSubscription };
