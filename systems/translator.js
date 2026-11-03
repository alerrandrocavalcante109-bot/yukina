"use strict";

const { EmbedBuilder, MessageFlags } = require("discord.js");

const COLOR = 0xB9DDF5;
const MAX_INPUT = 4500;

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

  return {
    original: phrase,
    translated: translated.trim(),
    sourceLanguage: data?.[2] || "auto",
  };
}

function buildTranslationEmbed(result, user) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · Tradução", iconURL: user.displayAvatarURL({ size: 128 }) })
    .setDescription(
      "**📝 Frase original**\n" + result.original.slice(0, 1900) +
      "\n\n**🌸 Tradução para português**\n" + result.translated.slice(0, 1900)
    )
    .setFooter({ text: "Idioma detectado automaticamente · Destino: português" })
    .setTimestamp();
}

function errorMessage(error) {
  if (error?.message === "EMPTY") return "🌙 Não encontrei uma frase para traduzir.";
  if (error?.message === "TOO_LONG") return "🫧 A frase é muito longa. Envie um texto com até " + MAX_INPUT + " caracteres.";
  return "❄️ Não consegui realizar a tradução agora. Tente novamente em alguns instantes.";
}

module.exports = { translateToPortuguese, buildTranslationEmbed, errorMessage };
