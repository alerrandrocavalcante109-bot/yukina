const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const welcomeSystem = require("../welcome-system");

const BLUE = 0xA7D8F0;
const EVENT_NAMES = { welcome: "Boas-vindas", goodbye: "Despedidas" };
function eventKey(value) { return value === "despedida" || value === "goodbye" ? "goodbye" : "welcome"; }
function isManager(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}
function buildStatus(guild, config) {
  const embed = new EmbedBuilder()
    .setColor(BLUE)
    .setAuthor({ name: "Yukina · Frases e Textos", iconURL: guild.client.user.displayAvatarURL() })
    .setTitle("❄️ Boas-vindas e despedidas")
    .setDescription("Configurações de mensagens deste servidor.")
    .addFields(
      { name: "🌸 Boas-vindas", value: statusLine(guild, config.welcome), inline: false },
      { name: "🌙 Despedidas", value: statusLine(guild, config.goodbye), inline: false },
    )
    .setFooter({ text: "Yukina · Sob o luar, entre estrelas" })
    .setTimestamp();
  return embed;
}
function statusLine(guild, config) {
  if (!config?.enabled) return "🔴 Desativado";
  return "🟢 Ativado\nCanal: " + (guild.channels.cache.get(config.channelId)?.toString() || "canal não encontrado") +
    "\nTítulo: " + (config.title || "Padrão");
}
function helpText() {
  return [
    "**❄️ Yukina · Boas-vindas e Despedidas**",
    "`/boasvindas configurar` — configurar um evento.",
    "`/boasvindas testar` — enviar uma prévia neste canal.",
    "`/boasvindas status` — ver o estado dos dois eventos.",
    "`/boasvindas desativar` — desligar um evento.",
    "",
    "**Variáveis disponíveis:** `{user}`, `{username}`, `{mention}`, `{server}`, `{memberCount}`.",
    "Exemplo: Seja bem-vindo(a), {mention}, à comunidade {server}!",
  ].join("\n");
}
async function runAction({ guild, member, channel, action, event, targetChannel, title, message, color, reply }) {
  if (!guild) return reply({ content: "❄️ Este comando só pode ser usado dentro de um servidor.", ephemeral: true });
  if (!isManager(member)) return reply({ content: "🫧 Você precisa de **Gerenciar servidor** ou **Administrador** para alterar estas configurações.", ephemeral: true });
  await welcomeSystem.initialize();
  const config = structuredClone(welcomeSystem.getConfig(guild.id));
  const key = eventKey(event);
  if (action === "configurar") {
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      return reply({ content: "Escolha um canal de texto válido.", ephemeral: true });
    }
    const botMember = guild.members.me;
    const perms = targetChannel.permissionsFor(botMember);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return reply({ content: "Preciso de **Ver canal**, **Enviar mensagens** e **Inserir links** no canal escolhido.", ephemeral: true });
    }
    const colorValue = color || "#A7D8F0";
    if (!/^#[0-9a-f]{6}$/i.test(colorValue)) return reply({ content: "A cor deve estar em HEX, por exemplo `#A7D8F0`.", ephemeral: true });
    config[key] = { enabled: true, channelId: targetChannel.id, title: title || (key === "welcome" ? "❄️ Uma nova estrela chegou!" : "🌙 Uma estrela segue viagem"), message, color: colorValue.toUpperCase() };
    await welcomeSystem.setConfig(guild.id, config);
    const preview = welcomeSystem.makeEmbed(config[key], {
      guild,
      id: member.id,
      user: member.user,
      toString: () => "<@" + member.id + ">",
    }, key);
    return reply({ content: "🩵 **" + EVENT_NAMES[key] + " configuradas!** A prévia está abaixo.", embeds: [preview], ephemeral: true });
  }
  if (action === "testar") {
    const selected = config[key];
    if (!selected?.enabled) return reply({ content: "🌙 As mensagens de " + EVENT_NAMES[key].toLowerCase() + " ainda não estão configuradas. Use `/boasvindas configurar` primeiro.", ephemeral: true });
    const preview = welcomeSystem.makeEmbed(selected, {
      guild,
      id: member.id,
      user: member.user,
      toString: () => "<@" + member.id + ">",
    }, key);
    return reply({ content: "✨ Prévia da mensagem (teste privado):", embeds: [preview], ephemeral: true });
  }
  if (action === "status") return reply({ embeds: [buildStatus(guild, config)], ephemeral: true });
  if (action === "desativar") {
    config[key] = { ...(config[key] || {}), enabled: false };
    await welcomeSystem.setConfig(guild.id, config);
    return reply({ content: "🌙 " + EVENT_NAMES[key] + " desativadas. As outras configurações do servidor foram preservadas.", ephemeral: true });
  }
  return reply({ content: helpText(), ephemeral: true });
}

const data = new SlashCommandBuilder()
  .setName("boasvindas")
  .setDescription("Configure os embeds de boas-vindas e despedidas da Yukina")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub.setName("configurar").setDescription("Configura a mensagem de entrada ou saída")
    .addStringOption(o => o.setName("evento").setDescription("Qual mensagem configurar").setRequired(true)
      .addChoices({ name: "Boas-vindas", value: "welcome" }, { name: "Despedidas", value: "goodbye" }))
    .addChannelOption(o => o.setName("canal").setDescription("Canal de texto que receberá o embed").addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(o => o.setName("mensagem").setDescription("Texto do embed; aceita variáveis").setMaxLength(3500).setRequired(true))
    .addStringOption(o => o.setName("titulo").setDescription("Título do embed").setMaxLength(250))
    .addStringOption(o => o.setName("cor").setDescription("Cor HEX, exemplo #A7D8F0").setMaxLength(7)))
  .addSubcommand(sub => sub.setName("testar").setDescription("Pré-visualiza uma mensagem configurada")
    .addStringOption(o => o.setName("evento").setDescription("Qual mensagem testar").setRequired(true)
      .addChoices({ name: "Boas-vindas", value: "welcome" }, { name: "Despedidas", value: "goodbye" })))
  .addSubcommand(sub => sub.setName("status").setDescription("Mostra as configurações de entrada e saída"))
  .addSubcommand(sub => sub.setName("desativar").setDescription("Desativa um dos eventos")
    .addStringOption(o => o.setName("evento").setDescription("Qual evento desativar").setRequired(true)
      .addChoices({ name: "Boas-vindas", value: "welcome" }, { name: "Despedidas", value: "goodbye" })));

async function execute(interaction) {
  const action = interaction.options.getSubcommand();
  const event = action === "status" ? "welcome" : interaction.options.getString("evento");
  await runAction({
    guild: interaction.guild, member: interaction.member, channel: interaction.channel,
    action, event, targetChannel: interaction.options.getChannel("canal"),
    title: interaction.options.getString("titulo"), message: interaction.options.getString("mensagem"),
    color: interaction.options.getString("cor"),
    reply: payload => interaction.reply(payload),
  });
}
async function prefixExecute(message, args) {
  if (!message.guild) return;
  const action = String(args[0] || "ajuda").toLowerCase();
  const event = eventKey(args[1]);
  if (action === "ajuda") return message.reply(helpText());
  if (action === "status") {
    await welcomeSystem.initialize();
    return message.reply({ embeds: [buildStatus(message.guild, welcomeSystem.getConfig(message.guild.id))] });
  }
  if (action === "testar") {
    await welcomeSystem.initialize();
    const config = welcomeSystem.getConfig(message.guild.id);
    if (!config[event]?.enabled) return message.reply("🌙 Este evento ainda não está configurado.");
    const preview = welcomeSystem.makeEmbed(config[event], {
      guild: message.guild, id: message.author.id, user: message.author,
      toString: () => "<@" + message.author.id + ">",
    }, event);
    return message.reply({ content: "✨ Prévia da mensagem:", embeds: [preview] });
  }
  if (action === "desativar") {
    if (!isManager(message.member)) return message.reply("Você precisa de Gerenciar servidor ou Administrador.");
    await welcomeSystem.initialize();
    const config = structuredClone(welcomeSystem.getConfig(message.guild.id));
    config[event] = { ...(config[event] || {}), enabled: false };
    await welcomeSystem.setConfig(message.guild.id, config);
    return message.reply("🌙 " + EVENT_NAMES[event] + " desativadas.");
  }
  return message.reply(helpText() + "\nPara configurar com opções completas, use o comando slash `/boasvindas configurar`.");
}
module.exports = { data, execute, prefixExecute, prefix: "Y" };
