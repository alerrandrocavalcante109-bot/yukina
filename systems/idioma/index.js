"use strict";

const storage = require("../../system-storage").forSystem("user-language");
const DEFAULT_LANGUAGE = "pt-BR";

const LANGUAGES = Object.freeze({
  "pt-BR": { name: "Português (Brasil)", flag: "🇧🇷" },
  "en-US": { name: "English (United States)", flag: "🇺🇸" },
  "es-ES": { name: "Español", flag: "🇪🇸" },
  "fr-FR": { name: "Français", flag: "🇫🇷" },
  "ja-JP": { name: "日本語", flag: "🇯🇵" },
  "de-DE": { name: "Deutsch", flag: "🇩🇪" },
  "it-IT": { name: "Italiano", flag: "🇮🇹" },
  "ko-KR": { name: "한국어", flag: "🇰🇷" },
  "zh-CN": { name: "简体中文", flag: "🇨🇳" },
  "zh-TW": { name: "繁體中文", flag: "🇹🇼" },
  "ru-RU": { name: "Русский", flag: "🇷🇺" },
  "ar-SA": { name: "العربية", flag: "🇸🇦" },
  "hi-IN": { name: "हिन्दी", flag: "🇮🇳" },
  "bn-IN": { name: "বাংলা", flag: "🇧🇩" },
  "nl-NL": { name: "Nederlands", flag: "🇳🇱" },
  "pl-PL": { name: "Polski", flag: "🇵🇱" },
  "tr-TR": { name: "Türkçe", flag: "🇹🇷" },
  "uk-UA": { name: "Українська", flag: "🇺🇦" },
  "vi-VN": { name: "Tiếng Việt", flag: "🇻🇳" },
  "th-TH": { name: "ไทย", flag: "🇹🇭" },
  "id-ID": { name: "Bahasa Indonesia", flag: "🇮🇩" },
  "ms-MY": { name: "Bahasa Melayu", flag: "🇲🇾" },
  "sv-SE": { name: "Svenska", flag: "🇸🇪" },
  "da-DK": { name: "Dansk", flag: "🇩🇰" },
  "fi-FI": { name: "Suomi", flag: "🇫🇮" },
});

const MESSAGES = Object.freeze({
  "pt-BR": {
    selected: "🌸 Seu idioma foi alterado para **{language}**.",
    current: "🌐 Seu idioma atual é **{language}**.",
    default: "🌸 Seu idioma voltou ao padrão: **Português (Brasil)**.",
    invalid: "❄️ Esse idioma não está disponível. Use /idioma para consultar as opções.",
    usage: "🌐 Escolha o idioma que deseja usar nas respostas dos comandos da Yukina.",
  },
  "en-US": {
    selected: "🌸 Your language has been changed to **{language}**.",
    current: "🌐 Your current language is **{language}**.",
    default: "🌸 Your language has been reset to the default: **Portuguese (Brazil)**.",
    invalid: "❄️ This language is not available. Use /idioma to see the options.",
    usage: "🌐 Choose the language you want Yukina's command responses to use.",
  },
  "es-ES": {
    selected: "🌸 Tu idioma se ha cambiado a **{language}**.",
    current: "🌐 Tu idioma actual es **{language}**.",
    default: "🌸 Tu idioma volvió al predeterminado: **Portugués (Brasil)**.",
    invalid: "❄️ Ese idioma no está disponible. Usa /idioma para consultar las opciones.",
    usage: "🌐 Elige el idioma que quieres usar en las respuestas de los comandos de Yukina.",
  },
  "fr-FR": {
    selected: "🌸 Votre langue a été changée en **{language}**.",
    current: "🌐 Votre langue actuelle est **{language}**.",
    default: "🌸 Votre langue a été réinitialisée : **portugais (Brésil)**.",
    invalid: "❄️ Cette langue n'est pas disponible. Utilisez /idioma pour voir les options.",
    usage: "🌐 Choisissez la langue des réponses aux commandes de Yukina.",
  },
  "ja-JP": {
    selected: "🌸 言語を **{language}** に変更しました。",
    current: "🌐 現在の言語: **{language}**。",
    default: "🌸 言語を既定のポルトガル語（ブラジル）に戻しました。",
    invalid: "❄️ この言語は利用できません。/idioma で選択肢を確認してください。",
    usage: "🌐 Yukinaのコマンド応答に使用する言語を選択してください。",
  },
  "de-DE": {
    selected: "🌸 Deine Sprache wurde auf **{language}** geändert.",
    current: "🌐 Deine aktuelle Sprache ist **{language}**.",
    default: "🌸 Deine Sprache wurde auf die Standardsprache Portugiesisch (Brasilien) zurückgesetzt.",
    invalid: "❄️ Diese Sprache ist nicht verfügbar. Verwende /idioma für die Auswahl.",
    usage: "🌐 Wähle die Sprache für Yukinas Befehlsantworten.",
  },
  "it-IT": {
    selected: "🌸 La tua lingua è stata cambiata in **{language}**.",
    current: "🌐 La tua lingua attuale è **{language}**.",
    default: "🌸 La lingua è stata ripristinata al portoghese (Brasile).",
    invalid: "❄️ Questa lingua non è disponibile. Usa /idioma per vedere le opzioni.",
    usage: "🌐 Scegli la lingua da usare nelle risposte ai comandi di Yukina.",
  },
});

function normalizeLanguage(language) {
  const value = String(language || "").trim();
  return Object.prototype.hasOwnProperty.call(LANGUAGES, value) ? value : null;
}

async function getUserLanguage(userId) {
  const saved = await storage.get("global", "preference", DEFAULT_LANGUAGE, String(userId));
  return normalizeLanguage(saved) || DEFAULT_LANGUAGE;
}

async function setUserLanguage(userId, language) {
  const normalized = normalizeLanguage(language);
  if (!normalized) throw new RangeError("Idioma não suportado.");
  await storage.set("global", "preference", normalized, String(userId));
  return normalized;
}

async function resetUserLanguage(userId) {
  await storage.delete("global", "preference", String(userId));
  return DEFAULT_LANGUAGE;
}

function translate(language, key, variables = {}) {
  const locale = normalizeLanguage(language) || DEFAULT_LANGUAGE;
  const template = MESSAGES[locale]?.[key] || MESSAGES[DEFAULT_LANGUAGE][key] || key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : ""
  );
}

async function t(userId, key, variables = {}) {
  return translate(await getUserLanguage(userId), key, variables);
}

module.exports = {
  DEFAULT_LANGUAGE, LANGUAGES, MESSAGES, normalizeLanguage,
  getUserLanguage, setUserLanguage, resetUserLanguage, translate, t,
};
