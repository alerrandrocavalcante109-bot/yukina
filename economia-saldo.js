"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const FILE = path.join(process.cwd(), "data", "economia.json");
const COLOR = 0xA7D8F0;
const CURRENCY = "Kizunas";
const SYMBOL = "KZ";
let cache;
let writes = Promise.resolve();

async function readData() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8"));
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code !== "ENOENT") console.error("[Yukina Economia] Falha ao ler saldo:", error.message);
    cache = {};
  }
  return cache;
}
function getBalance(data, guildId, userId) {
  const guild = data[String(guildId)] || {};
  const record = guild[String(userId)] ?? data[String(userId)] ?? {};
  const value = typeof record === "number" ? record : (record.balance ?? record.saldo ?? record.wallet ?? record.kizunas ?? 0);
  const balance = Number(value);
  return Number.isFinite(balance) && balance > 0 ? balance : 0;
}
function format(value) {
  return Math.floor(value).toLocaleString("pt-BR");
}
function buildEmbed(user, balance, guildName) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · Carteira", iconURL: user.displayAvatarURL({ size: 128 }) })
    .setTitle("💰 Saldo de Kizunas")
    .setDescription("Confira as riquezas reunidas por **" + (user.globalName || user.username) + "**.")
    .addFields(
      { name: "🪙 Saldo disponível", value: "**" + format(balance) + " " + CURRENCY + "**", inline: true },
      { name: "💠 Símbolo", value: "**" + SYMBOL + "**", inline: true }
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "❄️ Yukina · Economia de " + String(guildName || "este servidor").slice(0, 150) })
    .setTimestamp();
}
async function run({ guild, user, target, reply }) {
  if (!guild) return reply({ content: "❄️ Este comando só pode ser usado dentro de um servidor.", ephemeral: true });
  const data = await readData();
  const balance = getBalance(data, guild.id, target.id);
  return reply({ embeds: [buildEmbed(target, balance, guild.name)] });
}
function makeCommand(name, description) {
  return {
    data: new SlashCommandBuilder().setName(name).setDescription(description)
      .addUserOption(option => option.setName("usuario").setDescription("Veja o saldo de outra pessoa").setRequired(false)),
    async execute(interaction) {
      const target = interaction.options.getUser("usuario") || interaction.user;
      await run({ guild: interaction.guild, user: interaction.user, target, reply: payload => interaction.reply(payload) });
    },
    async prefixExecute(message, args = []) {
      const target = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0].replace(/[<@!>]/g, "")).catch(() => null) : null) || message.author;
      await run({ guild: message.guild, user: message.author, target, reply: payload => message.reply(payload) });
    }
  };
}
module.exports = { makeCommand };
