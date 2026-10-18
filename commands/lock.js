const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");

const YUKINA_BLUE = 0xA7D8F0;

function createEmbed(title, description, color = YUKINA_BLUE) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Yukina · Cuidando deste cantinho" })
    .setTimestamp();
}

function canManage(member) {
  return member?.permissions?.has(PermissionFlagsBits.ManageChannels);
}

function isTextChannel(channel) {
  return channel && [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
  ].includes(channel.type);
}

async function lockChannel(channel, guild) {
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    SendMessages: false,
    SendMessagesInThreads: false,
  }, { reason: "Canal bloqueado com o comando lock da Yukina" });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Fecha este canal para novas mensagens.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({
        embeds: [createEmbed("🌸 Um cantinho de cada vez", "Este comando só pode ser usado dentro de um servidor.")],
        ephemeral: true,
      });
    }

    const channel = interaction.channel;
    if (!isTextChannel(channel)) {
      return interaction.reply({
        embeds: [createEmbed("❄️ Este canal é diferente", "Posso bloquear mensagens em canais de texto e de anúncios.")],
        ephemeral: true,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        embeds: [createEmbed("🔒 Só a equipe pode fazer isso", "Você precisa da permissão **Gerenciar canais** para fechar este espaço.")],
        ephemeral: true,
      });
    }

    const botMember = interaction.guild.members.me;
    if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        embeds: [createEmbed("🥺 Preciso de uma ajudinha", "A Yukina precisa da permissão **Gerenciar canais** para cuidar deste espaço.")],
        ephemeral: true,
      });
    }

    try {
      await lockChannel(channel, interaction.guild);
      return interaction.reply({
        embeds: [createEmbed(
          "🔒 Shhh… vamos cuidar do cantinho!",
          `O canal ${channel} foi **bloqueado para novas mensagens**.\n\nA conversa fica em pausa por enquanto, mas a equipe ainda pode organizar tudo com carinho. 🌸`
        )],
      });
    } catch (error) {
      console.error("[Yukina /lock]", error);
      return interaction.reply({
        embeds: [createEmbed("💧 Não consegui fechar o canal", "Confira as permissões da Yukina e tente novamente.", 0xEFA6B8)],
        ephemeral: true,
      });
    }
  },

  async prefixExecute(message) {
    if (!message.guild || !message.channel) {
      return message.reply({ embeds: [createEmbed("🌸 Um cantinho de cada vez", "Este comando só pode ser usado dentro de um servidor.")] });
    }

    if (!canManage(message.member)) {
      return message.reply({ embeds: [createEmbed("🔒 Só a equipe pode fazer isso", "Você precisa da permissão **Gerenciar canais** para fechar este espaço.")] });
    }

    if (!isTextChannel(message.channel)) {
      return message.reply({ embeds: [createEmbed("❄️ Este canal é diferente", "Posso bloquear mensagens em canais de texto e de anúncios.")] });
    }

    const botMember = message.guild.members.me;
    if (!botMember?.permissionsIn(message.channel).has(PermissionFlagsBits.ManageChannels)) {
      return message.reply({ embeds: [createEmbed("🥺 Preciso de uma ajudinha", "A Yukina precisa da permissão **Gerenciar canais** para cuidar deste espaço.")] });
    }

    // Envia a mensagem antes de bloquear: depois, a Yukina pode perder
    // a permissão de enviar mensagens neste canal.
    const notice = await message.channel.send({
      embeds: [createEmbed("🌙 Um instante, vou cuidar deste cantinho…", "A Yukina está ajustando as permissões deste canal. ❄️")],
    }).catch(() => null);

    try {
      await lockChannel(message.channel, message.guild);
      const payload = { embeds: [createEmbed(
        "🔒 Shhh… vamos cuidar do cantinho!",
        `O canal <#${message.channel.id}> foi **bloqueado para novas mensagens**.\\n\\nA conversa fica em pausa por enquanto, mas a equipe ainda pode organizar tudo com carinho. 🌸`
      )] };
      if (notice) return notice.edit(payload);
      return message.channel.send(payload);
    } catch (error) {
      console.error("[Yukina Ylock]", error);
      const payload = { embeds: [createEmbed("💧 Não consegui fechar o canal", "Não consegui alterar as permissões. Verifique se a Yukina tem **Gerenciar canais** e **Gerenciar cargos** e se o cargo dela está configurado corretamente.", 0xEFA6B8)] };
      if (notice) return notice.edit(payload).catch(() => null);
      return message.channel.send(payload).catch(() => null);
    }
  },
};
