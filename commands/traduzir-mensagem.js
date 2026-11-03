"use strict";

const { ContextMenuCommandBuilder, ApplicationCommandType } = require("discord.js");
const translator = require("../systems/translator");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Traduzir para português")
    .setType(ApplicationCommandType.Message),

  async execute(interaction) {
    const selectedMessage = interaction.targetMessage;
    const phrase = selectedMessage?.content?.trim();
    if (!phrase) {
      return interaction.reply({
        content: "🌙 Essa mensagem não contém texto para traduzir.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    try {
      const result = await translator.translateWithCredits(interaction.user.id, phrase);
      return interaction.editReply({
        embeds: [translator.buildTranslationEmbed(result, interaction.user)],
      });
    } catch (error) {
      console.error("[Yukina tradução por mensagem] Falha:", error?.message || error, error?.details ? "| Detalhes:" : "", error?.details || "");
      return interaction.editReply({ content: translator.errorMessage(error) });
    }
  },
};
