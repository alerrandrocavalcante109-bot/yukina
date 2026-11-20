"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const messageCounter = require("../systems/message-counter");

const COLOR = 0xD99AC2;

function number(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("pt-BR");
}

function periodLabel(stats) {
  const [year, month, day] = stats.today.split("-");
  const [weekYear, weekMonth, weekDay] = stats.weekStart.split("-");
  const [monthYear, monthMonth] = stats.monthStart.split("-");
  return {
    day: day + "/" + month + "/" + year,
    week: weekDay + "/" + weekMonth + "/" + weekYear + " até hoje",
    month: monthMonth + "/" + monthYear
  };
}

async function showStats(source, targetUser) {
  if (!source.guild) {
    const payload = { content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true };
    return source.reply(payload);
  }

  const user = targetUser || source.user || source.author;
  await source.deferReply?.();
  try {
    const member = await source.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      const content = "🌙 Não encontrei esse membro neste servidor.";
      return source.editReply ? source.editReply({ content }) : source.reply(content);
    }
    const stats = await messageCounter.getStats(source.guild.id, user.id);
    const labels = periodLabel(stats);
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setAuthor({ name: "Yukina · Mensagens do servidor", iconURL: user.displayAvatarURL({ size: 128 }) })
      .setTitle("Estatísticas de mensagens")
      .setDescription("Membro: <@" + user.id + ">")
      .addFields(
        { name: "☀️ Hoje · " + labels.day, value: "**" + number(stats.day) + "** mensagens", inline: true },
        { name: "📅 Esta semana", value: "**" + number(stats.week) + "** mensagens\n" + labels.week, inline: true },
        { name: "🌸 Este mês · " + labels.month, value: "**" + number(stats.month) + "** mensagens", inline: true },
        { name: "💬 Total no servidor", value: "**" + number(stats.total) + "** mensagens", inline: false }
      )
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: "A contagem começa quando o sistema é ativado · Horário de Brasília" })
      .setTimestamp();
    return source.editReply
      ? source.editReply({ embeds: [embed], allowedMentions: { parse: [] } })
      : source.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Yukina mensagens] Falha ao consultar estatísticas:", error);
    const content = "🫧 Não consegui consultar as mensagens agora. Tente novamente em instantes.";
    return source.editReply ? source.editReply({ content }) : source.reply(content);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mensagens")
    .setDescription("Consulte a quantidade de mensagens de um membro do servidor.")
    .setDMPermission(false)
    .addSubcommand(sub => sub
      .setName("servidor")
      .setDescription("Veja as mensagens de um membro no servidor.")
      .addUserOption(option => option
        .setName("membro")
        .setDescription("Membro que deseja consultar; vazio mostra suas próprias mensagens.")
        .setRequired(false))),
  aliases: ["msg", "mensagem"],
  async execute(interaction) {
    const target = interaction.options.getUser("membro") || interaction.user;
    return showStats(interaction, target);
  },
  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Use este comando dentro de um servidor.");
    const mention = message.mentions.users.first();
    let target = mention || null;
    if (!target && args[0]) {
      const id = String(args[0]).replace(/[<@!>]/g, "");
      if (/^\d{17,20}$/.test(id)) target = await message.client.users.fetch(id).catch(() => null);
    }
    if (target && !message.guild.members.cache.has(target.id)) {
      return message.reply("🌙 Esse usuário não é membro deste servidor.");
    }
    return showStats(message, target || message.author);
  }
};
