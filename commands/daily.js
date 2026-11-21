"use strict";

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const languageSystem = require("../systems/idioma");
const dailyLocale = require("../systems/idioma/locales/daily");

const DAILY_URL = (process.env.DAILY_PANEL_URL || "https://yukina-6uo.pages.dev/daily.html").trim();

function buildMessage(language) {
  const messages = dailyLocale.getDailyMessages(language);
  const phrase = messages.commandPhrases[Math.floor(Math.random() * messages.commandPhrases.length)];
  return {
    content: [
      messages.commandTitle,
      "",
      phrase,
      "",
      messages.commandPanel + " <" + DAILY_URL + ">"
    ].join("\n"),
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(messages.commandButton)
          .setStyle(ButtonStyle.Link)
          .setURL(DAILY_URL)
      )
    ],
    allowedMentions: { parse: [] }
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Receba uma frase da Yukina e acesse o painel para pegar seu Daily."),
  name: "daily",
  aliases: ["daily"],
  async execute(interaction) {
    const language = await languageSystem.getUserLanguage(interaction.user.id);
    await interaction.reply(buildMessage(language));
  },
  async prefixExecute(message) {
    const language = await languageSystem.getUserLanguage(message.author.id);
    await message.channel.send(buildMessage(language));
  }
};
