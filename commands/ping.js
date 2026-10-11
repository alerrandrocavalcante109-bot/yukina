const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

async function buildPingEmbed(client, startedAt) {
  const responseLatency = Date.now() - startedAt;
  const gatewayLatency = client.ws.ping;
  const apiLatency = gatewayLatency;

  const status = gatewayLatency < 0
    ? '🔄 Conectando'
    : gatewayLatency < 150
      ? '🟢 Excelente'
      : gatewayLatency < 250
        ? '🟡 Operacional'
        : '🔴 Instável';

  return new EmbedBuilder()
    .setColor(0x87CEFA)
    .setAuthor({
      name: client.user.username,
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle('📡 Diagnóstico de conexão')
    .setDescription(
      '🛰️ **Status da comunicação com a API do Discord**\n' +
      '━━━━━━━━━━━━━━━━━━━━',
    )
    .addFields(
      {
        name: '⚡ Latência da API',
        value: gatewayLatency < 0 ? 'Calculando…' : `**${apiLatency} ms**`,
        inline: true,
      },
      {
        name: '💬 Tempo de resposta',
        value: `**${responseLatency} ms**`,
        inline: true,
      },
      {
        name: '📶 Estado',
        value: `**${status}**`,
        inline: true,
      },
      {
        name: '🌐 Gateway',
        value: gatewayLatency < 0 ? 'Calculando…' : `Conectado • ${gatewayLatency} ms`,
        inline: false,
      },
    )
    .setFooter({ text: 'Yukina • Monitoramento de conexão' })
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

      try {
        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      } catch (error) {
        // Se a mensagem original não puder ser usada como referência, envie no canal.
        if (error?.code !== 50035) throw error;
        await message.channel.send({ embeds: [embed] });
      }
    },
  },

  async execute(interaction) {
    const startedAt = Date.now();
    await interaction.deferReply({ ephemeral: true });
    const embed = await buildPingEmbed(interaction.client, startedAt);
    await interaction.editReply({ embeds: [embed] });
  },
};
