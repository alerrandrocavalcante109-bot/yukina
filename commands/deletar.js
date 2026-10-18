const { SlashCommandBuilder } = require("discord.js");
const limpar = require("./limpar");

// Os três nomes usam a mesma implementação e as mesmas verificações de segurança.
module.exports = {
  ...limpar,
  data: new SlashCommandBuilder()
    .setName("deletar")
    .setDescription("Apaga mensagens recentes deste canal.")
    .setDefaultMemberPermissions(require("discord.js").PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option
        .setName("quantidade")
        .setDescription("Quantidade de mensagens para limpar (1 a 100).")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    ),
};
