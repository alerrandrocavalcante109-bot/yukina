"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require("discord.js");

const MAX_SLOWMODE_SECONDS = 21600;

function parseDuration(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["off", "off", "desativar", "desligar", "0"].includes(raw)) return 0;
  const match = raw.match(/^(\d+)\s*(s|seg|segs|segundo|segundos|m|min|minuto|minutos|h|hora|horas)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] || "s";
  const multiplier = ["m", "min", "minuto", "minutos"].includes(unit)
    ? 60
    : ["h", "hora", "horas"].includes(unit) ? 3600 : 1;
  const seconds = amount * multiplier;
  return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= MAX_SLOWMODE_SECONDS
    ? seconds
    : null;
}

function isTextChannel(channel) {
  return Boolean(channel && (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.PublicThread ||
    channel.type === ChannelType.PrivateThread ||
    channel.type === ChannelType.AnnouncementThread
  ) && typeof channel.setRateLimitPerUser === "function");
}

async function applySlowmode({ guild, channel, member, reply }) {
  if (!guild || !channel || !isTextChannel(channel)) {
    return reply("❄️ Selecione um canal de texto válido deste servidor.");
  }

  const memberPermissions = member?.permissions;
  if (!memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
      !memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return reply("🔒 Você precisa da permissão **Gerenciar canais** para alterar o modo lento.");
  }

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
    return reply("🫧 Preciso da permissão **Gerenciar canais** neste canal para aplicar o modo lento.");
  }

  const current = Number(channel.rateLimitPerUser) || 0;
  const next = arguments; // placeholder
}

async function changeSlowmode({ guild, channel, member, seconds, reply, actor }) {
  if (!guild || !channel || !isTextChannel(channel)) {
    return reply("❄️ Selecione um canal de texto válido deste servidor.");
  }
  const permissions = member?.permissions;
  if (!permissions?.has(PermissionFlagsBits.ManageChannels) &&
      !permissions?.has(PermissionFlagsBits.Administrator)) {
    return reply("🔒 Você precisa da permissão **Gerenciar canais** para alterar o modo lento.");
  }
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
    return reply("🫧 Preciso da permissão **Gerenciar canais** neste canal para aplicar o modo lento.");
  }

  const previous = Number(channel.rateLimitPerUser) || 0;
  try {
    await channel.setRateLimitPerUser(seconds, "Modo lento configurado por " + actor);
    const status = seconds === 0
      ? (previous === 0 ? "já estava desativado" : "foi desativado")
      : previous === 0 ? "foi ativado" : "foi atualizado";
    const duration = seconds === 0 ? "" : " para **" + formatDuration(seconds) + "**";
    return reply("🌸 O modo lento " + status + " em " + channel.toString() + duration + ".");
  } catch (error) {
    console.error("[Yukina /slow] Falha ao alterar modo lento:", {
      guildId: guild.id, channelId: channel.id, actor, message: error?.message || String(error)
    });
    return reply("🫧 Não consegui alterar o modo lento. Confira se tenho **Gerenciar canais** e se o canal permite essa alteração.");
  }
}

function formatDuration(seconds) {
  if (seconds % 3600 === 0) return (seconds / 3600) + " hora(s)";
  if (seconds % 60 === 0) return (seconds / 60) + " minuto(s)";
  return seconds + " segundo(s)";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slow")
    .setDescription("Gerencia o modo lento de um canal.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand => subcommand
      .setName("modo-lento")
      .setDescription("Ativa, atualiza ou desativa o modo lento.")
      .addChannelOption(option => option
        .setName("canal")
        .setDescription("Canal de texto que será configurado.")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
      .addIntegerOption(option => option
        .setName("segundos")
        .setDescription("Intervalo em segundos (0 desativa; máximo de 21600).")
        .setMinValue(0)
        .setMaxValue(MAX_SLOWMODE_SECONDS)
        .setRequired(true))),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", flags: MessageFlags.Ephemeral });
    }
    const channel = interaction.options.getChannel("canal", true);
    const seconds = interaction.options.getInteger("segundos", true);
    return changeSlowmode({
      guild: interaction.guild,
      channel,
      member: interaction.member,
      seconds,
      actor: interaction.user.id,
      reply: content => interaction.reply({ content, flags: MessageFlags.Ephemeral }),
    });
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    const channelMention = String(args[0] || "");
    const channelId = channelMention.match(/^<#(\d+)>$/)?.[1];
    const channel = channelId
      ? await message.guild.channels.fetch(channelId).catch(() => null)
      : message.channel;
    const durationText = channelId ? args[1] : args[0];
    const seconds = parseDuration(durationText);
    if (seconds === null) {
      return message.reply("📝 Use `Yslow 30s`, `Yslow 5m` ou `Yslow #canal off`. Sem mencionar canal, aplico no canal atual. O limite é 6 horas.");
    }
    return changeSlowmode({
      guild: message.guild,
      channel,
      member: message.member,
      seconds,
      actor: message.author.id,
      reply: content => message.reply(content),
    });
  },
};