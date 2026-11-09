"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");

const MIN_MESSAGES = 2;
const MAX_MESSAGES = 100;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const CONFIRMATION_DELETE_MS = 6000;

function isAdministrator(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}

async function canBotManageMessages(guild, channel) {
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  return Boolean(botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages));
}

async function sendTemporaryReply(reply, content) {
  const sent = await reply(content);
  if (sent && typeof sent.delete === "function") {
    const timer = setTimeout(() => sent.delete().catch(() => {}), CONFIRMATION_DELETE_MS);
    timer.unref?.();
  }
  return sent;
}

async function clearMessages({ guild, channel, member, amount, invocationMessageId = null, reply }) {
  if (!isAdministrator(member)) {
    return sendTemporaryReply(reply, "🌙 Você precisa da permissão **Administrador** para utilizar este comando.");
  }

  if (!Number.isInteger(amount) || amount < MIN_MESSAGES || amount > MAX_MESSAGES) {
    return sendTemporaryReply(reply, "❄️ Informe uma quantidade entre **2 e 100 mensagens**.");
  }

  if (!await canBotManageMessages(guild, channel)) {
    return sendTemporaryReply(reply, "🫧 Preciso da permissão **Gerenciar mensagens** neste canal.");
  }

  try {
    // A API do Discord aceita no máximo 100 mensagens por busca.
    // Se a mensagem do comando estiver entre elas, buscamos uma anterior extra.
    let fetched = await channel.messages.fetch({ limit: amount });
    if (invocationMessageId && fetched.has(invocationMessageId)) {
      const oldest = fetched.last();
      if (oldest) {
        const extra = await channel.messages.fetch({ limit: 1, before: oldest.id });
        fetched = fetched.concat(extra);
      }
    }

    const cutoff = Date.now() - MAX_AGE_MS;
    const expired = fetched.filter(message =>
      message.id !== invocationMessageId &&
      message.createdTimestamp < cutoff
    );
    const eligible = fetched.filter(message =>
      message.id !== invocationMessageId &&
      message.createdTimestamp >= cutoff
    ).first(amount);

    if (eligible.length < MIN_MESSAGES) {
      return sendTemporaryReply(reply, "🫧 Encontrei menos de 2 mensagens anteriores, recentes e que podem ser apagadas. Mensagens com mais de 14 dias são preservadas.");
    }

    const deleted = await channel.bulkDelete(eligible, true);
    if (deleted.size < MIN_MESSAGES) {
      return sendTemporaryReply(reply, "🫧 Encontrei menos de 2 mensagens anteriores recentes que podem ser apagadas. Mensagens com mais de 14 dias são preservadas.");
    }

    if (expired.length > 0) {
      return sendTemporaryReply(reply, "❄️ Algumas mensagens que você selecionou ultrapassaram o limite de **14 dias** e não podem mais ser excluídas pelo Discord.\n\n🌸 Por segurança, essas mensagens foram preservadas. Apenas mensagens dentro do prazo permitido foram removidas.");
    }

    return sendTemporaryReply(reply, "🌸 Foram apagadas **" + deleted.size + "** mensagens com sucesso!");
  } catch (error) {
    console.error("[Yukina limpar] Falha ao apagar mensagens:", error);
    return sendTemporaryReply(reply, "🫧 Não consegui limpar o chat. Verifique minhas permissões e tente novamente.");
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
      reply: async content => {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
        const timer = setTimeout(() => interaction.deleteReply().catch(() => {}), CONFIRMATION_DELETE_MS);
        timer.unref?.();
        return null;
      }
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
      invocationMessageId: message.id,
      reply: content => message.reply(content)
    });
  }
};
