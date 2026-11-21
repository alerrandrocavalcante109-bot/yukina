"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const languageSystem = require("../systems/idioma");
const panelLocale = require("../systems/idioma/locales/painel");

const PANEL_URL = "https://yukina-6uo.pages.dev/configuracoes-servidor.html";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Abre as configurações deste servidor no painel web da Yukina.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const language = await languageSystem.getUserLanguage(interaction.user.id);
    const t = key => panelLocale.getMessage(language, key);
    try {
      console.log(`[Painel] /painel solicitado por ${interaction.user?.tag || interaction.user?.id || "usuário desconhecido"} no servidor ${interaction.guildId || "DM"}.`);

      if (!interaction.inGuild() || !interaction.guildId) {
        return interaction.reply({
          content: t("serverOnly"),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: t("permission"),
          flags: MessageFlags.Ephemeral,
        });
      }

      const url = new URL(PANEL_URL);
      url.searchParams.set("guild", interaction.guildId);
      url.searchParams.set("name", interaction.guild?.name || "Servidor");

      return await interaction.reply({
        content: [
          t("title"),
          t("description"),
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
        content: t("error"),
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
  async prefixExecute(message) {
    const language = await languageSystem.getUserLanguage(message.author.id);
    const t = key => panelLocale.getMessage(language, key);
    try {
      console.log("[Painel] Ypainel solicitado por " + message.author.id + " no servidor " + (message.guildId || "DM") + ".");
      if (!message.guild || !message.guildId) {
        return message.reply(t("serverOnly"));
      }
      const permissions = message.member?.permissions;
      if (!permissions?.has(PermissionFlagsBits.ManageGuild) && !permissions?.has(PermissionFlagsBits.Administrator)) {
        return message.reply(t("permission"));
      }
      const url = new URL(PANEL_URL);
      url.searchParams.set("guild", message.guildId);
      url.searchParams.set("name", message.guild.name || "Servidor");
      return message.reply({
        content: "❄️ **Painel de Configurações da Yukina**\nAbra o painel para gerenciar as configurações deste servidor:\n\n🔗 " + url.toString(),
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error("[Painel] Falha em Ypainel:", error);
      return message.reply(t("error")).catch(() => {});
    }
  },
};
