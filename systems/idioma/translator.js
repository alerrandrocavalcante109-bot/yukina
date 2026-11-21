"use strict";

// Azure Translator adapter with bounded concurrency, request batching, cache and
// a small circuit breaker. No provider key is ever stored in the repository.
const ENDPOINT = (process.env.AZURE_TRANSLATOR_ENDPOINT || "https://api.cognitive.microsofttranslator.com").replace(/\/$/, "");
const KEY = (process.env.AZURE_TRANSLATOR_KEY || "").trim();
const REGION = (process.env.AZURE_TRANSLATOR_REGION || "").trim();
const MAX_CONCURRENT = Math.max(1, Number(process.env.TRANSLATOR_MAX_CONCURRENT || 8));
const MAX_QUEUE = Math.max(50, Number(process.env.TRANSLATOR_MAX_QUEUE || 1000));
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_MAX = 50000;
const cache = new Map();
let active = 0;
const waiting = [];
let failures = 0;
let circuitOpenUntil = 0;

const TARGETS = Object.freeze({
  "pt-BR": "pt", "en-US": "en", "es-ES": "es", "fr-FR": "fr",
  "ja-JP": "ja", "de-DE": "de", "it-IT": "it", "ko-KR": "ko",
  "zh-CN": "zh-Hans", "zh-TW": "zh-Hant", "ru-RU": "ru", "ar-SA": "ar",
  "hi-IN": "hi", "bn-IN": "bn", "nl-NL": "nl", "pl-PL": "pl",
  "tr-TR": "tr", "uk-UA": "uk", "vi-VN": "vi", "th-TH": "th",
  "id-ID": "id", "ms-MY": "ms", "sv-SE": "sv", "da-DK": "da", "fi-FI": "fi",
});

function cacheGet(key) {
  const item = cache.get(key);
  if (!item) return undefined;
  if (item.expiresAt <= Date.now()) { cache.delete(key); return undefined; }
  cache.delete(key);
  cache.set(key, item);
  return item.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
}

function acquire() {
  if (active < MAX_CONCURRENT) { active++; return Promise.resolve(); }
  if (waiting.length >= MAX_QUEUE) return Promise.reject(new Error("translation_queue_full"));
  return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
}

function release() {
  const next = waiting.shift();
  if (next) next.resolve();
  else active = Math.max(0, active - 1);
}

async function requestBatch(texts, target) {
  if (!KEY) throw new Error("azure_translator_not_configured");
  if (Date.now() < circuitOpenUntil) throw new Error("translation_circuit_open");
  await acquire();
  try {
    const url = new URL(ENDPOINT + "/translate");
    url.searchParams.set("api-version", "3.0");
    url.searchParams.set("to", target);
    const headers = {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": KEY,
    };
    if (REGION) headers["Ocp-Apim-Subscription-Region"] = REGION;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(texts.map(text => ({ Text: text }))),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const error = new Error("azure_translator_http_" + response.status);
      if (response.status === 429 || response.status >= 500) {
        failures++;
        if (failures >= 5) circuitOpenUntil = Date.now() + 15000;
      }
      throw error;
    }
    const data = await response.json();
    failures = 0;
    circuitOpenUntil = 0;
    return data.map(item => item?.translations?.[0]?.text ?? texts[data.indexOf(item)]);
  } finally {
    release();
  }
}

async function translateMany(language, input) {
  const target = TARGETS[language];
  const texts = Array.from(new Set((input || []).filter(text => typeof text === "string" && text.trim())));
  if (!target || !texts.length || !KEY) return new Map();
  const result = new Map();
  const pending = [];
  for (const source of texts) {
    const key = target + "\u0000" + source;
    const cached = cacheGet(key);
    if (cached !== undefined) result.set(source, cached);
    else pending.push(source);
  }

  // Azure accepts up to 1,000 array elements and 50,000 characters per request.
  const batches = [];
  let batch = [], size = 0;
  for (const source of pending) {
    if (batch.length >= 900 || size + source.length > 45000) {
      if (batch.length) batches.push(batch);
      batch = []; size = 0;
    }
    batch.push(source); size += source.length;
  }
  if (batch.length) batches.push(batch);

  for (const group of batches) {
    try {
      const translated = await requestBatch(group, target);
      group.forEach((source, index) => {
        const value = typeof translated[index] === "string" ? translated[index] : source;
        result.set(source, value);
        if (value !== source) cacheSet(target + "\u0000" + source, value);
      });
    } catch (error) {
      // Translation must never prevent a Discord command from responding.
      console.warn("[Idioma] Tradução automática indisponível:", error.message);
      group.forEach(source => result.set(source, source));
    }
  }
  return result;
}

function getStatus() {
  return {
    configured: Boolean(KEY),
    provider: "azure-translator",
    active,
    queued: waiting.length,
    cacheEntries: cache.size,
    circuitOpen: Date.now() < circuitOpenUntil,
  };
}

module.exports = { translateMany, getStatus, TARGETS };
