"use strict";

const { MessageFlags } = require("discord.js");
const { buildHelpPayload } = require("../../commands/ajuda");
const { getUserLanguage } = require("../../systems/idioma");
const { getMessage } = require("../../systems/idioma/locales/help");

module.exports = {
  customId: "yukina-help-category",
  async execute(interaction) {
    const selectedKey = interaction.values?.[0];
    const language = await getUserLanguage(interaction.user.id);
    const payload = buildHelpPayload(interaction.client.commands || new Map(), selectedKey, language);
    try {
      await interaction.update(payload);
    } catch (error) {
      console.error("[Yukina Ajuda] Não foi possível atualizar a categoria:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: getMessage(language, "selectError"),
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  },
};
