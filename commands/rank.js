"use strict";

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const memberData = require("../member-data");

const COLOR = 0xA7D8F0;
const LEVELS = [
  { level: 1, minXp: 0, name: "Recruta da Neve", emoji: "❄️" },
  { level: 2, minXp: 100, name: "Guardião do Gelo", emoji: "🧊" },
  { level: 3, minXp: 300, name: "Caçador Lunar", emoji: "🌙" },
  { level: 4, minXp: 700, name: "Sentinela Aurora", emoji: "✨" },
  { level: 5, minXp: 1500, name: "Lenda da Yukina", emoji: "👑" },
];

function levelFromXp(xp) {
  let current = LEVELS[0];
  for (const entry of LEVELS) {
    if (xp >= entry.minXp) current = entry;
  }
  return current;
}

function progressBar(xp, current, next) {
  const span = Math.max(1, (next?.minXp || current.minXp + 100) - current.minXp);
  const progress = Math.min(1, Math.max(0, (xp - current.minXp) / span));
  const filled = Math.round(progress * 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Mostra o rank de XP de um membro.")
    .addUserOption((option) =>
      option.setName("membro").setDescription("Membro para consultar").setRequired(false)
    )
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser("membro") || interaction.user;
    await interaction.deferReply();
    try {
      const record = await memberData.getOrCreate(interaction.guildId, target.id);
      const xp = Math.max(0, Number(record.xp) || 0);
      const current = levelFromXp(xp);
      const next = LEVELS.find((entry) => entry.minXp > current.minXp) || null;
      const bar = progressBar(xp, current, next);
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`${current.emoji} Rank de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: "Nível", value: `**${current.level}** — ${current.name}`, inline: true },
          { name: "XP", value: `**${xp.toLocaleString("pt-BR")}**`, inline: true },
          {
            name: "Progresso",
            value: next
              ? `\`${bar}\` ${xp - current.minXp}/${next.minXp - current.minXp} até o próximo nível`
              : `\`${bar}\` Nível máximo`,
          }
        )
        .setFooter({ text: "Yukina · sistema de rank" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[Rank] Falha:", error);
      return interaction.editReply({ content: "🫧 Não consegui carregar o rank agora. Tente novamente em instantes." });
    }
  },

  async prefixExecute(message, args) {
    try {
      let target = message.mentions.users.first() || message.author;
      if (!message.mentions.users.size && args[0] && /^\d{17,20}$/.test(args[0])) {
        target = (await message.client.users.fetch(args[0]).catch(() => null)) || message.author;
      }
      const record = await memberData.getOrCreate(message.guildId, target.id);
      const xp = Math.max(0, Number(record.xp) || 0);
      const current = levelFromXp(xp);
      const next = LEVELS.find((entry) => entry.minXp > current.minXp) || null;
      const bar = progressBar(xp, current, next);
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`${current.emoji} Rank de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: "Nível", value: `**${current.level}** — ${current.name}`, inline: true },
          { name: "XP", value: `**${xp.toLocaleString("pt-BR")}**`, inline: true },
          {
            name: "Progresso",
            value: next
              ? `\`${bar}\` ${xp - current.minXp}/${next.minXp - current.minXp} até o próximo nível`
              : `\`${bar}\` Nível máximo`,
          }
        )
        .setFooter({ text: "Yukina · sistema de rank" })
        .setTimestamp();
      return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error("[Rank] Falha no prefixo:", error);
      return message.reply("🫧 Não consegui carregar o rank agora.").catch(() => {});
    }
  },
};
