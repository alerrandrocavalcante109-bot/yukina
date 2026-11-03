"use strict";

const { EmbedBuilder } = require("discord.js");
const { getCollection } = require("../system-storage");

const COLOR = 0xB9DDF5;
const MAX_INPUT = 4500;
const DAILY_CREDITS = 300;
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

async function getDailyCredits(userId) {
  const today = getLocalDateKey();
  const collection = await getCollection();
  const doc = await collection.findOneAndUpdate(
    creditFilter(userId),
    [
      {
        $set: {
          dailyDate: today,
          credits: {
            $cond: [
              { $eq: ["$dailyDate", today] },
              { $ifNull: ["$credits", DAILY_CREDITS] },
              DAILY_CREDITS,
            ],
          },
        },
      },
    ],
    { upsert: true, returnDocument: "after" }
  );
  return { credits: Number(doc?.credits ?? DAILY_CREDITS), resetsAt: "00:00", date: today };
}

async function consumeDailyCredits(userId, cost) {
  const today = getLocalDateKey();
  const collection = await getCollection();
  const doc = await collection.findOneAndUpdate(
    creditFilter(userId),
    [
      {
        $set: {
          dailyDate: today,
          credits: {
            $cond: [
              { $eq: ["$dailyDate", today] },
              { $ifNull: ["$credits", DAILY_CREDITS] },
              DAILY_CREDITS,
            ],
          },
        },
      },
      {
        $set: {
          chargeAccepted: { $gte: ["$credits", cost] },
        },
      },
      {
        $set: {
          credits: {
            $cond: [
              "$chargeAccepted",
              { $subtract: ["$credits", cost] },
              "$credits",
            ],
          },
        },
      },
    ],
    { upsert: true, returnDocument: "after" }
  );

  return {
    accepted: doc?.chargeAccepted === true,
    credits: Number(doc?.credits ?? DAILY_CREDITS),
    date: today,
  };
}

async function refundDailyCredits(userId, cost, date) {
  const collection = await getCollection();
  await collection.updateOne(
    { ...creditFilter(userId), dailyDate: date },
    [{ $set: { credits: { $min: [DAILY_CREDITS, { $add: ["$credits", cost] }] } } }]
  );
}

async function translateToPortuguese(text) {
  const phrase = String(text || "").trim();
  if (!phrase) throw new Error("EMPTY");
  if (phrase.length > MAX_INPUT) throw new Error("TOO_LONG");

  const endpoint = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=" + encodeURIComponent(phrase);
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 YukinaDiscordBot/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("TRANSLATION_SERVICE");
  const data = await response.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map(part => Array.isArray(part) ? part[0] : "").filter(Boolean).join("")
    : "";
  if (!translated.trim()) throw new Error("NO_RESULT");

  const sourceLanguage = String(data?.[2] || "").trim();
  const normalizedLanguage = sourceLanguage.split("-")[0];
  if (!SUPPORTED_SOURCE_LANGUAGES.has(sourceLanguage) && !SUPPORTED_SOURCE_LANGUAGES.has(normalizedLanguage)) {
    throw new Error("UNSUPPORTED_LANGUAGE");
  }

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
    throw error;
  }

  try {
    const result = await translateToPortuguese(phrase);
    return { ...result, creditsSpent: cost, creditsRemaining: charge.credits };
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
      value: result.creditsSpent + " tokens · Restam " + result.creditsRemaining + "/" + DAILY_CREDITS,
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
      "**. Seus 300 créditos serão renovados à meia-noite (horário de Brasília).";
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
};
