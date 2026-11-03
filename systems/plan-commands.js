"use strict";

const { MongoClient } = require("mongodb");
const { EmbedBuilder, MessageFlags } = require("discord.js");
const { randomUUID } = require("node:crypto");
const { getVipCollection } = require("../vip-store");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
const TIERS = { starter: 1, plus: 2, premium: 3, ultra: 4, infinity: 5 };
const PLAN_NAMES = { starter: "Starter", plus: "Plus", premium: "Premium", ultra: "Ultra", infinity: "Infinity" };
let mongoClient;
let dbPromise;

async function getDb() {
  if (dbPromise) return dbPromise;
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  dbPromise = (async () => {
    if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, { appName: "Yukina-Plan-Commands", serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DB);
    await Promise.all([
      db.collection("economy_balances").createIndex({ guildId: 1, userId: 1 }, { unique: true, name: "unique_guild_user_balance" }),
      db.collection("vip_plan_command_state").createIndex({ guildId: 1, userId: 1, command: 1 }, { unique: true }),
      db.collection("vip_plan_command_ledger").createIndex({ guildId: 1, userId: 1, createdAt: -1 }),
    ]);
    return db;
  })().catch(error => { dbPromise = null; throw error; });
  return dbPromise;
}

async function getPlan(userId) {
  const subscriptions = await getVipCollection();
  const active = await subscriptions.find({
    userId: String(userId),
    status: "active",
    expiresAt: { $gt: new Date() },
  }).sort({ updatedAt: -1, createdAt: -1 }).toArray();
  return active.sort((a, b) =>
    (TIERS[String(b.planKey || "").toLowerCase()] || 0) -
    (TIERS[String(a.planKey || "").toLowerCase()] || 0)
  )[0] || null;
}

function format(value) {
  return Math.floor(Number(value) || 0).toLocaleString("pt-BR");
}

function weightedPick(entries) {
  const total = entries.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of entries) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return entries[entries.length - 1];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function claimCooldown(db, { guildId, userId, command, cooldownMs, now }) {
  const state = db.collection("vip_plan_command_state");
  const key = { guildId: String(guildId), userId: String(userId), command };
  const claimId = randomUUID();
  const nextAvailableAt = new Date(now.getTime() + cooldownMs);
  const updated = await state.updateOne(
    { ...key, $or: [{ nextAvailableAt: { $lte: now } }, { nextAvailableAt: { $exists: false } }] },
    { $set: { usedAt: now, nextAvailableAt, claimId } }
  );
  if (updated.modifiedCount === 1) return { ok: true, claimId, nextAvailableAt };

  const current = await state.findOne(key);
  if (current) return { ok: false, nextAvailableAt: new Date(current.nextAvailableAt || now) };

  try {
    await state.insertOne({ ...key, usedAt: now, nextAvailableAt, claimId });
    return { ok: true, claimId, nextAvailableAt };
  } catch (error) {
    if (error.code === 11000) {
      const latest = await state.findOne(key);
      return { ok: false, nextAvailableAt: new Date(latest?.nextAvailableAt || now) };
    }
    throw error;
  }
}

async function runPlanCommand({ interaction, command, minimumPlan, cooldownMs, title, description, rewardFactory }) {
  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.reply({ content: "❄️ Este comando só pode ser usado dentro de um servidor.", flags: MessageFlags.Ephemeral });
  }

  let claim;
  try {
    const subscription = await getPlan(interaction.user.id);
    const actualTier = TIERS[String(subscription?.planKey || "").toLowerCase()] || 0;
    if (!subscription || actualTier < TIERS[minimumPlan]) {
      const requiredName = PLAN_NAMES[minimumPlan];
      return interaction.reply({
        content: `🌸 Este comando é exclusivo do plano **${requiredName}** ou superior. Assine ou renove seu plano para desbloqueá-lo.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const db = await getDb();
    const now = new Date();
    claim = await claimCooldown(db, {
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      command,
      cooldownMs,
      now,
    });
    if (!claim.ok) {
      const timestamp = Math.ceil(claim.nextAvailableAt.getTime() / 1000);
      return interaction.reply({
        content: `🌙 Você já utilizou este benefício. Ele estará disponível novamente <t:${timestamp}:R>.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const result = rewardFactory(interaction);
    const reward = Math.max(0, Math.floor(Number(result.amount) || 0));
    const balances = db.collection("economy_balances");
    const ledger = db.collection("vip_plan_command_ledger");
    const inventory = db.collection("vip_plan_inventory");
    const nowAfterRoll = new Date();

    if (reward > 0) {
      await balances.updateOne(
        { guildId: String(interaction.guild.id), userId: String(interaction.user.id) },
        { $inc: { balance: reward }, $set: { updatedAt: nowAfterRoll }, $setOnInsert: { guildId: String(interaction.guild.id), userId: String(interaction.user.id), createdAt: nowAfterRoll } },
        { upsert: true }
      );
    }

    if (result.item) {
      await inventory.insertOne({
        guildId: String(interaction.guild.id),
        userId: String(interaction.user.id),
        command,
        item: result.item,
        obtainedAt: nowAfterRoll,
        status: "unclaimed",
      });
    }

    const balanceDoc = await balances.findOne({ guildId: String(interaction.guild.id), userId: String(interaction.user.id) });
    await ledger.insertOne({
      guildId: String(interaction.guild.id),
      userId: String(interaction.user.id),
      command,
      planKey: String(subscription.planKey).toLowerCase(),
      amount: reward,
      item: result.item || null,
      details: result.details || null,
      claimId: claim.claimId,
      createdAt: nowAfterRoll,
    });

    const embed = new EmbedBuilder()
      .setColor(result.color || 0xA7D8F0)
      .setAuthor({ name: "Yukina · Benefícios dos planos" })
      .setTitle(result.emoji ? result.emoji + " " + title : title)
      .setDescription([description, result.message || null].filter(Boolean).join("\n\n"))
      .addFields(
        ...(reward > 0 ? [{ name: "💴 Kizunas recebidas", value: `+${format(reward)} KZ`, inline: true }] : []),
        ...(result.item ? [{ name: "🎁 Item desbloqueado", value: result.item.name, inline: true }] : []),
        { name: "👛 Sua carteira", value: `${format(balanceDoc?.balance)} KZ`, inline: true },
        { name: "🌙 Próxima utilização", value: `<t:${Math.floor(claim.nextAvailableAt.getTime() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: `Benefício do plano ${PLAN_NAMES[String(subscription.planKey).toLowerCase()] || subscription.planKey}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    if (claim?.ok && claim.claimId) {
      try {
        const db = await getDb();
        await db.collection("vip_plan_command_state").updateOne(
          { guildId: String(interaction.guild.id), userId: String(interaction.user.id), command, claimId: claim.claimId },
          { $set: { nextAvailableAt: new Date(0) }, $unset: { claimId: "" } }
        );
      } catch (rollbackError) {
        console.error("[Yukina Plan Commands] Falha ao liberar cooldown após erro:", rollbackError);
      }
    }
    console.error(`[Yukina /${command}] Falha ao executar benefício:`, error);
    const payload = { content: "🫧 Não consegui concluir seu benefício agora. Tente novamente em instantes.", flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(payload).catch(() => {});
    return interaction.reply(payload).catch(() => {});
  }
}

module.exports = { runPlanCommand, weightedPick, randomInt, format };
