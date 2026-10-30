"use strict";
const { SlashCommandBuilder } = require("discord.js");
const data = require("../member-data");
function render(guildId, user) {
 const list = data.getWarnings(guildId, user.id);
 if (!list.length) return "❄️ " + user.tag + " não possui advertências registradas neste servidor.";
 const rows = list.slice(0, 10).map((w, i) => {
  const date = new Date(w.createdAt);
  const when = Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" });
  return "**#" + (list.length - i) + "** · " + when + "\nMotivo: " + w.reason + "\nModerador: <@" + w.moderatorId + ">";
 });
 return "🌸 **Histórico de advertências**\nMembro: " + user.tag + "\nTotal: **" + list.length + "**\n\n" + rows.join("\n\n") + (list.length > 10 ? "\n\n*Exibindo as 10 mais recentes.*" : "");
}
module.exports = {
 data: new SlashCommandBuilder().setName("advertencias").setDescription("Consultar o histórico de advertências.").setDMPermission(false).addUserOption(o => o.setName("usuario").setDescription("Membro consultado").setRequired(true)),
 aliases: ["warnings", "warns", "advertencia", "advertências", "avisos", "警告履歴", "advertencias"],
 async execute(i) { const user = i.options.getUser("usuario", true); return i.reply({ content: render(i.guildId, user), allowedMentions: { parse: [] }, ephemeral: true }); },
 async prefixExecute(m) { const user = m.mentions.users.first(); if (!user) return m.reply("Uso: Yadvertencias @usuario. Também funciona com Ywarnings."); return m.reply({ content: render(m.guild.id, user), allowedMentions: { parse: [] } }); }
};
