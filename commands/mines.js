"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const mines = require("../systems/mines");

async function startFromCommand({ client, guild, channel, user, betInput, bombs, send }) {
  try {
    const result = await mines.startGame({ client, guild, channel, user, betInput, bombs, send });
    if (!result.ok) return send({ content: result.message, flags: MessageFlags.Ephemeral });
    return result.message;
  } catch (error) {
    console.error("[Yukina Mines] Falha ao iniciar partida:", error);
    return send({
      content: "Não foi possível iniciar sua partida agora. Tente novamente em instantes.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("iniciar-minas")
    .setDescription("[jogos] Explore as Cavernas de Kizunas.")
    .setDMPermission(false)
    .addStringOption(option => option
      .setName("valor")
      .setDescription("Aposta em KZ: valor, all (todo o saldo) ou half (metade).")
      .setRequired(true)
      .setMaxLength(24))
    .addIntegerOption(option => option
      .setName("bombas")
      .setDescription("Quantidade de bombas no tabuleiro.")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(16)),

  name: "mines",
  aliases: ["mines"],

  async execute(interaction) {
    return startFromCommand({
      client: interaction.client,
      guild: interaction.guild,
      channel: interaction.channel,
      user: interaction.user,
      betInput: interaction.options.getString("valor", true),
      bombs: interaction.options.getInteger("bombas", true),
      send: async payload => {
        if (interaction.replied || interaction.deferred) {
          return interaction.followUp(payload);
        }
        await interaction.reply(payload);
        return interaction.fetchReply();
      },
    });
  },

  async prefixExecute(message, args = []) {
    return startFromCommand({
      client: message.client,
      guild: message.guild,
      channel: message.channel,
      user: message.author,
      betInput: args[0],
      bombs: args.length === 2 ? Number(args[1]) : NaN,
      send: payload => {
        if ((Number(payload.flags) & MessageFlags.Ephemeral) === MessageFlags.Ephemeral) {
          return message.reply(payload.content);
        }
        return message.channel.send(payload);
      },
    });
  },
};
