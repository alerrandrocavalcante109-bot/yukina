"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");

const PANEL_URL = "https://yukina-6uo.pages.dev/configuracoes-servidor.html";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Abre as configurações deste servidor no painel web da Yukina.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      console.log(`[Painel] /painel solicitado por ${interaction.user?.tag || interaction.user?.id || "usuário desconhecido"} no servidor ${interaction.guildId || "DM"}.`);

      if (!interaction.inGuild() || !interaction.guildId) {
        return interaction.reply({
          content: "❄️ Use este comando dentro de um servidor Discord.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "🔒 Você precisa da permissão **Gerenciar servidor** para abrir este painel.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const url = new URL(PANEL_URL);
      url.searchParams.set("guild", interaction.guildId);
      url.searchParams.set("name", interaction.guild?.name || "Servidor");

      return await interaction.reply({
        content: [
          "❄️ **Painel de Configurações da Yukina**",
          "Abra o painel para gerenciar as configurações deste servidor:",
          "",
          `🔗 ${url.toString()}`,
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error("[Painel] Falha ao executar /painel:", {
        code: error?.code,
        message: error?.message,
        stack: error?.stack,
      });

      const payload = {
        content: "🫧 Não consegui abrir o painel agora. A equipe foi informada pelo log; tente novamente em instantes.",
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp(payload).catch(() => {});
      }
      if (interaction.isRepliable()) {
        return interaction.reply(payload).catch(() => {});
      }
    }
  },
};
