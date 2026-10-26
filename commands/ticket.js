"use strict";
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const storage = require("../system-storage").forSystem("support-tickets");
const CATEGORY_NAME = "🎫・suporte・tickets";
const LOG_NAME = "📜・registro-tickets";
const COLOR = 0xA7D8F0;
async function ensureCategory(guild) {
  let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME);
  if (!category) category = await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory, reason: "Categoria do sistema Suporte & Tickets da Yukina" });
  return category;
}
async function ensureLogChannel(guild, category, staffRoleId) {
  let channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === LOG_NAME);
  if (channel) {
    if (channel.parentId !== category.id) await channel.setParent(category.id, { lockPermissions: false }).catch(() => {});
    await channel.permissionOverwrites.edit(guild.id, { ViewChannel: false }).catch(() => {});
    await channel.permissionOverwrites.edit(guild.client.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true, ManageChannels: true }).catch(() => {});
    if (staffRoleId && guild.roles.cache.has(staffRoleId)) await channel.permissionOverwrites.edit(staffRoleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }).catch(() => {});
    return channel;
  }
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] }
  ];
  if (staffRoleId && guild.roles.cache.has(staffRoleId)) overwrites.push({ id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] });
  return guild.channels.create({ name: LOG_NAME, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: overwrites, topic: "Registro privado de encerramentos e transcrições dos tickets da Yukina.", reason: "Canal privado de registros do sistema de tickets" });
}
function panelPayload() {
  const embed = new EmbedBuilder().setColor(COLOR).setAuthor({ name: "Yukina · Suporte & Tickets" }).setTitle("❄️ Um refúgio para sua solicitação")
    .setDescription(["Olá! Sou a Yukina. 🌙", "Escolha abaixo o assunto do seu atendimento e abrirei um canal privado para você conversar com a equipe.", "", "🎫 **Suporte** — dúvidas e ajuda geral.", "🛡️ **Denúncia** — informe um problema à equipe.", "🌸 **Parcerias** — propostas e colaborações.", "💬 **Outros assuntos** — solicitações variadas.", "", "୨୧ Por segurança, não envie senhas, tokens ou dados de pagamento sensíveis."].join("\n"))
    .setFooter({ text: "Yukina · Sob o luar, sua voz será ouvida." });
  const menu = new StringSelectMenuBuilder().setCustomId("yukina:ticket:open").setPlaceholder("Selecione o tipo de atendimento…").addOptions(
    { label: "Suporte", description: "Dúvidas e ajuda geral", value: "suporte", emoji: "🎫" },
    { label: "Denúncia", description: "Relatar um problema à equipe", value: "denuncia", emoji: "🛡️" },
    { label: "Parcerias", description: "Propostas e colaborações", value: "parcerias", emoji: "🌸" },
    { label: "Outros assuntos", description: "Outras solicitações", value: "outros", emoji: "💬" }
  );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], allowedMentions: { parse: [] } };
}
module.exports = {
  data: new SlashCommandBuilder().setName("ticket").setDescription("Gerencia o sistema de Suporte & Tickets da Yukina.").setDMPermission(false)
    .addSubcommand(s => s.setName("painel").setDescription("Cria a categoria e publica o painel neste canal."))
    .addSubcommand(s => s.setName("cargo").setDescription("Define o cargo existente que atenderá os tickets.").addRoleOption(o => o.setName("cargo").setDescription("Cargo de suporte já existente.").setRequired(true))),
  name: "ticket", aliases: ["tickets", "suporte"],
  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: "❄️ Use este comando dentro de um servidor.", flags: MessageFlags.Ephemeral });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: "🫧 Somente quem pode gerenciar o servidor pode configurar os tickets.", flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const config = await storage.get(interaction.guild.id, "config", {});
      if (sub === "cargo") {
        const role = interaction.options.getRole("cargo", true);
        if (role.managed || role.id === interaction.guild.id) return interaction.editReply("❄️ Escolha um cargo comum já existente no servidor.");
        config.staffRoleId = role.id; await storage.set(interaction.guild.id, "config", config);
        return interaction.editReply("🌸 Cargo de atendimento salvo: <@&" + role.id + ">. A Yukina não criou nem alterou nenhum cargo.");
      }
      const category = await ensureCategory(interaction.guild);
      const logChannel = await ensureLogChannel(interaction.guild, category, config.staffRoleId);
      config.categoryId = category.id; config.logChannelId = logChannel.id;
      await storage.set(interaction.guild.id, "config", config);
      await interaction.channel.send(panelPayload());
      return interaction.editReply("❄️ Painel publicado neste canal. Categoria: <#" + category.id + "> · Registros privados: <#" + logChannel.id + ">." + (config.staffRoleId ? "" : "\n\n⚠️ Configure o cargo de atendimento com /ticket cargo para que a equipe tenha acesso aos tickets."));
    } catch (error) {
      console.error("[Tickets] Falha ao configurar painel:", error);
      return interaction.editReply("🫧 Não consegui configurar os tickets. Confira se a Yukina tem permissão para gerenciar canais e enviar mensagens.");
    }
  },
  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Use este comando dentro de um servidor.");
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply("🫧 Você precisa da permissão Gerenciar Servidor.");
    const action = String(args[0] || "painel").toLowerCase(), config = await storage.get(message.guild.id, "config", {});
    if (action === "cargo") {
      const role = message.mentions.roles.first();
      if (!role) return message.reply("🌸 Use Yticket cargo @Cargo para escolher um cargo existente.");
      config.staffRoleId = role.id; await storage.set(message.guild.id, "config", config);
      return message.reply("❄️ Cargo de atendimento salvo: <@&" + role.id + ">. Nenhum cargo foi criado.");
    }
    if (action !== "painel") return message.reply("Use Yticket painel ou Yticket cargo @Cargo.");
    try {
      const category = await ensureCategory(message.guild), logChannel = await ensureLogChannel(message.guild, category, config.staffRoleId);
      config.categoryId = category.id; config.logChannelId = logChannel.id; await storage.set(message.guild.id, "config", config);
      await message.channel.send(panelPayload()); return message.reply("❄️ Painel de Suporte & Tickets publicado.");
    } catch (error) { console.error("[Tickets] Falha ao configurar painel:", error); return message.reply("🫧 Não consegui configurar os tickets. Confira minhas permissões."); }
  }
};
