"use strict";

const { SlashCommandBuilder } = require("discord.js");
const languageSystem = require("../../systems/idioma");

const choices = Object.entries(languageSystem.LANGUAGES).map(([value, item]) => ({
  name: item.flag + " " + item.name,
  value,
}));

function parsePrefixLanguage(value) {
  const input = String(value || "").trim().toLowerCase();
  if (!input) return { action: "show" };
  if (["padrao", "padrão", "default", "reset", "pt", "pt-br", "portugues", "português"].includes(input)) {
    return { action: "set", language: "pt-BR" };
  }
  const aliases = {
    en: "en-US", english: "en-US", ingles: "en-US", inglês: "en-US",
    es: "es-ES", espanhol: "es-ES", spanish: "es-ES",
    fr: "fr-FR", frances: "fr-FR", francês: "fr-FR",
    ja: "ja-JP", japones: "ja-JP", japonês: "ja-JP", japanese: "ja-JP",
    de: "de-DE", alemao: "de-DE", alemão: "de-DE", german: "de-DE",
    it: "it-IT", italiano: "it-IT",
  };
  return { action: "set", language: aliases[input] || languageSystem.normalizeLanguage(value) };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("idioma")
    .setDescription("Altera o idioma das respostas dos comandos da Yukina para você.")
    .addStringOption(option =>
      option.setName("idioma")
        .setDescription("Idioma que você deseja utilizar.")
        .setRequired(false)
        .addChoices(...choices)
    ),
  aliases: ["idiomas", "language", "languages"],
  async execute(interaction) {
    const userId = interaction.user.id;
    const selected = interaction.options.getString("idioma");
    if (!selected) {
      const current = await languageSystem.getUserLanguage(userId);
      const item = languageSystem.LANGUAGES[current];
      return interaction.reply({
        content: languageSystem.translate(current, "current", { language: item.name + " " + item.flag }) +
          "\n\n" + languageSystem.translate(current, "usage"),
        ephemeral: true,
      });
    }

    await languageSystem.setUserLanguage(userId, selected);
    const item = languageSystem.LANGUAGES[selected];
    return interaction.reply({
      content: languageSystem.translate(selected, "selected", { language: item.name + " " + item.flag }),
      ephemeral: true,
    });
  },
  async prefixExecute(message, args) {
    const userId = message.author.id;
    const parsed = parsePrefixLanguage(args.join(" "));
    if (parsed.action === "show") {
      const current = await languageSystem.getUserLanguage(userId);
      const item = languageSystem.LANGUAGES[current];
      return message.reply(
        languageSystem.translate(current, "current", { language: item.name + " " + item.flag }) +
        "\n\n" + languageSystem.translate(current, "usage") +
        "\n\n" + choices.map(choice => choice.value + " — " + choice.name).join("\n")
      );
    }
    if (!parsed.language) {
      const current = await languageSystem.getUserLanguage(userId);
      return message.reply(languageSystem.translate(current, "invalid"));
    }

    const selected = await languageSystem.setUserLanguage(userId, parsed.language);
    const item = languageSystem.LANGUAGES[selected];
    return message.reply(languageSystem.translate(selected, "selected", {
      language: item.name + " " + item.flag,
    }));
  },
};
