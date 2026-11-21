"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");
const responseContext = new AsyncLocalStorage();
const patchedChannels = new WeakSet();
const languageSystem = require("./index");

const EXACT = Object.freeze({
  "en-US": new Map([
    ["❄️ Não consegui concluir essa ação. Tente novamente.", "❄️ I couldn't complete this action. Please try again."],
    ["Esse comando ainda não está disponível na Yukina.", "This command is not available in Yukina yet."],
    ["Esta opção ainda não está conectada à Yukina. Tente novamente mais tarde.", "This option is not connected to Yukina yet. Please try again later."],
    ["🌙 Este comando ainda não possui execução por prefixo.", "🌙 This command does not have prefix support yet."],
    ["🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.", "🫧 I couldn't run this command. Check permissions and try again."]
  ]),
  "es-ES": new Map([
    ["❄️ Não consegui concluir essa ação. Tente novamente.", "❄️ No pude completar esta acción. Inténtalo de nuevo."],
    ["Esse comando ainda não está disponível na Yukina.", "Este comando todavía no está disponible en Yukina."],
    ["Esta opção ainda não está conectada à Yukina. Tente novamente mais tarde.", "Esta opción todavía no está conectada a Yukina. Inténtalo más tarde."],
    ["🌙 Este comando ainda não possui execução por prefixo.", "🌙 Este comando todavía no admite el prefijo."],
    ["🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.", "🫧 No pude ejecutar este comando. Comprueba los permisos e inténtalo de nuevo."]
  ]),
  "fr-FR": new Map([
    ["❄️ Não consegui concluir essa ação. Tente novamente.", "❄️ Impossible de terminer cette action. Veuillez réessayer."],
    ["Esse comando ainda não está disponível na Yukina.", "Cette commande n'est pas encore disponible sur Yukina."],
    ["Esta opção ainda não está conectada à Yukina. Tente novamente mais tarde.", "Cette option n'est pas encore connectée à Yukina. Veuillez réessayer plus tard."],
    ["🌙 Este comando ainda não possui execução por prefixo.", "🌙 Cette commande ne prend pas encore en charge le préfixe."],
    ["🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.", "🫧 Impossible d'exécuter cette commande. Vérifiez les autorisations et réessayez."]
  ]),
  "ja-JP": new Map([
    ["❄️ Não consegui concluir essa ação. Tente novamente.", "❄️ この操作を完了できませんでした。もう一度お試しください。"],
    ["Esse comando ainda não está disponível na Yukina.", "このコマンドはまだYukinaで利用できません。"],
    ["Esta opção ainda não está conectada à Yukina. Tente novamente mais tarde.", "このオプションはまだYukinaに接続されていません。後でもう一度お試しください。"],
    ["🌙 Este comando ainda não possui execução por prefixo.", "🌙 このコマンドはまだプレフィックスに対応していません。"],
    ["🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.", "🫧 コマンドを実行できませんでした。権限を確認して、もう一度お試しください。"]
  ]),
  "de-DE": new Map([
    ["❄️ Não consegui concluir essa ação. Tente novamente.", "❄️ Diese Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut."],
    ["Esse comando ainda não está disponível na Yukina.", "Dieser Befehl ist in Yukina noch nicht verfügbar."],
    ["Esta opção ainda não está conectada à Yukina. Tente novamente mais tarde.", "Diese Option ist noch nicht mit Yukina verbunden. Bitte versuche es später erneut."],
    ["🌙 Este comando ainda não possui execução por prefixo.", "🌙 Dieser Befehl unterstützt noch keine Präfixausführung."],
    ["🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.", "🫧 Der Befehl konnte nicht ausgeführt werden. Überprüfe die Berechtigungen und versuche es erneut."]
  ]),
  "it-IT": new Map([
    ["❄️ Não consegui concluir essa ação. Tente novamente.", "❄️ Non è stato possibile completare l'azione. Riprova."],
    ["Esse comando ainda não está disponível na Yukina.", "Questo comando non è ancora disponibile su Yukina."],
    ["Esta opção ainda não está conectada à Yukina. Tente novamente più tardi.", "Questa opzione non è ancora collegata a Yukina. Riprova più tardi."],
    ["🌙 Este comando ainda não possui execução por prefixo.", "🌙 Questo comando non supporta ancora il prefisso."],
    ["🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.", "🫧 Non è stato possibile eseguire il comando. Controlla i permessi e riprova."]
  ])
});

function translateText(language, value) {
  if (typeof value !== "string" || !value) return value;
  if (language === languageSystem.DEFAULT_LANGUAGE) return value;
  return EXACT[language]?.get(value) || value;
}

function isProtectedKey(key) {
  return /^(url|iconURL|avatarURL|proxyURL|customId|id|name|filename|attachment|spoiler|emoji|skuId)$/i.test(key);
}

function replaceStrings(value, language, key = "") {
  if (typeof value === "string") {
    if (isProtectedKey(key) || !value.trim() || /^https?:\/\//i.test(value)) return value;
    return translateText(language, value);
  }
  if (Array.isArray(value)) return value.map(item => replaceStrings(item, language));
  if (!value || typeof value !== "object") return value;
  if (typeof value.toJSON === "function") {
    try { return replaceStrings(value.toJSON(), language); } catch { return value; }
  }
  const result = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    result[childKey] = replaceStrings(childValue, language, childKey);
  }
  return result;
}

async function localizePayload(userId, payload) {
  const language = await languageSystem.getUserLanguage(userId);
  if (language === languageSystem.DEFAULT_LANGUAGE) return payload;
  return replaceStrings(payload, language);
}

function installChannelBridge(channel) {
  if (!channel || patchedChannels.has(channel) || typeof channel.send !== "function") return;
  const originalSend = channel.send.bind(channel);
  channel.send = (...args) => {
    const context = responseContext.getStore();
    if (!context?.userId) return originalSend(...args);
    return localizePayload(context.userId, args[0]).then(payload => originalSend(payload, ...args.slice(1)));
  };
  patchedChannels.add(channel);
}

async function runWithUserLanguage(userId, callback, target) {
  if (!target || typeof callback !== "function") return callback();
  installChannelBridge(target.channel);
  const methods = ["reply", "followUp", "editReply", "deferReply"];
  const originals = new Map();
  for (const method of methods) {
    if (typeof target[method] !== "function") continue;
    originals.set(method, target[method]);
    const original = target[method].bind(target);
    target[method] = async (...args) => {
      if (method === "deferReply" || !args.length) return original(...args);
      const localized = await localizePayload(userId, args[0]);
      return original(localized, ...args.slice(1));
    };
  }
  try {
    return await responseContext.run({ userId: String(userId) }, callback);
  } finally {
    for (const [method, original] of originals) target[method] = original;
  }
}

module.exports = { translateText, localizePayload, runWithUserLanguage };
