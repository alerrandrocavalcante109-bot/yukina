"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");

const MIN_MESSAGES = 2;
const MAX_MESSAGES = 100;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function isAdministrator(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}

async function canBotManageMessages(guild, channel) {
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  return Boolean(botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages));
}

async function clearMessages({ guild, channel, member, amount, reply }) {
  if (!isAdministrator(member)) {
    return reply("🌙 Apenas membros da administração podem utilizar este comando.");
  }

  if (!Number.isInteger(amount) || amount < MIN_MESSAGES || amount > MAX_MESSAGES) {
    return reply("❄️ Informe uma quantidade entre **2 e 100 mensagens**.");
  }

  if (!await canBotManageMessages(guild, channel)) {
    return reply("🫧 Preciso da permissão **Gerenciar mensagens** neste canal.");
  }

  try {
    // O Discord não permite exclusão em massa de mensagens com mais de 14 dias.
    // filterOld=true faz a API ignorar mensagens fora desse limite.
    const deleted = await channel.bulkDelete(amount, true);
    if (deleted.size < MIN_MESSAGES) {
      return reply("🫧 Encontrei menos de 2 mensagens recentes que podem ser apagadas. Mensagens com mais de 14 dias são preservadas.");
    }

    return reply("🌸 Foram apagadas **" + deleted.size + "** mensagens com sucesso!");
  } catch (error) {
    console.error("[Yukina limpar] Falha ao apagar mensagens:", error);
    return reply("🫧 Não consegui limpar o chat. Verifique minhas permissões e tente novamente.");
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("limpar")
    .setDescription("Limpar mensagens do chat.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => subcommand
      .setName("chat")
      .setDescription("Apagar de 2 a 100 mensagens recentes deste canal.")
      .addIntegerOption(option => option
        .setName("quantidade")
        .setDescription("Quantidade de mensagens que deseja apagar.")
        .setMinValue(MIN_MESSAGES)
        .setMaxValue(MAX_MESSAGES)
        .setRequired(true))),

  aliases: ["clear", "limpar", "deletar"],

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "❄️ Este comando só funciona dentro de um servidor.",
        flags: MessageFlags.Ephemeral
      });
    }

    return clearMessages({
      guild: interaction.guild,
      channel: interaction.channel,
      member: interaction.member,
      amount: interaction.options.getInteger("quantidade", true),
      reply: content => interaction.reply({
        content,
        flags: MessageFlags.Ephemeral
      })
    });
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) {
      return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    }

    const values = args[0]?.toLowerCase() === "chat" ? args.slice(1) : args;
    const amount = values.length === 1 ? Number(values[0]) : NaN;

    return clearMessages({
      guild: message.guild,
      channel: message.channel,
      member: message.member,
      amount,
      reply: content => message.reply(content)
    });
  }
};
