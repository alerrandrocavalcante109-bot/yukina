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
  return Boolean(overwrite?.deny.has(PermissionFlagsBits.SendMessages) ||
    overwrite?.deny.has(PermissionFlagsBits.SendMessagesInThreads));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Desbloqueia um canal e libera novas mensagens.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option => option.setName("canal")
      .setDescription("Escolha o canal que a Yukina deve desbloquear.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ embeds: [createEmbed("🌸 Um cantinho de cada vez", "Este comando só pode ser usado dentro de um servidor.")], ephemeral: true });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ embeds: [createEmbed("🔒 Só a equipe pode fazer isso", "Você precisa da permissão **Gerenciar canais** para reabrir este espaço.")], ephemeral: true });
    }

    const channel = interaction.options.getChannel("canal", true);
    if (!isTextChannel(channel) || channel.guildId !== interaction.guild.id) {
      return interaction.reply({ embeds: [createEmbed("❄️ Este canal é diferente", "Escolha um canal de texto ou de anúncios deste servidor.")], ephemeral: true });
    }
    if (!isLocked(channel, interaction.guild)) {
      return interaction.reply({ embeds: [createEmbed("🌸 Este cantinho já está desbloqueado!", "O canal " + channel + " **já está aberto** para novas mensagens. Está tudo certinho! ✨")], ephemeral: true });
    }

    const botMember = interaction.guild.members.me;
    if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ embeds: [createEmbed("🥺 Preciso de uma ajudinha", "A Yukina precisa da permissão **Gerenciar canais** para cuidar deste espaço.", YUKINA_PINK)], ephemeral: true });
    }

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null, SendMessagesInThreads: null,
      }, { reason: "Canal desbloqueado com /unlock da Yukina" });
      return interaction.reply({ embeds: [createEmbed("🌸 O cantinho está aberto novamente!",
        "As mensagens foram **liberadas** em " + channel + ".\n\nPodem continuar a conversa com carinho e respeito. A Yukina está de olho para manter tudo acolhedor! ✨")] });
    } catch (error) {
      console.error("[Yukina /unlock]", error);
      return interaction.reply({ embeds: [createEmbed("💧 Não consegui reabrir o canal", "Confira as permissões da Yukina e tente novamente.", YUKINA_PINK)], ephemeral: true });
    }
  },
};
