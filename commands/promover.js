const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const PROMOTION_ROLE_IDS = (process.env.PROMOTION_ROLE_IDS || "")
  .split(",").map((id) => id.trim()).filter(Boolean);
const PROMOTION_CHANNEL_ID = (process.env.PROMOTION_CHANNEL_ID || "").trim();
const PROMOTION_CHANNEL_NAME = (process.env.PROMOTION_CHANNEL_NAME || "📈・promoções-da-equipe").trim();
const PROMOTION_NOTIFY_ROLE_ID = (process.env.PROMOTION_NOTIFY_ROLE_ID || "").trim();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("promover")
    .setDescription("Promove um membro da equipe e registra a mudança.")
    .setDMPermission(false)
    .addUserOption((option) => option.setName("usuario").setDescription("Pessoa que será promovida").setRequired(true))
    .addRoleOption((option) => option.setName("cargo").setDescription("Novo cargo da pessoa").setRequired(true))
    .addStringOption((option) => option.setName("motivo").setDescription("Motivo da promoção").setRequired(true).setMaxLength(700))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ content: "❄️ Este comando só pode ser usado dentro de um servidor.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
    const targetUser = interaction.options.getUser("usuario", true);
    const targetRole = interaction.options.getRole("cargo", true);
    const reason = interaction.options.getString("motivo", true).trim();
    const botMember = guild.members.me || await guild.members.fetchMe();

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles) &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply("🫧 Você precisa da permissão **Gerenciar cargos** para promover alguém.");
    }
    if (!actor) return interaction.editReply("🌙 Não consegui confirmar suas permissões no servidor.");
    const notifyRoleName = (process.env.PROMOTION_NOTIFY_ROLE_NAME || "📣・Avisos de promoção").trim();
    const notifyRole = (PROMOTION_NOTIFY_ROLE_ID
      ? await guild.roles.fetch(PROMOTION_NOTIFY_ROLE_ID).catch(() => null)
      : null) || guild.roles.cache.find((role) => role.name === notifyRoleName);

    if (!notifyRole) {
      return interaction.editReply("⚙️ Não encontrei o cargo de notificação. Reinicie a Yukina com a permissão **Gerenciar cargos** ou crie o cargo **" + notifyRoleName + "**.");
    }
    if (targetRole.id === guild.id || targetRole.managed) {
      return interaction.editReply("❄️ Esse cargo é protegido ou gerenciado por uma integração e não pode ser atribuído por este comando.");
    }
    if (targetRole.position >= botMember.roles.highest.position) {
      return interaction.editReply("🛡️ Meu cargo mais alto precisa ficar acima do cargo que você quer atribuir.");
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) return interaction.editReply("🌙 Não consegui encontrar esse membro no servidor.");
    if (targetMember.id === interaction.user.id) return interaction.editReply("🌸 Você não pode usar este comando para se promover.");
    if (targetMember.id === guild.ownerId) return interaction.editReply("👑 O proprietário do servidor não precisa receber cargos por este comando.");
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      return interaction.editReply("🛡️ Não posso alterar os cargos desse membro porque a hierarquia dele está no mesmo nível ou acima da Yukina.");
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
        actor.roles.highest.position <= targetRole.position) {
      return interaction.editReply("🛡️ Seu cargo mais alto precisa estar acima do cargo que você quer atribuir.");
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
        targetMember.roles.highest.position >= actor.roles.highest.position) {
      return interaction.editReply("🛡️ Você não pode promover alguém cujo cargo mais alto esteja no mesmo nível ou acima do seu.");
    }

    let ladder = [];
    if (PROMOTION_ROLE_IDS.length) {
      ladder = PROMOTION_ROLE_IDS.map((id) => guild.roles.cache.get(id)).filter(Boolean);
      if (!ladder.some((role) => role.id === targetRole.id)) {
        return interaction.editReply("📋 O cargo escolhido não está na lista PROMOTION_ROLE_IDS. Inclua nela os cargos da carreira administrativa, do menor para o maior.");
      }
      const targetRank = ladder.findIndex((role) => role.id === targetRole.id);
      const currentRanks = targetMember.roles.cache
        .map((role) => ladder.findIndex((item) => item.id === role.id)).filter((rank) => rank >= 0);
      const currentRank = currentRanks.length ? Math.max(...currentRanks) : -1;
      if (targetRank <= currentRank) {
        return interaction.editReply("🌱 Isso não é uma promoção: o membro já possui um cargo da carreira igual ou superior ao escolhido.");
      }
    }

    const promotionChannel = PROMOTION_CHANNEL_ID
      ? await guild.channels.fetch(PROMOTION_CHANNEL_ID).catch(() => null)
      : guild.channels.cache.find((channel) => channel.name === PROMOTION_CHANNEL_NAME &&
          channel.isTextBased() && typeof channel.send === "function");
    if (!promotionChannel || !promotionChannel.isTextBased() || typeof promotionChannel.send !== "function") {
      return interaction.editReply("📣 Não encontrei o canal de promoções. Configure PROMOTION_CHANNEL_ID ou crie o canal #" + PROMOTION_CHANNEL_NAME + ".");
    }

    const addedRole = await targetMember.roles.add(targetRole, "Promoção por " + interaction.user.tag + ": " + reason)
      .then(() => true).catch((error) => {
        console.error("[Promover] Falha ao atribuir cargo:", error);
        return false;
      });
    if (!addedRole) return interaction.editReply("❄️ Não consegui atribuir o cargo. Confira as permissões e a hierarquia da Yukina.");

    const removedRoles = [];
    if (ladder.length) {
      const targetRank = ladder.findIndex((role) => role.id === targetRole.id);
      const previousCareerRoles = targetMember.roles.cache.filter((role) => {
        const rank = ladder.findIndex((item) => item.id === role.id);
        return rank >= 0 && rank < targetRank && role.id !== targetRole.id;
      });
      for (const role of previousCareerRoles.values()) {
        const removed = await targetMember.roles.remove(role, "Substituído por um cargo superior na carreira administrativa da Yukina")
          .then(() => true).catch((error) => {
            console.error("[Promover] Falha ao remover cargo anterior:", error);
            return false;
          });
        if (removed) removedRoles.push(role.name);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(targetRole.color || 0xA7D8F0)
      .setTitle("🌸 Uma nova estrela ascende na Yukina!")
      .setDescription("Parabéns <@" + targetUser.id + "> pela promoção!")
      .addFields(
        { name: "❄️ Novo cargo", value: "<@&" + targetRole.id + ">", inline: true },
        { name: "📝 Motivo", value: reason.slice(0, 1024), inline: false },
        { name: "👑 Promovido por", value: "<@" + interaction.user.id + ">", inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "Yukina · Carreira administrativa" });
    if (removedRoles.length) {
      embed.addFields({ name: "📈 Cargo anterior substituído", value: removedRoles.join(", ").slice(0, 1024), inline: false });
    }

    try {
      await promotionChannel.send({
        content: "<@&" + notifyRole.id + "> Uma promoção foi registrada na equipe da Yukina! Parabenizem <@" + targetUser.id + "> pela nova etapa. 🌙",
        embeds: [embed],
        allowedMentions: { parse: [], users: [targetUser.id, interaction.user.id], roles: [notifyRole.id] }
      });
    } catch (error) {
      console.error("[Promover] Cargo atribuído, mas o anúncio falhou:", error);
      return interaction.editReply("⚠️ Atribuí " + targetRole + " a <@" + targetUser.id + ">, mas não consegui publicar o anúncio em " + promotionChannel + ". Confira as permissões de envio de mensagens e embeds.");
    }

    return interaction.editReply("✅ Promoção concluída! <@" + targetUser.id + "> recebeu " + targetRole + ". O anúncio foi enviado em " + promotionChannel + " e marcou " + notifyRole + ".");
  }
  ,

  async prefixExecute(message, args, client) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    const member = message.member;
    if (!member.permissions.has(PermissionFlagsBits.ManageRoles) &&
        !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("🫧 Você precisa da permissão **Gerenciar cargos** para promover alguém.");
    }

    const userMatch = args.join(" ").match(/<@!?(\d+)>/);
    const roleMatch = args.join(" ").match(/<@&(\d+)>/);
    if (!userMatch || !roleMatch) {
      return message.reply("🌙 Use: `Ypromover @membro @cargo motivo da promoção` (também funciona com `ypromover`).");
    }
    const guild = message.guild;
    const targetMember = await guild.members.fetch(userMatch[1]).catch(() => null);
    const targetRole = await guild.roles.fetch(roleMatch[1]).catch(() => null);
    const reason = args.join(" ").replace(/<@!?\d+>/g, "").replace(/<@&\d+>/g, "").trim();
    if (!targetMember) return message.reply("🌙 Não consegui encontrar esse membro no servidor.");
    if (!targetRole) return message.reply("🌙 Não consegui encontrar esse cargo no servidor.");
    if (!reason) return message.reply("📝 Informe o motivo. Exemplo: `Ypromover @membro @cargo ótimo trabalho`.");
    if (targetMember.id === message.author.id) return message.reply("🌸 Você não pode usar este comando para se promover.");
    if (targetMember.id === guild.ownerId) return message.reply("👑 O proprietário do servidor não pode ser promovido por este comando.");

    const botMember = guild.members.me || await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply("⚙️ Preciso da permissão **Gerenciar cargos**.");
    }
    if (targetRole.id === guild.id || targetRole.managed ||
        targetRole.position >= botMember.roles.highest.position) {
      return message.reply("🛡️ O cargo é protegido ou está acima da hierarquia da Yukina.");
    }
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      return message.reply("🛡️ O cargo mais alto desse membro está no mesmo nível ou acima da Yukina.");
    }
    if (!member.permissions.has(PermissionFlagsBits.Administrator) &&
        (member.roles.highest.position <= targetRole.position ||
         targetMember.roles.highest.position >= member.roles.highest.position)) {
      return message.reply("🛡️ Sua hierarquia precisa estar acima do cargo escolhido e do membro.");
    }

    const notifyRoleName = (process.env.PROMOTION_NOTIFY_ROLE_NAME || "📣・Avisos de promoção").trim();
    const notifyRole = (PROMOTION_NOTIFY_ROLE_ID
      ? await guild.roles.fetch(PROMOTION_NOTIFY_ROLE_ID).catch(() => null)
      : null) || guild.roles.cache.find((role) => role.name === notifyRoleName);
    if (!notifyRole) return message.reply("⚙️ Não encontrei o cargo de avisos de promoção.");

    const channel = PROMOTION_CHANNEL_ID
      ? await guild.channels.fetch(PROMOTION_CHANNEL_ID).catch(() => null)
      : guild.channels.cache.find((item) => item.name === PROMOTION_CHANNEL_NAME &&
          item.isTextBased() && typeof item.send === "function");
    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
      return message.reply("📣 Não encontrei o canal de promoções configurado.");
    }

    try {
      await targetMember.roles.add(targetRole, "Promoção por " + message.author.tag + ": " + reason);
      const embed = new EmbedBuilder()
        .setColor(targetRole.color || 0xA7D8F0)
        .setTitle("🌸 Uma nova estrela ascende na Yukina!")
        .setDescription("Parabéns <@" + targetMember.id + "> pela promoção!")
        .addFields(
          { name: "❄️ Novo cargo", value: "<@&" + targetRole.id + ">", inline: true },
          { name: "📝 Motivo", value: reason.slice(0, 1024), inline: false },
          { name: "👑 Promovido por", value: "<@" + message.author.id + ">", inline: true }
        )
        .setTimestamp()
        .setFooter({ text: "Yukina · Carreira administrativa" });
      await channel.send({
        content: "<@&" + notifyRole.id + "> Uma promoção foi registrada! Parabenizem <@" + targetMember.id + "> pela nova etapa. 🌙",
        embeds: [embed],
        allowedMentions: { parse: [], users: [targetMember.id, message.author.id], roles: [notifyRole.id] }
      });
      return message.reply("✅ Promoção concluída! O anúncio foi publicado em " + channel + ".");
    } catch (error) {
      console.error("[Promover/Prefixo] Falha ao promover:", error);
      return message.reply("⚠️ Não consegui concluir a promoção. Confira permissões, hierarquia e permissões de envio no canal.");
    }
  }

};
