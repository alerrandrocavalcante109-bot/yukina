const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance } = require('../economia');

function createBalanceEmbed(user, balance) {
  return new EmbedBuilder()
    .setColor(0x87CEFA)
    .setAuthor({
      name: user.username,
      iconURL: user.displayAvatarURL(),
    })
    .setTitle('Saldo')
    .setDescription(`Seu saldo atual é de **${balance.toLocaleString('pt-BR')} moedas**.`)
    .setFooter({ text: 'Yukina • Economia' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Exibe seu saldo de moedas.'),

  prefix: {
    name: 'saldo',
    aliases: [],
    async execute(message) {
      const balance = getBalance(message.author.id);
      await message.reply({
        embeds: [createBalanceEmbed(message.author, balance)],
      });
    },
  },

  async execute(interaction) {
    const balance = getBalance(interaction.user.id);

    await interaction.reply({
      embeds: [createBalanceEmbed(interaction.user, balance)],
      ephemeral: true,
    });
  },
};
