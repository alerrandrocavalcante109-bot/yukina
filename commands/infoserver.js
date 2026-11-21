"use strict";

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const idioma = require("../systems/idioma");
const LOCALES = require("../systems/idioma/locales/infoserver");

const COLOR = 0xA7D8F0;

function translator(language) {
  const locale = LOCALES[language] || LOCALES["pt-BR"];
  return (key, variables = {}) => String(locale[key] || LOCALES["pt-BR"][key] || key)
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : ""
    );
}

function formatDate(date) {
  const unix = Math.floor(date.getTime() / 1000);
  return "<t:" + unix + ":F>\n<t:" + unix + ":R>";
}

function buildServerInfo(guild, owner, invoker, t, language) {
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
  const number = value => Number(value).toLocaleString(language);

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: t("requested", { user: invoker.globalName || invoker.username }), iconURL: invoker.displayAvatarURL({ size: 128 }) })
    .setTitle(t("title"))
    .setDescription(t("description", { server: guild.name }))
    .addFields(
      { name: t("id"), value: "`" + guild.id + "`", inline: true },
      { name: t("shard"), value: String(guild.shardId ?? 0), inline: true },
      { name: t("owner"), value: owner.user.tag + "\n`" + owner.id + "`", inline: false },
      { name: t("channels"), value: number(channels.size), inline: true },
      { name: t("text"), value: number(textChannels), inline: true },
      { name: t("voice"), value: number(voiceChannels), inline: true },
      { name: t("members"), value: number(guild.memberCount), inline: true },
      { name: t("created"), value: formatDate(guild.createdAt), inline: false }
    )
    .setFooter({ text: t("footer") })
    .setTimestamp();

  const icon = guild.iconURL({ size: 1024 });
  if (icon) embed.setThumbnail(icon);
  return embed;
}

async function replyWithInfo(interaction) {
  const guild = interaction.guild;
  const invoker = interaction.author || interaction.user;
  const userId = invoker.id;
  const language = await idioma.getUserLanguage(userId);
  const t = translator(language);

  if (!guild) {
    return interaction.reply({
      content: t("serverOnly"),
      ephemeral: true
    });
  }

  try {
    await guild.fetch();
    await guild.channels.fetch();
    const owner = await guild.fetchOwner();
    const payload = { embeds: [buildServerInfo(guild, owner, invoker, t, language)] };
    return interaction.reply(payload);
  } catch (error) {
    console.error("[Yukina /infoserver]", error);
    const payload = {
      content: t("error"),
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
    if (!message.guild) {
      const language = await idioma.getUserLanguage(message.author.id);
      return message.reply(translator(language)("serverOnly"));
    }
    await message.channel.sendTyping().catch(() => {});
    const interactionLike = {
      guild: message.guild,
      author: message.author,
      reply: payload => message.reply(payload),
      followUp: payload => message.reply(payload),
      deferred: false,
      replied: false
    };
    return replyWithInfo(interactionLike);
  }
};
