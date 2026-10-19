"use strict";

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const memberData = require("../member-data");

const COLOR = 0xA7D8F0;
const LEVELS = [
  { level: 1, xp: 0, name: "❄️ Iniciante" },
  { level: 5, xp: 500, name: "🌱 Aprendiz" },
  { level: 10, xp: 1500, name: "🌸 Explorador" },
  { level: 15, xp: 3000, name: "🩵 Participante" },
  { level: 20, xp: 5000, name: "🌙 Dedicado" },
  { level: 25, xp: 7500, name: "✨ Experiente" },
  { level: 30, xp: 10500, name: "💎 Veterano" },
  { level: 40, xp: 15000, name: "🪻 Elite" },
  { level: 50, xp: 20000, name: "👑 Mestre" },
  { level: 60, xp: 26000, name: "🌌 Lendário" },
  { level: 75, xp: 35000, name: "🔮 Mítico" },
  { level: 100, xp: 50000, name: "♾️ Imortal" },
];

function levelForXp(xp) {
  let selected = LEVELS[0];
  for (const level of LEVELS) if (xp >= level.xp) selected = level;
  return selected;
}

function buildEmbed(user, record, position, total) {
  const xp = Math.max(0, Number(record.xp) || 0);
  const current = levelForXp(xp);
  const next = LEVELS.find(item => item.xp > xp);
  const progress = next ? Math.floor(((xp - current.xp) / (next.xp - current.xp)) * 100) : 100;
  const filled = Math.max(0, Math.min(10, Math.round(progress / 10)));
  const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · Registro de jornada", iconURL: user.displayAvatarURL({ size: 128 }) })
    .setTitle("❄️ Perfil de experiência")
    .setDescription("A jornada de **" + (user.globalName || user.username) + "** sob o luar de Yukina.")
    .addFields(
      { name: "✧ Nível", value: String(current.level), inline: true },
      { name: "❄️ XP total", value: xp.toLocaleString("pt-BR"), inline: true },
      { name: "🏅 Posição", value: position ? "#" + position : "Sem posição", inline: true },
      { name: "🌙 Progresso", value: bar + " **" + progress + "%**" + (next ? "\\n" + xp.toLocaleString("pt-BR") + " / " + next.xp.toLocaleString("pt-BR") + " XP" : "\\nNível máximo alcançado") },
      { name: "🌸 Patamar atual", value: current.name, inline: true },
      { name: "👥 Participantes registrados", value: String(total), inline: true },
    )
    .setFooter({ text: "Yukina · A experiência é contabilizada por servidor" })
    .setTimestamp();
}

async function respond(interaction, target) {
  await memberData.initialize();
  const guildId = interaction.guild.id;
  const record = memberData.getRecord(guildId, target.id);
  const members = Object.entries(memberData.getMembers())
    .filter(([key, value]) => key.startsWith(guildId + ":") && value && typeof value === "object")
    .map(([key, value]) => ({ userId: key.slice(guildId.length + 1), xp: Math.max(0, Number(value.xp) || 0) }))
    .sort((a, b) => b.xp - a.xp);
  const index = members.findIndex(item => item.userId === target.id);
  const embed = buildEmbed(target, record, index >= 0 ? index + 1 : null, members.length);
  return interaction.reply({ embeds: [embed], ephemeral: false, allowedMentions: { parse: [] } });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Mostra seu nível, XP e posição no servidor.")
    .setDMPermission(false)
    .addUserOption(option => option.setName("membro").setDescription("Membro cujo perfil deseja consultar.").setRequired(false)),
  aliases: ["ranking", "nivel", "nível"],
  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true });
    }
    const target = interaction.options.getUser("membro") || interaction.user;
    try { return await respond(interaction, target); }
    catch (error) {
      console.error("[Yukina /rank]", error);
      if (interaction.deferred || interaction.replied) return interaction.followUp({ content: "💧 Não consegui consultar o ranking agora.", ephemeral: true }).catch(() => {});
      return interaction.reply({ content: "💧 Não consegui consultar o ranking agora.", ephemeral: true }).catch(() => {});
    }
  },
  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    let target = message.author;
    const mention = message.mentions.users.first();
    if (mention) target = mention;
    else if (args[0] && /^\\d{17,20}$/.test(args[0])) target = await message.client.users.fetch(args[0]).catch(() => null) || message.author;
    const interactionLike = { guild: message.guild, user: message.author, reply: payload => message.channel.send({ ...payload, allowedMentions: { parse: [] } }) };
    try { return await respond(interactionLike, target); }
    catch (error) {
      console.error("[Yukina Yrank]", error);
      return message.reply("💧 Não consegui consultar o ranking agora.").catch(() => {});
    }
  },
};
