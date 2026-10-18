const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require("discord.js");
const logSystem = require("../log-system");

const BLUE = 0xA7D8F0;
const CATEGORIES = {
  punicoes: "Punições",
  mensagens: "Mensagens apagadas/editadas",
  perfil: "Perfil",
  nick: "Nicknames",
  todos: "Todos os registros",
};
function response(title, description, color = BLUE) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setFooter({ text: "Yukina · Cuidando deste cantinho" }).setTimestamp();
}
function canManage(memberOrPermissions) {
  const permissions = memberOrPermissions?.permissions || memberOrPermissions;
  return Boolean(permissions?.has(PermissionFlagsBits.ManageGuild) || permissions?.has(PermissionFlagsBits.Administrator));
}
function configure(guild, channel, category, enabled) {
  const previous = logSystem.getConfig(guild.id) || { enabled: false, categories: {} };
  const categories = { punicoes: false, mensagens: false, perfil: false, nick: false, ...(previous.categories || {}) };
  if (category === "todos") {
    if (enabled && previous.enabled && Object.values(categories).every(Boolean)) {
      return { title: "🌸 Os registros já estão ativos", description: "Todas as categorias já estão ativadas" + (previous.channelId ? " no canal <#" + previous.channelId + ">." : ".") };
    }
    if (!enabled && (!previous.enabled || !Object.values(categories).some(Boolean))) {
      return { title: "🌸 Os registros já estão desativados", description: "Nenhuma alteração foi necessária." };
    }
    for (const key of Object.keys(categories)) categories[key] = enabled;
  } else {
    if (categories[category] === enabled && previous.enabled) {
      return { title: enabled ? "🌸 Esta categoria já está ativa" : "🌸 Esta categoria já está desativada", description: "**" + CATEGORIES[category] + "** já está " + (enabled ? "ativa" : "desativada") + (previous.channelId ? " no canal <#" + previous.channelId + ">." : ".") };
    }
    categories[category] = enabled;
  }
  const anyEnabled = Object.values(categories).some(Boolean);
  const channelId = enabled ? channel.id : (previous.channelId || channel?.id);
  logSystem.setConfig(guild.id, { enabled: anyEnabled, channelId, categories });
  if (!anyEnabled) return { title: "🌙 Registros desativados", description: "Todas as categorias estão desativadas." };
  return {
    title: enabled ? "❄️ Registros atualizados!" : "🌙 Categoria desativada",
    description: (category === "todos" ? (enabled ? "Todos os registros foram ativados." : "Todos os registros foram desativados.") : "**" + CATEGORIES[category] + "** foi " + (enabled ? "ativada" : "desativada") + ".") +
      "\n\n**Canal:** <#" + channelId + ">\n**Punições:** " + (categories.punicoes ? "Ativo" : "Desativado") +
      "\n**Mensagens apagadas/editadas:** " + (categories.mensagens ? "Ativo" : "Desativado") +
      "\n**Perfil:** " + (categories.perfil ? "Ativo" : "Desativado") +
      "\n**Nicknames:** " + (categories.nick ? "Ativo" : "Desativado"),
  };
}
function categoryChoices(option) {
  return option.addChoices(
    { name: "Todos os registros", value: "todos" },
    { name: "Punições", value: "punicoes" },
    { name: "Mensagens apagadas/editadas", value: "mensagens" },
    { name: "Perfil (nome e avatar)", value: "perfil" },
    { name: "Nicknames", value: "nick" },
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription("Ativa ou desativa categorias de registros do servidor.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(option => option.setName("ativar").setDescription("True para ativar ou false para desativar.").setRequired(true))
    .addStringOption(option => categoryChoices(option.setName("categoria").setDescription("Qual categoria deseja configurar.").setRequired(false)))
    .addChannelOption(option => option.setName("canal").setDescription("Canal de registros (ao ativar).").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true });
    if (!canManage(interaction.memberPermissions)) return interaction.reply({ content: "🔒 Você precisa de Gerenciar servidor ou Administrador.", ephemeral: true });
    const enabled = interaction.options.getBoolean("ativar", true);
    const category = interaction.options.getString("categoria") || "todos";
    const channel = interaction.options.getChannel("canal") || interaction.channel;
    if (enabled) {
      if (!channel?.isTextBased() || typeof channel.send !== "function") return interaction.reply({ content: "📝 Escolha um canal de texto para receber os registros.", ephemeral: true });
      const permissions = interaction.guild.members.me?.permissionsIn(channel);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.EmbedLinks)) {
        return interaction.reply({ content: "🥺 Preciso de Ver canal, Enviar mensagens e Incorporar links no canal de registros.", ephemeral: true });
      }
    }
    const result = configure(interaction.guild, channel, category, enabled);
    return interaction.reply({ embeds: [response(result.title, result.description)], ephemeral: true });
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    if (!canManage(message.member)) return message.reply("🔒 Você precisa de Gerenciar servidor ou Administrador.");
    const first = String(args[0] || "").toLowerCase();
    const validStates = ["true", "false", "on", "off", "ativar", "desativar"];
    let category = "todos";
    let state = first;
    if (Object.hasOwn(CATEGORIES, first) && first !== "todos") {
      category = first;
      state = String(args[1] || "").toLowerCase();
    }
    if (!validStates.includes(state)) {
      return message.reply("📝 Use **Ylog true** para ativar tudo, ou **Ylog punicoes true**, **Ylog mensagens true**, **Ylog perfil true** ou **Ylog nick true**. Use **false** para desativar.");
    }
    const enabled = ["true", "on", "ativar"].includes(state);
    if (enabled) {
      const permissions = message.guild.members.me?.permissionsIn(message.channel);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.EmbedLinks)) {
        return message.reply("🥺 Preciso de Ver canal, Enviar mensagens e Incorporar links neste canal.");
      }
    }
    const result = configure(message.guild, message.channel, category, enabled);
    return message.channel.send({ embeds: [response(result.title, result.description)], allowedMentions: { parse: [] } });
  },
};
