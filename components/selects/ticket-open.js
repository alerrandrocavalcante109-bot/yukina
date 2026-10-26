"use strict";
const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require("discord.js");
const storage = require("../../system-storage").forSystem("support-tickets");
const TYPES = {
  suporte: { label: "Suporte", emoji: "🎫", slug: "suporte", description: "Dúvidas e ajuda geral." },
  denuncia: { label: "Denúncia", emoji: "🛡️", slug: "denuncia", description: "Relato privado para a equipe." },
  parcerias: { label: "Parcerias", emoji: "🌸", slug: "parcerias", description: "Propostas e colaborações." },
  outros: { label: "Outros assuntos", emoji: "💬", slug: "outros", description: "Uma solicitação diferente." }
};
const locks = new Set();
module.exports = {
  customId: "yukina:ticket:open",
  async execute(interaction) {
    if (!interaction.guild || !interaction.isStringSelectMenu()) return;
    const guild = interaction.guild, user = interaction.user, type = TYPES[interaction.values[0]];
    if (!type) return interaction.reply({ content: "🫧 Essa categoria não existe. Escolha uma opção do painel.", flags: MessageFlags.Ephemeral });
    const lockKey = guild.id + ":" + user.id;
    if (locks.has(lockKey)) return interaction.reply({ content: "❄️ Só um instante — já estou preparando seu atendimento.", flags: MessageFlags.Ephemeral });
    locks.add(lockKey); await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const config = await storage.get(guild.id, "config", {});
      if (!config.categoryId) return interaction.editReply("🫧 O painel ainda não foi configurado. Avise a equipe.");
      const records = await storage.list(guild.id, { limit: 2000 });
      const existing = records.find(row => row.key.startsWith("ticket:") && row.value?.userId === user.id && row.value?.status === "open");
      if (existing) {
        const channel = guild.channels.cache.get(existing.value.channelId);
        if (channel) return interaction.editReply("🌙 Você já tem um atendimento aberto: <#" + channel.id + ">.");
        await storage.set(guild.id, existing.key, { ...existing.value, status: "orphaned", closedAt: Date.now() });
      }
      const category = guild.channels.cache.get(config.categoryId) || await guild.channels.fetch(config.categoryId).catch(() => null);
      if (!category || category.type !== ChannelType.GuildCategory) return interaction.editReply("🫧 A categoria não foi encontrada. Um administrador deve executar /ticket painel novamente.");
      const sequence = Number(await storage.get(guild.id, "sequence", 0)) + 1;
      await storage.set(guild.id, "sequence", sequence);
      const channelName = "ticket-" + String(sequence).padStart(4, "0") + "-" + type.slug;
      const overwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] }
      ];
      const role = config.staffRoleId && guild.roles.cache.get(config.staffRoleId);
      if (role) overwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] });
      const channel = await guild.channels.create({ name: channelName, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: overwrites, topic: "Yukina ticket #" + sequence + " | owner:" + user.id + " | type:" + type.slug + " | status:open", reason: "Ticket privado aberto por " + user.id + " (" + type.label + ")" });
      const record = { ticketId: sequence, guildId: guild.id, channelId: channel.id, userId: user.id, username: user.username, type: type.slug, typeLabel: type.label, status: "open", createdAt: Date.now(), claimedBy: null };
      await storage.set(guild.id, "ticket:" + sequence, record);
      const embed = new EmbedBuilder().setColor(0xA7D8F0).setTitle(type.emoji + " Yukina · Atendimento #" + sequence)
        .setDescription(["Olá <@" + user.id + ">! Sua solicitação está em um canal privado.", type.description, "", "**Para agilizar o atendimento:**", "• Explique o que aconteceu com detalhes úteis.", "• Envie imagens ou arquivos relevantes, se necessário.", "• Não compartilhe senhas, tokens ou informações sensíveis.", "", "A equipe responderá assim que possível. Obrigada pela paciência. ❄️"].join("\n"))
        .addFields({ name: "Solicitante", value: "<@" + user.id + ">", inline: true }, { name: "Categoria", value: type.label, inline: true }, { name: "Responsável", value: "Aguardando atendimento", inline: true })
        .setFooter({ text: "Yukina · Registro #" + sequence }).setTimestamp();
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("yukina:ticket:claim:" + sequence).setLabel("Assumir").setEmoji("🙋").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("yukina:ticket:close:" + sequence).setLabel("Encerrar").setEmoji("🔒").setStyle(ButtonStyle.Danger)
      );
      await channel.send({ content: (role ? "<@&" + role.id + "> " : "") + "<@" + user.id + ">", embeds: [embed], components: [buttons], allowedMentions: { users: [user.id], roles: role ? [role.id] : [] } });
      return interaction.editReply("🌸 Seu atendimento foi criado: <#" + channel.id + ">. A Yukina preparou um espaço privado para você.");
    } catch (error) {
      console.error("[Tickets] Falha ao abrir ticket:", error);
      return interaction.editReply("🫧 Não consegui abrir seu ticket. Confira se a Yukina tem permissão para gerenciar canais e tente novamente.");
    } finally { locks.delete(lockKey); }
  }
};
