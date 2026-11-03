"use strict";

const { SlashCommandBuilder } = require("discord.js");
const translator = require("../systems/translator");

async function respond(interaction, phrase) {
  await interaction.deferReply();
  try {
    const result = await translator.translateWithCredits(interaction.user.id, phrase);
    return interaction.editReply({ embeds: [translator.buildTranslationEmbed(result, interaction.user)] });
  } catch (error) {
    console.error("[Yukina /traduzir] Falha na tradução:", error?.message || error);
    return interaction.editReply({ content: translator.errorMessage(error) });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("traduzir")
    .setDescription("[utilidade]Traduz uma frase para português.")
    .addStringOption(option =>
      option.setName("frase")
        .setDescription("Texto que deseja traduzir.")
        .setRequired(true)
        .setMaxLength(4500)
    ),

  aliases: ["traduzir", "traducao", "translate"],

  async execute(interaction) {
    return respond(interaction, interaction.options.getString("frase", true));
  },

  async prefixExecute(message, args = []) {
    const phrase = Array.isArray(args) ? args.join(" ") : String(args || "");
    if (!phrase.trim()) {
      return message.reply("🌸 Envie a frase depois do comando. Exemplo: `Ytraduzir good morning`");
    }
    try {
      const result = await translator.translateWithCredits(message.author.id, phrase);
      return message.reply({ embeds: [translator.buildTranslationEmbed(result, message.author)] });
    } catch (error) {
      console.error("[Yukina Ytraduzir] Falha na tradução:", error?.message || error);
      return message.reply(translator.errorMessage(error));
    }
  },
};
