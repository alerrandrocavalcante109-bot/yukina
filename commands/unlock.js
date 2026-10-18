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

async function unlockChannel(channel, guild) {
  // Remove apenas a restrição explícita do @everyone, restaurando a herança de permissões.
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    SendMessages: null,
    SendMessagesInThreads: null,
  }, { reason: "Canal desbloqueado com o comando unlock da Yukina" });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Libera novamente as mensagens neste canal.")
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
        embeds: [createEmbed("❄️ Este canal é diferente", "Posso liberar mensagens em canais de texto e de anúncios.")],
        ephemeral: true,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        embeds: [createEmbed("🔒 Só a equipe pode fazer isso", "Você precisa da permissão **Gerenciar canais** para reabrir este espaço.")],
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
      await unlockChannel(channel, interaction.guild);
      return interaction.reply({
        embeds: [createEmbed(
          "🌸 O cantinho está aberto novamente!",
          `As mensagens foram **liberadas** em ${channel}.\n\nPodem continuar a conversa com carinho e respeito. A Yukina está de olho para manter tudo acolhedor! ✨`
        )],
      });
    } catch (error) {
      console.error("[Yukina /unlock]", error);
      return interaction.reply({
        embeds: [createEmbed("💧 Não consegui reabrir o canal", "Confira as permissões da Yukina e tente novamente.", 0xEFA6B8)],
        ephemeral: true,
      });
    }
  },

  async prefixExecute(message) {
    if (!message.guild || !message.channel) {
      return message.reply({ embeds: [createEmbed("🌸 Um cantinho de cada vez", "Este comando só pode ser usado dentro de um servidor.")] });
    }

    if (!canManage(message.member)) {
      return message.reply({ embeds: [createEmbed("🔒 Só a equipe pode fazer isso", "Você precisa da permissão **Gerenciar canais** para reabrir este espaço.")] });
    }

    if (!isTextChannel(message.channel)) {
      return message.reply({ embeds: [createEmbed("❄️ Este canal é diferente", "Posso liberar mensagens em canais de texto e de anúncios.")] });
    }

    const botMember = message.guild.members.me;
    if (!botMember?.permissionsIn(message.channel).has(PermissionFlagsBits.ManageChannels)) {
      return message.reply({ embeds: [createEmbed("🥺 Preciso de uma ajudinha", "A Yukina precisa da permissão **Gerenciar canais** para cuidar deste espaço.")] });
    }

    try {
      await unlockChannel(message.channel, message.guild);
      return message.reply({
        embeds: [createEmbed(
          "🌸 O cantinho está aberto novamente!",
          `As mensagens foram **liberadas** em <#${message.channel.id}>.\n\nPodem continuar a conversa com carinho e respeito. A Yukina está de olho para manter tudo acolhedor! ✨`
        )],
      });
    } catch (error) {
      console.error("[Yukina Yunlock]", error);
      return message.reply({ embeds: [createEmbed("💧 Não consegui reabrir o canal", "Confira as permissões da Yukina e tente novamente.", 0xEFA6B8)] });
    }
  },
};
