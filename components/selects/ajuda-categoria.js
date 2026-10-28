"use strict";

const { MessageFlags } = require("discord.js");
const { buildHelpPayload } = require("../../commands/ajuda");

module.exports = {
  customId: "yukina-help-category",
  async execute(interaction) {
    const selectedKey = interaction.values?.[0];
    const payload = buildHelpPayload(interaction.client.commands || new Map(), selectedKey);
    try {
      await interaction.update(payload);
    } catch (error) {
      console.error("[Yukina Ajuda] Não foi possível atualizar a categoria:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❄️ Não consegui abrir essa categoria agora. Tente usar o comando novamente.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  },
};