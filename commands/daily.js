"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const DAILY_URL = (process.env.DAILY_PANEL_URL || "https://yukina-6uo.pages.dev/daily.html").trim();

const DAILY_PHRASES = [
  "❄️ A neve trouxe uma nova chance para brilhar! Passe no Daily e resgate suas Kizunas de hoje.",
  "🌙 O luar anuncia um novo dia. Sua recompensa diária está esperando por você no painel!",
  "🌸 Cada visita torna sua jornada mais especial. Venha coletar suas Kizunas de hoje!",
  "✨ Um novo dia, uma nova oportunidade! A Yukina te espera no Daily para sua recompensa diária."
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Receba uma mensagem da Yukina e abra o painel Daily."),

  async execute(interaction) {
    const phrase = DAILY_PHRASES[Math.floor(Math.random() * DAILY_PHRASES.length)];
    const avatarUrl = interaction.client.user.displayAvatarURL({ extension: "png", size: 1024 });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Abrir meu Daily")
        .setEmoji("❄️")
        .setStyle(ButtonStyle.Link)
        .setURL(DAILY_URL)
    );

    return interaction.reply({
      content: [
        "❄️ **Yukina Daily**",
        phrase,
        "",
        "🔗 **Painel:** " + DAILY_URL,
        avatarUrl
      ].join("\n"),
      components: [row],
      allowedMentions: { parse: [] },
    });
  },

  async prefixExecute(message, args, client) {
    const phrase = DAILY_PHRASES[Math.floor(Math.random() * DAILY_PHRASES.length)];
    const avatarUrl = client.user.displayAvatarURL({ extension: "png", size: 1024 });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Abrir meu Daily")
        .setEmoji("❄️")
        .setStyle(ButtonStyle.Link)
        .setURL(DAILY_URL)
    );

    return message.channel.send({
      content: [
        "❄️ **Yukina Daily**",
        phrase,
        "",
        "🔗 **Painel:** " + DAILY_URL,
        avatarUrl
      ].join("\n"),
      components: [row],
      allowedMentions: { parse: [] },
    });
  },
};
