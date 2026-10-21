const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const PANEL_URL = "https://yukina-6uo.pages.dev/configuracoes-servidor.html";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Abre as configurações deste servidor no painel web da Yukina.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({
        content: "❄️ Use este comando dentro de um servidor Discord.",
        ephemeral: true,
      });
    }

    const url = new URL(PANEL_URL);
    url.searchParams.set("guild", interaction.guildId);
    url.searchParams.set("name", interaction.guild.name);

    return interaction.reply({
      content: `❄️ **Painel de Configurações da Yukina**\nAcesse o link abaixo para gerenciar as configurações deste servidor.\n\n🔗 ${url.toString()}`,
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};
