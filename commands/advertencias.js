"use strict";
const { SlashCommandBuilder } = require("discord.js");
const data = require("../member-data");
const idioma = require("../systems/idioma");
const LOCALES = require("../systems/idioma/locales/warnings");

function translator(language) {
  const locale = LOCALES[language] || LOCALES["pt-BR"];
  return (key, variables = {}) => String(locale[key] || LOCALES["pt-BR"][key] || key)
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : ""
    );
}
function render(guildId, user, t, language) {
  const list = data.getWarnings(guildId, user.id);
  if (!list.length) return t("noWarnings", { user: user.tag });
  const rows = list.slice(0, 10).map((w, i) => {
    const date = new Date(w.createdAt);
    const when = Number.isNaN(date.getTime()) ? t("unavailableDate") : date.toLocaleString(language, { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" });
    return "**#" + (list.length - i) + "** · " + when + "\n" + t("reason") + ": " + w.reason + "\n" + t("moderator") + ": <@" + w.moderatorId + ">";
  });
  return t("title") + "\n" + t("member") + ": " + user.tag + "\n" + t("total") + ": **" + list.length + "**\n\n" + rows.join("\n\n") + (list.length > 10 ? "\n\n*" + t("showingRecent") + "*" : "");
}
module.exports = {
 data: new SlashCommandBuilder().setName("advertencias").setDescription("Consultar o histórico de advertências.").setDMPermission(false).addUserOption(o => o.setName("usuario").setDescription("Membro consultado").setRequired(true)),
 aliases: ["warnings", "warns", "advertencia", "advertências", "avisos", "警告履歴", "advertencias"],
 async execute(i) {
   const language = await idioma.getUserLanguage(i.user.id), t = translator(language);
   const user = i.options.getUser("usuario", true);
   return i.reply({ content: render(i.guildId, user, t, language), allowedMentions: { parse: [] }, ephemeral: true });
 },
 async prefixExecute(m) {
   const language = await idioma.getUserLanguage(m.author.id), t = translator(language);
   const user = m.mentions.users.first();
   if (!user) return m.reply(t("usage"));
   return m.reply({ content: render(m.guild.id, user, t, language), allowedMentions: { parse: [] } });
 }
};
