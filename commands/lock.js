const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");

const YUKINA_BLUE = 0xA7D8F0;
const YUKINA_PINK = 0xEFA6B8;

function createEmbed(title, description, color = YUKINA_BLUE) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description)
    .setFooter({ text: "Yukina · Cuidando deste cantinho" }).setTimestamp();
}
function isTextChannel(channel) {
  return channel && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type);
}
function isLocked(channel, guild) {
  const overwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
  return Boolean(
    overwrite?.deny.has(PermissionFlagsBits.SendMessages) ||
    overwrite?.deny.has(PermissionFlagsBits.SendMessagesInThreads) ||
    overwrite?.deny.has(PermissionFlagsBits.CreatePublicThreads) ||
    overwrite?.deny.has(PermissionFlagsBits.CreatePrivateThreads)
  );
}
function lockPermissions() {
  return {
    SendMessages: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Bloqueia um canal para novas mensagens e tópicos.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option => option.setName("canal")
      .setDescription("Escolha o canal que a Yukina deve bloquear.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ embeds: [createEmbed("🌸 Um cantinho de cada vez", "Este comando só pode ser usado dentro de um servidor.")], ephemeral: true });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ embeds: [createEmbed("🔒 Só a equipe pode fazer isso", "Você precisa da permissão **Gerenciar canais** para fechar este espaço.")], ephemeral: true });
    }

    const channel = interaction.options.getChannel("canal", true);
    if (!isTextChannel(channel) || channel.guildId !== interaction.guild.id) {
      return interaction.reply({ embeds: [createEmbed("❄️ Este canal é diferente", "Escolha um canal de texto ou de anúncios deste servidor.")], ephemeral: true });
    }
    if (isLocked(channel, interaction.guild)) {
      return interaction.reply({ embeds: [createEmbed("🔒 Este cantinho já está fechado!", "O canal " + channel + " **já está bloqueado**. Esse bloqueio pode ter sido feito por outro bot ou manualmente nas permissões do Discord. A Yukina não vai sobrescrever as configurações existentes. ❄️")], ephemeral: true });
    }

    const botMember = interaction.guild.members.me;
    if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ embeds: [createEmbed("🥺 Preciso de uma ajudinha", "A Yukina precisa da permissão **Gerenciar canais** para cuidar deste espaço.", YUKINA_PINK)], ephemeral: true });
    }

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, lockPermissions(), {
        reason: "Canal bloqueado com /lock da Yukina; bloqueia mensagens e criação de tópicos",
      });
      return interaction.reply({ embeds: [createEmbed("🔒 Shhh… vamos cuidar do cantinho!",
        "O canal " + channel + " foi **bloqueado para novas mensagens e criação de tópicos públicos e privados**.\n\nA conversa fica em pausa por enquanto, mas a equipe ainda pode organizar tudo com carinho. 🌸")] });
    } catch (error) {
      console.error("[Yukina /lock]", error);
      return interaction.reply({ embeds: [createEmbed("💧 Não consegui fechar o canal", "Confira se a Yukina tem **Gerenciar canais** e **Gerenciar cargos**, e tente novamente.", YUKINA_PINK)], ephemeral: true });
    }
  },

  async prefixExecute(message) {
    if (!message.guild || !message.channel) {
      return message.reply({ embeds: [createEmbed("🌸 Um cantinho de cada vez", "Este comando só pode ser usado dentro de um servidor.") ] });
    }
    if (!message.member?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply({ embeds: [createEmbed("🔒 Só a equipe pode fazer isso", "Você precisa da permissão **Gerenciar canais** para fechar este espaço.")] });
    }

    // Permite Ylock ou Ylock #canal. Sem menção, usa o canal atual.
    const mentionedChannel = message.mentions.channels.first();
    const channel = mentionedChannel || message.channel;
    if (!isTextChannel(channel) || channel.guildId !== message.guild.id) {
      return message.reply({ embeds: [createEmbed("❄️ Este canal é diferente", "Escolha um canal de texto ou de anúncios deste servidor.")] });
    }
    if (isLocked(channel, message.guild)) {
      return message.channel.send({ embeds: [createEmbed("🔒 Este cantinho já está fechado!", "O canal " + channel + " **já está bloqueado**. Esse bloqueio pode ter sido feito por outro bot ou manualmente nas permissões do Discord. A Yukina não vai sobrescrever as configurações existentes. ❄️")] });
    }

    const botMember = message.guild.members.me;
    if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
      return message.reply({ embeds: [createEmbed("🥺 Preciso de uma ajudinha", "A Yukina precisa da permissão **Gerenciar canais** para cuidar deste espaço.", YUKINA_PINK)] });
    }

    // Envia o aviso antes de bloquear para não perder a permissão de falar no canal-alvo.
    const notice = await message.channel.send({
      embeds: [createEmbed("🌙 Um instante, vou cuidar deste cantinho…", "A Yukina está ajustando as permissões de " + channel + ". ❄️")],
    }).catch(() => null);

    try {
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, lockPermissions(), {
        reason: "Canal bloqueado com Ylock da Yukina; bloqueia mensagens e criação de tópicos",
      });

      const payload = { embeds: [createEmbed("🔒 Shhh… vamos cuidar do cantinho!",
        "O canal " + channel + " foi **bloqueado para novas mensagens e criação de tópicos públicos e privados**.\n\nA conversa fica em pausa por enquanto, mas a equipe ainda pode organizar tudo com carinho. 🌸")] };
      if (notice) return notice.edit(payload);
      return message.channel.send(payload);
    } catch (error) {
      console.error("[Yukina Ylock]", error);
      const payload = { embeds: [createEmbed("💧 Não consegui fechar o canal", "Confira se a Yukina tem **Gerenciar canais** e **Gerenciar cargos**, e tente novamente.", YUKINA_PINK)] };
      if (notice) return notice.edit(payload).catch(() => null);
      return message.channel.send(payload).catch(() => null);
    }
  },
};
