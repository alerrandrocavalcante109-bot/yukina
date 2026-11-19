"use strict";

const {
  SlashCommandBuilder,
  EmbedBuilder,
  UserFlags
} = require("discord.js");

const COLOR = 0xA7D8F0;

function discordDate(date) {
  if (!date || Number.isNaN(new Date(date).getTime())) return "Não disponível";
  const unix = Math.floor(new Date(date).getTime() / 1000);
  return "<t:" + unix + ":F>\n<t:" + unix + ":R>";
}

function statusLabel(presence) {
  if (!presence) return "Não disponível";
  const labels = {
    online: "🟢 Online",
    idle: "🌙 Ausente",
    dnd: "🔴 Não perturbe",
    offline: "⚫ Offline"
  };
  return labels[presence.status] || "Não disponível";
}

function buildUserInfo(user, member, requester) {
  const roles = member
    ? member.roles.cache
        .filter(role => role.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
    : [];
  const roleText = roles.size
    ? roles.map(role => "<@&" + role.id + ">").join(", ").slice(0, 1000)
    : "Nenhum cargo";

  const verifiedBot = user.bot
    ? (user.flags?.has(UserFlags.VerifiedBot) ? "Sim" : "Não")
    : "Não se aplica";

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({
      name: "Yukina · Informações de usuário",
      iconURL: requester.displayAvatarURL({ size: 128 })
    })
    .setTitle((user.globalName || user.username).slice(0, 256))
    .setDescription(
      "**Nome de usuário:** @" + user.username +
      "\n**Apelido no servidor:** " + (member?.nickname || "Nenhum") +
      "\n**Menção:** <@" + user.id + ">"
    )
    .addFields(
      { name: "🆔 ID do usuário", value: "`" + user.id + "`", inline: false },
      { name: "🤖 Tipo de conta", value: user.bot ? "Bot" : "Pessoa", inline: true },
      { name: "☑️ Bot verificado", value: verifiedBot, inline: true },
      { name: "📅 Conta criada", value: discordDate(user.createdAt), inline: false },
      { name: "🏠 Entrada no servidor", value: discordDate(member?.joinedAt), inline: false },
      { name: "🕒 Status", value: statusLabel(member?.presence), inline: true },
      { name: "🎭 Quantidade de cargos", value: String(roles.size), inline: true },
      { name: "👑 Cargo mais alto", value: member?.roles?.highest?.id === member?.guild?.id
        ? "Nenhum"
        : (member?.roles?.highest ? member.roles.highest.toString() : "Não disponível"), inline: false },
      { name: "🚀 Impulsionando o servidor", value: member?.premiumSince
        ? "Sim · desde " + discordDate(member.premiumSince)
        : (member ? "Não" : "Não disponível"), inline: false },
      { name: "📌 Cargos", value: roleText, inline: false }
    )
    .setFooter({ text: "Yukina · Informações públicas disponibilizadas pelo Discord" })
    .setTimestamp();

  const avatar = user.displayAvatarURL({ size: 1024 });
  if (avatar) embed.setThumbnail(avatar);

  const banner = user.bannerURL({ size: 1024 });
  if (banner) embed.setImage(banner);

  return embed;
}

async function showUserInfo(source, targetUser) {
  const guild = source.guild;
  if (!guild) {
    const payload = { content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true };
    return source.reply(payload);
  }

  try {
    const user = await targetUser.fetch(true).catch(() => targetUser);
    const member = await guild.members.fetch({ user: user.id, force: true }).catch(() => null);
    const embed = buildUserInfo(user, member, source.user || source.author);
    return source.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Yukina /usuario informações]", error);
    const payload = {
      content: "💧 Não consegui obter as informações desse usuário. Tente novamente.",
      ephemeral: true
    };
    if (source.deferred || source.replied) return source.followUp(payload).catch(() => {});
    return source.reply(payload).catch(() => {});
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("usuario")
    .setDescription("Consulte informações de um usuário.")
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand
        .setName("informações")
        .setDescription("Mostra as informações da conta e do membro.")
        .addUserOption(option =>
          option
            .setName("usuário")
            .setDescription("Usuário que deseja consultar.")
            .setRequired(true)
        )
    ),

  aliases: ["userinfo", "infousar"],

  async execute(interaction) {
    if (interaction.options.getSubcommand() !== "informações") return;
    const targetUser = interaction.options.getUser("usuário", true);
    return showUserInfo(interaction, targetUser);
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    const mention = message.mentions.users.first();
    const rawId = args.find(value => /^\d{17,20}$/.test(String(value)));
    const targetUser = mention || (rawId
      ? await message.client.users.fetch(rawId).catch(() => null)
      : null);
    if (!targetUser) {
      return message.reply("🌸 Use Yusuario informações @usuário ou informe o ID de um usuário.");
    }
    return showUserInfo({
      guild: message.guild,
      user: message.author,
      author: message.author,
      reply: payload => message.reply(payload),
      followUp: payload => message.reply(payload),
      deferred: false,
      replied: false
    }, targetUser);
  }
};
