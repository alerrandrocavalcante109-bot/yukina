const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance } = require('../economia');

function createBalanceEmbed(user, balance, isOwnBalance) {
  return new EmbedBuilder()
    .setColor(0x87CEFA)
    .setAuthor({
      name: user.username,
      iconURL: user.displayAvatarURL(),
    })
    .setTitle('Saldo')
    .setDescription(
      isOwnBalance
        ? `Seu saldo atual é de **${balance.toLocaleString('pt-BR')} moedas**.`
        : `O saldo de <@${user.id}> é de **${balance.toLocaleString('pt-BR')} moedas**.`,
    )
    .setFooter({ text: 'Yukina • Economia' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Exibe o saldo de um usuário.')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuário que terá o saldo consultado.')
        .setRequired(false),
    ),

  prefix: {
    name: 'saldo',
    aliases: [],
    async execute(message, args) {
      const target = message.mentions.users.first();

      if (args?.length && !target) {
        await message.reply('Mencione um usuário válido para consultar o saldo.');
        return;
      }

      const user = target || message.author;
      const balance = getBalance(user.id);

      await message.reply({
        embeds: [createBalanceEmbed(user, balance, user.id === message.author.id)],
      });
    },
  },

  async execute(interaction) {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const balance = getBalance(target.id);

    await interaction.reply({
      embeds: [
        createBalanceEmbed(
          target,
          balance,
          target.id === interaction.user.id,
        ),
      ],
      ephemeral: true,
    });
  },
};
