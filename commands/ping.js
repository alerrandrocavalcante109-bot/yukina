const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

async function buildPingEmbed(client, startedAt) {
  const responseLatency = Date.now() - startedAt;
  const gatewayLatency = client.ws.ping;
  const healthy = gatewayLatency >= 0 && gatewayLatency < 250;

  const status = gatewayLatency < 0
    ? 'Conectando'
    : healthy
      ? 'Operacional'
      : 'Instável';

  const color = gatewayLatency < 0
    ? 0x87CEFA
    : healthy
      ? 0x87CEFA
      : 0xE67E22;

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: client.user.username,
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle('Diagnóstico de conexão')
    .setDescription('Métricas atuais de comunicação com a API do Discord.')
    .addFields(
      {
        name: 'Gateway',
        value: gatewayLatency < 0 ? 'Calculando…' : `${gatewayLatency} ms`,
        inline: true,
      },
      {
        name: 'Resposta',
        value: `${responseLatency} ms`,
        inline: true,
      },
      {
        name: 'Estado',
        value: status,
        inline: true,
      },
    )
    .setFooter({ text: 'Yukina • Sistema de diagnóstico' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Exibe a latência e o estado da conexão do bot.'),

  prefix: {
    name: 'ping',
    aliases: [],
    async execute(message) {
      const startedAt = Date.now();

      const embed = await buildPingEmbed(message.client, startedAt);
      await message.reply({ embeds: [embed] });
    },
  },

  async execute(interaction) {
    const startedAt = Date.now();

    await interaction.deferReply({ ephemeral: true });

    const embed = await buildPingEmbed(interaction.client, startedAt);
    await interaction.editReply({ embeds: [embed] });
  },
};
