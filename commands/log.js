const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const logSystem = require("../log-system");

const BLUE = 0xA7D8F0;
function response(title, description, color = BLUE) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setFooter({ text: "Yukina · Cuidando deste cantinho" }).setTimestamp();
}
function canManage(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.ManageGuild) || member?.permissions?.has(PermissionFlagsBits.Administrator));
}
function configure(guild, channel, enabled) {
  if (enabled) {
    logSystem.setConfig(guild.id, { enabled: true, channelId: channel.id });
    return { title: "❄️ Registros ativados!", description: "A Yukina vai registrar neste canal:\n• Punições: banimentos, expulsões, timeouts e alterações de cargos\n• Mensagens apagadas e editadas\n• Perfil: nome global e avatar\n• Nicknames alterados\n\n**Canal de registros:** " + channel + "\n\nPara desativar, use Ylog false ou /log ativar:false." };
  }
  const previous = logSystem.getConfig(guild.id);
  if (!previous?.enabled) return { title: "🌸 Os registros já estão desativados", description: "Nenhuma alteração foi necessária." };
  logSystem.setConfig(guild.id, { ...previous, enabled: false });
  return { title: "🌙 Registros desativados", description: "A Yukina não enviará novos registros até você ativá-los novamente." };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription("Ativa ou desativa os registros do servidor.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(option => option.setName("ativar").setDescription("True para ativar ou false para desativar os registros.").setRequired(true))
    .addChannelOption(option => option.setName("canal").setDescription("Canal onde os registros serão enviados (ao ativar).").setRequired(false)),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true });
    if (!canManage(interaction.memberPermissions)) return interaction.reply({ content: "🔒 Você precisa de Gerenciar servidor ou Administrador.", ephemeral: true });
    const enabled = interaction.options.getBoolean("ativar", true);
    if (!enabled) {
      const result = configure(interaction.guild, interaction.channel, false);
      return interaction.reply({ embeds: [response(result.title, result.description)], ephemeral: true });
    }
    const channel = interaction.options.getChannel("canal") || interaction.channel;
    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      return interaction.reply({ content: "📝 Escolha um canal de texto para receber os registros.", ephemeral: true });
    }
    const botMember = interaction.guild.members.me;
    const permissions = botMember?.permissionsIn(channel);
    if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.EmbedLinks)) {
      return interaction.reply({ content: "🥺 Preciso de Ver canal, Enviar mensagens e Incorporar links no canal de registros.", ephemeral: true });
    }
    const result = configure(interaction.guild, channel, true);
    return interaction.reply({ embeds: [response(result.title, result.description)], ephemeral: true });
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    if (!canManage(message.member)) return message.reply("🔒 Você precisa de Gerenciar servidor ou Administrador.");
    const value = String(args[0] || "").toLowerCase();
    if (!["true", "false", "on", "off", "ativar", "desativar"].includes(value)) {
      return message.reply("📝 Use Ylog true neste canal para ativar os registros, ou Ylog false para desativar.");
    }
    const enabled = ["true", "on", "ativar"].includes(value);
    if (enabled) {
      const botMember = message.guild.members.me;
      const permissions = botMember?.permissionsIn(message.channel);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.EmbedLinks)) {
        return message.reply("🥺 Preciso de Ver canal, Enviar mensagens e Incorporar links neste canal.");
      }
    }
    const result = configure(message.guild, message.channel, enabled);
    return message.channel.send({ embeds: [response(result.title, result.description)], allowedMentions: { parse: [] } });
  },
};
