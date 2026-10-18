const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const YUKINA_BLUE = 0xA7D8F0;
const MAX_BULK_DELETE = 100;

function yukinaEmbed(title, description, color = YUKINA_BLUE) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Yukina · Cuidando deste cantinho" })
    .setTimestamp();
}

function isSupportedChannel(channel) {
  return channel && [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
  ].includes(channel.type);
}

function parseAmount(value) {
  if (value === undefined || value === null || String(value).trim() === "") return 10;
  if (!/^\d+$/.test(String(value).trim())) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= MAX_BULK_DELETE
    ? amount
    : null;
}

function hasPermission(member, permission) {
  return Boolean(member?.permissions?.has(permission));
}

async function deleteRecentMessages(channel, amount) {
  // Discord não permite bulk delete de mensagens com 14 dias ou mais.
  const deleted = await channel.bulkDelete(amount, true);
  return deleted.size;
}

async function runClear({ channel, guild, amount, actor, botMember }) {
  if (!isSupportedChannel(channel)) {
    return { ok: false, title: "❄️ Este canal é diferente", message: "Posso limpar mensagens em canais de texto e de anúncios." };
  }

  if (!hasPermission(actor, PermissionFlagsBits.ManageMessages)) {
    return { ok: false, title: "🔒 Só a equipe pode fazer isso", message: "Você precisa da permissão **Gerenciar mensagens** para limpar este espaço." };
  }

  if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) {
    return { ok: false, title: "🥺 Preciso de uma ajudinha", message: "A Yukina precisa da permissão **Gerenciar mensagens** neste canal." };
  }

  try {
    const deleted = await deleteRecentMessages(channel, amount);
    if (deleted === 0) {
      return { ok: true, title: "🌸 Tudo já está em ordem!", message: "Não encontrei mensagens recentes que o Discord permita apagar em grupo. Mensagens com 14 dias ou mais precisam ser removidas individualmente." , deleted };
    }

    return {
      ok: true,
      title: "🧹 Um cantinho mais organizado!",
      message: `Prontinho! A Yukina removeu **${deleted} mensagem(ns)** de ${channel}.\n\nEspero que este espaço fique mais leve e organizado para todo mundo. ❄️`,
      deleted,
    };
  } catch (error) {
    console.error("[Yukina clear]", error);
    return {
      ok: false,
      title: "💧 Não consegui limpar o canal",
      message: "Confira se tenho a permissão **Gerenciar mensagens** e tente novamente. O Discord não permite apagar várias mensagens de uma vez quando elas têm 14 dias ou mais.",
    };
  }
}

async function replySlash(interaction, result) {
  const embed = yukinaEmbed(result.title, result.message, result.ok ? YUKINA_BLUE : 0xEFA6B8);
  if (interaction.deferred) {
    return interaction.editReply({ embeds: [embed] });
  }
  if (interaction.replied) {
    return interaction.followUp({ embeds: [embed], ephemeral: !result.ok });
  }
  return interaction.reply({ embeds: [embed], ephemeral: !result.ok });
}

async function replyPrefix(message, result) {
  return message.reply({
    embeds: [yukinaEmbed(result.title, result.message, result.ok ? YUKINA_BLUE : 0xEFA6B8)],
    allowedMentions: { repliedUser: false },
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("limpar")
    .setDescription("Limpa mensagens recentes deste canal.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option
        .setName("quantidade")
        .setDescription("Quantidade de mensagens para limpar (1 a 100).")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({
        embeds: [yukinaEmbed("🌸 Um cantinho de cada vez", "Este comando só pode ser usado dentro de um servidor.")],
        ephemeral: true,
      });
    }

    const amount = interaction.options.getInteger("quantidade") ?? 10;
    await interaction.deferReply({ ephemeral: false });
    const result = await runClear({
      channel: interaction.channel,
      guild: interaction.guild,
      amount,
      actor: interaction.member,
      botMember: interaction.guild.members.me,
    });
    return replySlash(interaction, result);
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) {
      return message.reply({ embeds: [yukinaEmbed("🌸 Um cantinho de cada vez", "Este comando só pode ser usado dentro de um servidor.")] });
    }

    const amount = parseAmount(args[0]);
    if (amount === null) {
      return message.reply({
        embeds: [yukinaEmbed("📝 Só preciso de um número!", "Use uma quantidade entre **1 e 100**. Exemplo: `Ylimpar 25`.")],
      });
    }

    const result = await runClear({
      channel: message.channel,
      guild: message.guild,
      amount,
      actor: message.member,
      botMember: message.guild.members.me,
    });

    // Mensagens com mais de 14 dias não são apagáveis em lote pela API do Discord.
    if (result.ok && result.deleted > 0) {
      try { await message.delete(); } catch {}
    }
    return replyPrefix(message, result);
  },
};
