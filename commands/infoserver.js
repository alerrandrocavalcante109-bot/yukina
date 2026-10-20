"use strict";

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require("discord.js");

const COLOR = 0xA7D8F0;

function formatDate(date) {
  const unix = Math.floor(date.getTime() / 1000);
  return "<t:" + unix + ":F>\n<t:" + unix + ":R>";
}

function buildServerInfo(guild, owner) {
  const channels = guild.channels.cache;
  const textChannels = channels.filter(channel =>
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.GuildForum ||
    channel.type === ChannelType.GuildMedia
  ).size;
  const voiceChannels = channels.filter(channel =>
    channel.type === ChannelType.GuildVoice ||
    channel.type === ChannelType.GuildStageVoice
  ).size;

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("❄️ Informações do servidor")
    .setDescription("Aqui estão os dados de **" + guild.name + "**.")
    .addFields(
      { name: "🆔 ID do servidor", value: "`" + guild.id + "`", inline: true },
      { name: "🌌 Shard ID", value: String(guild.shardId ?? 0), inline: true },
      { name: "👑 Dono", value: owner.user.tag + "\n`" + owner.id + "`", inline: false },
      { name: "📚 Canais no total", value: String(channels.size), inline: true },
      { name: "💬 Canais de texto", value: String(textChannels), inline: true },
      { name: "🔊 Canais de voz", value: String(voiceChannels), inline: true },
      { name: "👥 Membros", value: guild.memberCount.toLocaleString("pt-BR"), inline: true },
      { name: "📅 Criado em", value: formatDate(guild.createdAt), inline: false }
    )
    .setFooter({ text: "Yukina · Cuidando deste cantinho" })
    .setTimestamp();

  const icon = guild.iconURL({ size: 1024 });
  if (icon) embed.setThumbnail(icon);
  return embed;
}

async function replyWithInfo(interaction) {
  const guild = interaction.guild;
  const invoker = interaction.user || interaction.author;
  if (!guild) {
    return interaction.reply({
      content: "❄️ Este comando só funciona dentro de um servidor.",
      ephemeral: true
    });
  }

  try {
    await guild.fetch();
    await guild.channels.fetch();
    const owner = await guild.fetchOwner();
    return interaction.reply({
      content: "❄️ Informações solicitadas por <@" + invoker.id + ">.",
      embeds: [buildServerInfo(guild, owner)],
      allowedMentions: { users: [invoker.id], parse: [] }
    });
  } catch (error) {
    console.error("[Yukina /infoserver]", error);
    const payload = {
      content: "💧 Não consegui obter todas as informações do servidor. Confira minhas permissões e tente novamente.",
      ephemeral: true
    };
    if (interaction.deferred || interaction.replied) return interaction.followUp(payload).catch(() => {});
    return interaction.reply(payload).catch(() => {});
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("infoserver")
    .setDescription("Mostra as informações principais deste servidor.")
    .setDMPermission(false),
  aliases: ["serverinfo", "servidorinfo"],
  async execute(interaction) {
    return replyWithInfo(interaction);
  },
  async prefixExecute(message) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    const interactionLike = {
      guild: message.guild,
      author: message.author,
      reply: payload => message.channel.send(payload),
      followUp: payload => message.channel.send(payload),
      deferred: false,
      replied: false
    };
    return replyWithInfo(interactionLike);
  }
};
