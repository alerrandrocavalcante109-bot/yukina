"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const dropManager = require("../systems/drop-manager");
const { getUserLanguage, translate } = require("../systems/idioma");
const messages = require("../systems/idioma/locales/drop");

function msg(userId, key, vars = {}) {
  return translate(getUserLanguage(userId), key, vars);
}
function parseTime(value, userId) {
  const match = String(value || "").trim().match(/^(\d{1,5})\s*(s|seg|segundos?|m|min|minutos?|h|horas?|d|dias?)$/i);
  if (!match) throw new Error(msg(userId, "time"));
  const n = Number(match[1]), unit = match[2].toLowerCase();
  const factor = /^s|^seg/.test(unit) ? 1000 : /^m/.test(unit) ? 60000 : /^h/.test(unit) ? 3600000 : 86400000;
  const ms = n * factor;
  if (!Number.isSafeInteger(ms) || n < 1 || ms < 10000 || ms > 30 * 86400000) throw new Error(msg(userId, "duration"));
  return ms;
}
async function run({ guild, channel, member, user, tempo, ganhadores, premio, reply, client }) {
  const userId = user.id;
  if (!guild) return reply(msg(userId, "dm"));
  if (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !member.permissions.has(PermissionFlagsBits.ManageMessages)) return reply(msg(userId, "permission"));
  let duration; try { duration = parseTime(tempo, userId); } catch (e) { return reply("⚠️ " + e.message); }
  const count = Number(ganhadores);
  if (!Number.isInteger(count) || count < 1 || count > 20) return reply(msg(userId, "winners"));
  const prize = String(premio || "").trim();
  if (!prize || prize.length > 180) return reply(msg(userId, "prize"));
  if (!channel?.isTextBased?.() || !channel.send) return reply(msg(userId, "channel"));
  try {
    const result = await dropManager.create(client, { guild, channel, creator: user, tempo: duration, winnerCount: count, prize });
    return reply(msg(userId, "success", { url: result.message.url }));
  } catch (error) {
    console.error("[Yukina drop] Falha ao criar drop:", error);
    return reply(msg(userId, "failure", { error: error.message || "Não consegui criar o drop. Verifique a configuração do painel e minhas permissões." }));
  }
}
module.exports = {
  data: new SlashCommandBuilder().setName("drop").setDescription("Criar um drop usando as regras salvas no painel.")
    .setDMPermission(false)
    .addStringOption(o => o.setName("tempo").setDescription("Ex.: 10m, 2h ou 1d").setRequired(true).setMaxLength(20))
    .addIntegerOption(o => o.setName("ganhadores").setDescription("Quantidade de ganhadores (1 a 20)").setRequired(true).setMinValue(1).setMaxValue(20))
    .addStringOption(o => o.setName("premio").setDescription("Prêmio do drop").setRequired(true).setMaxLength(180)),
  aliases: ["giveaway", "sorteio"],
  async execute(i) { return run({ guild: i.guild, channel: i.channel, member: i.member, user: i.user, tempo: i.options.getString("tempo", true), ganhadores: i.options.getInteger("ganhadores", true), premio: i.options.getString("premio", true), client: i.client, reply: content => i.reply({ content }) }); },
  async prefixExecute(m, args) {
    const raw = m.content.replace(/^\s*[Yy](?:drop|giveaway|sorteio)\b/i, "").trim();
    const match = raw.match(/^(\S+)\s+(\d+)\s+([\s\S]+)$/);
    if (!match) return m.reply(msg(m.author.id, "usage"));
    return run({ guild: m.guild, channel: m.channel, member: m.member, user: m.author, tempo: match[1], ganhadores: match[2], premio: match[3], client: m.client, reply: content => m.reply(content) });
  }
};
