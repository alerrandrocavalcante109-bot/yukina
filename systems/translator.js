"use strict";

const { EmbedBuilder } = require("discord.js");
const { getCollection } = require("../system-storage");
const { getVipCollection } = require("../vip-store");

const COLOR = 0xB9DDF5;
const MAX_INPUT = 4500;
const DAILY_CREDITS = 300;
const PLAN_DAILY_CREDITS = { starter: 500, plus: 750, premium: 1000, ultra: 1500, infinity: 2000 };
const PLAN_TIERS = { starter: 1, plus: 2, premium: 3, ultra: 4, infinity: 5 };
const CREDIT_SYSTEM = "translator_credits";
const CREDIT_GUILD = "global";
const CREDIT_KEY = "daily";
const TIME_ZONE = "America/Sao_Paulo";

// Idiomas de origem aceitos; o destino continua sendo português.
const SUPPORTED_SOURCE_LANGUAGES = new Set(["pt", "en", "es", "fr", "ja", "ru", "zh", "zh-CN", "zh-TW"]);

// 5 créditos a cada bloco de até 500 caracteres.
function calculateCreditCost(text) {
  const length = String(text || "").trim().length;
  return Math.max(5, Math.ceil(length / 500) * 5);
}

function getLocalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function creditFilter(userId) {
  return {
    system: CREDIT_SYSTEM,
    guildId: CREDIT_GUILD,
    userId: String(userId),
    key: CREDIT_KEY,
  };
}

async function getUserDailyLimit(userId) {
  const subscriptions = await getVipCollection();
  const active = await subscriptions.find({
    userId: String(userId),
    status: "active",
    expiresAt: { $gt: new Date() },
  }).toArray();
  active.sort((a, b) =>
    (PLAN_TIERS[String(b.planKey || "").toLowerCase()] || 0) -
    (PLAN_TIERS[String(a.planKey || "").toLowerCase()] || 0)
  );
  const planKey = String(active[0]?.planKey || "").toLowerCase();
  return {
    planKey: PLAN_DAILY_CREDITS[planKey] ? planKey : null,
    limit: PLAN_DAILY_CREDITS[planKey] || DAILY_CREDITS,
  };
}

function dailyResetPipeline(today, limit, planKey) {
  return [{
    $set: {
      credits: {
        $cond: [
          { $and: [{ $eq: ["$dailyDate", today] }, { $eq: ["$dailyLimit", limit] }] },
          { $ifNull: ["$credits", limit] },
          limit,
        ],
      },
      dailyDate: today,
      dailyLimit: limit,
      planKey: planKey,
    },
  }];
}

async function getDailyCredits(userId) {
  const today = getLocalDateKey();
  const { planKey, limit } = await getUserDailyLimit(userId);
  const collection = await getCollection();
  const doc = await collection.findOneAndUpdate(
    creditFilter(userId),
    dailyResetPipeline(today, limit, planKey),
    { upsert: true, returnDocument: "after" }
  );
  return {
    credits: Number(doc?.credits ?? limit),
    limit: Number(doc?.dailyLimit ?? limit),
    planKey,
    resetsAt: "00:00",
    date: today,
  };
}

async function consumeDailyCredits(userId, cost) {
  const today = getLocalDateKey();
  const { planKey, limit } = await getUserDailyLimit(userId);
  const collection = await getCollection();
  const doc = await collection.findOneAndUpdate(
    creditFilter(userId),
    [
      ...dailyResetPipeline(today, limit, planKey),
      { $set: { chargeAccepted: { $gte: ["$credits", cost] } } },
      {
        $set: {
          credits: {
            $cond: ["$chargeAccepted", { $subtract: ["$credits", cost] }, "$credits"],
          },
        },
      },
    ],
    { upsert: true, returnDocument: "after" }
  );

  return {
    accepted: doc?.chargeAccepted === true,
    credits: Number(doc?.credits ?? limit),
    limit: Number(doc?.dailyLimit ?? limit),
    planKey,
    date: today,
  };
}

async function refundDailyCredits(userId, cost, date) {
  const { limit } = await getUserDailyLimit(userId);
  const collection = await getCollection();
  await collection.updateOne(
    { ...creditFilter(userId), dailyDate: date },
    [{ $set: { credits: { $min: [limit, { $add: ["$credits", cost] }] }, dailyLimit: limit } }]
  );
}

async function translateToPortuguese(text) {
  const phrase = String(text || "").trim();
  if (!phrase) throw new Error("EMPTY");
  if (phrase.length > MAX_INPUT) throw new Error("TOO_LONG");

  // Lingva usa uma API REST própria e não depende do endpoint público bloqueado do Google.
  const hosts = [
    "https://lingva.ml",
    "https://translate.jae.fi",
    "https://translate.dr460nf1r3.org",
    "https://lingva.garudalinux.org",
  ];
  let translated = "";
  let sourceLanguage = "";
  const failures = [];

  for (const host of hosts) {
    try {
      const endpoint = host + "/api/v1/auto/pt/" + encodeURIComponent(phrase);
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 YukinaDiscordBot/1.0",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        failures.push(new URL(host).hostname + ":HTTP_" + response.status);
        continue;
      }

      const data = await response.json();
      const candidate = String(data?.translation || "").trim();
      if (!candidate || data?.error) {
        failures.push(new URL(host).hostname + ":NO_RESULT");
        continue;
      }

      translated = candidate;
      sourceLanguage = String(
        data?.info?.detected?.code ||
        data?.source?.lang?.code ||
        data?.detected?.code ||
        "auto"
      ).trim();
      break;
    } catch (error) {
      failures.push(new URL(host).hostname + ":" + (error?.name || "NETWORK_ERROR"));
    }
  }

  if (!translated) {
    const error = new Error("TRANSLATION_SERVICE");
    error.details = failures.join(", ");
    throw error;
  }
  if (!translated.trim()) throw new Error("NO_RESULT");

  return {
    original: phrase,
    translated: translated.trim(),
    sourceLanguage: sourceLanguage || "auto",
  };
}

async function translateWithCredits(userId, text) {
  const phrase = String(text || "").trim();
  if (!phrase) throw new Error("EMPTY");
  if (phrase.length > MAX_INPUT) throw new Error("TOO_LONG");

  const cost = calculateCreditCost(phrase);
  const charge = await consumeDailyCredits(userId, cost);
  if (!charge.accepted) {
    const error = new Error("INSUFFICIENT_CREDITS");
    error.credits = charge.credits;
    error.cost = cost;
    error.limit = charge.limit;
    throw error;
  }

  try {
    const result = await translateToPortuguese(phrase);
    return { ...result, creditsSpent: cost, creditsRemaining: charge.credits, dailyLimit: charge.limit, planKey: charge.planKey };
  } catch (error) {
    await refundDailyCredits(userId, cost, charge.date).catch(refundError => {
      console.error("[Yukina tradução] Falha ao devolver créditos:", refundError?.message || refundError);
    });
    throw error;
  }
}

function buildTranslationEmbed(result, user) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · Tradução", iconURL: user.displayAvatarURL({ size: 128 }) })
    .setDescription(
      "**📝 Frase original**\n" + result.original.slice(0, 1900) +
      "\n\n**🌸 Tradução para português**\n" + result.translated.slice(0, 1900)
    )
    .addFields({
      name: "❄️ Créditos utilizados",
      value: result.creditsSpent + " tokens · Restam " + result.creditsRemaining + "/" + (result.dailyLimit || DAILY_CREDITS),
    })
    .setFooter({ text: "Créditos renovados diariamente à meia-noite · Horário de Brasília" })
    .setTimestamp();
}

function errorMessage(error) {
  if (error?.message === "EMPTY") return "🌙 Não encontrei uma frase para traduzir.";
  if (error?.message === "TOO_LONG") return "🫧 A frase é muito longa. Envie um texto com até " + MAX_INPUT + " caracteres.";
  if (error?.message === "UNSUPPORTED_LANGUAGE") return "🌙 Ainda não consigo traduzir esse idioma. Atualmente aceito português, inglês, espanhol, francês, japonês, russo e chinês.";
  if (error?.message === "INSUFFICIENT_CREDITS") {
    return "❄️ Seus créditos diários são insuficientes para essa tradução. Você tem **" +
      Number(error.credits || 0) + "** tokens e precisa de **" + Number(error.cost || 0) +
      "**. Seu limite diário é de **" + Number(error.limit || DAILY_CREDITS) + "** créditos, renovados à meia-noite (horário de Brasília).";
  }
  return "❄️ Não consegui realizar a tradução agora. Tente novamente em alguns instantes. Seus créditos foram preservados.";
}

module.exports = {
  translateToPortuguese,
  translateWithCredits,
  getDailyCredits,
  calculateCreditCost,
  buildTranslationEmbed,
  errorMessage,
  DAILY_CREDITS,
  PLAN_DAILY_CREDITS,
};
