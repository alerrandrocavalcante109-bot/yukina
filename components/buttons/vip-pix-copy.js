const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

module.exports = {
  customId: "vip:pix-copy",
  async execute(interaction) {
    const pixKey = (process.env.VIP_PIX_KEY || "").trim();
    if (!pixKey) {
      return interaction.reply({ content: "A chave Pix não está configurada no momento. Avise a equipe da Yukina.", ephemeral: true });
    }
    const container = new ContainerBuilder()
      .setAccentColor(0xA7D8F0)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Chave Pix para renovação\nCopie a chave abaixo para colar no aplicativo do seu banco:\n\n\`${pixKey}\``)
      );
    return interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
