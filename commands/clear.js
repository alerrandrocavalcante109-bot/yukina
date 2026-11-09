"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");

const BULK_DELETE_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const CLEAR_CHAT_BATCH_LIMIT = 10;

function canManageMessages(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.ManageMessages) || member?.permissions?.has(PermissionFlagsBits.Administrator));
}
async function checkBotPermission(guild, channel) {
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  return Boolean(botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages));
}

async function clearAmount({ guild, channel, member, amount, reply }) {
  if (!canManageMessages(member)) return reply("🌙 Você precisa da permissão **Gerenciar mensagens** para usar este comando.");
  if (!await checkBotPermission(guild, channel)) return reply("🫧 Preciso da permissão **Gerenciar mensagens** neste canal.");
  if (!Number.isInteger(amount) || amount < 2 || amount > 100) return reply("❄️ Escolha uma quantidade entre **2 e 100 mensagens**.");
  try {
    const deleted = await channel.bulkDelete(amount, true);
    return reply("❄️ Limpeza concluída: **" + deleted.size + "** mensagem(ns) apagada(s). Mensagens com mais de 14 dias não podem ser removidas em massa.");
  } catch (error) {
    console.error("[Yukina clear] Falha ao apagar mensagens:", error);
    return reply("🫧 Não consegui apagar as mensagens. Verifique minhas permissões e tente novamente.");
  }
}

async function clearChat({ guild, channel, member, reply }) {
  if (!canManageMessages(member)) return reply("🌙 Você precisa da permissão **Gerenciar mensagens** para limpar o chat.");
  if (!await checkBotPermission(guild, channel)) return reply("🫧 Preciso da permissão **Gerenciar mensagens** neste canal.");
  const cutoff = Date.now() - BULK_DELETE_MAX_AGE;
  let before;
  let total = 0;
  let batches = 0;
  try {
    while (batches < CLEAR_CHAT_BATCH_LIMIT) {
      const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!page.size) break;
      const oldest = page.last();
      const recent = page.filter(message => message.createdTimestamp >= cutoff && !message.pinned);
      if (recent.size) total += (await channel.bulkDelete(recent, true)).size;
      batches += 1;
      if (page.size < 100 || !oldest || oldest.createdTimestamp < cutoff) break;
      before = oldest.id;
    }
    const capped = batches >= CLEAR_CHAT_BATCH_LIMIT;
    return reply("🧹 Limpeza do chat concluída: **" + total + "** mensagem(ns) apagada(s)." +
      (capped ? " Alcancei o limite de segurança de 1.000 mensagens nesta execução." : "") +
      " Mensagens fixadas foram preservadas; mensagens com mais de 14 dias não podem ser apagadas em massa pelo Discord.");
  } catch (error) {
    console.error("[Yukina clear] Falha ao limpar o chat:", error);
    return reply("🫧 A limpeza foi interrompida. Verifique se tenho **Gerenciar mensagens** e tente novamente.");
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Limpar mensagens deste canal.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub => sub.setName("quantidade").setDescription("Apagar de 2 a 100 mensagens recentes.")
      .addIntegerOption(option => option.setName("quantidade").setDescription("Quantidade de mensagens.").setMinValue(2).setMaxValue(100).setRequired(true)))
    .addSubcommand(sub => sub.setName("chat").setDescription("Limpar até 1.000 mensagens recentes do canal, preservando fixadas.")),

  aliases: ["limpar", "purge", "clearchat", "limpar-chat"],

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", flags: MessageFlags.Ephemeral });
    const reply = content => interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (interaction.options.getSubcommand() === "chat") {
      return clearChat({ guild: interaction.guild, channel: interaction.channel, member: interaction.member, reply });
    }
    return clearAmount({
      guild: interaction.guild,
      channel: interaction.channel,
      member: interaction.member,
      amount: interaction.options.getInteger("quantidade", true),
      reply
    });
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    const first = String(args[0] || "").toLowerCase();
    if (["chat", "tudo", "all"].includes(first)) {
      return clearChat({ guild: message.guild, channel: message.channel, member: message.member, reply: content => message.channel.send(content) });
    }
    return clearAmount({
      guild: message.guild,
      channel: message.channel,
      member: message.member,
      amount: Number(first),
      reply: content => message.reply(content)
    });
  }
};
