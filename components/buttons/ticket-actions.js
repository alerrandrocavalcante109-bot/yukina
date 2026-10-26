"use strict";
const { PermissionFlagsBits, EmbedBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const storage = require("../../system-storage").forSystem("support-tickets");
async function isStaff(interaction, config) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  return Boolean(config.staffRoleId && interaction.member?.roles?.cache?.has(config.staffRoleId));
}
async function makeTranscript(channel, ticket) {
  const messages = []; let before;
  for (let page = 0; page < 20; page++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
    if (!batch?.size) break;
    messages.push(...batch.values()); before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = ["YUKINA — TRANSCRIÇÃO DE TICKET", "Ticket: #" + ticket.ticketId, "Servidor: " + channel.guild.name + " (" + channel.guild.id + ")", "Canal: " + channel.name + " (" + channel.id + ")", "Solicitante: " + ticket.username + " (" + ticket.userId + ")", "Categoria: " + ticket.typeLabel, "Aberto em: " + new Date(ticket.createdAt).toISOString(), "Encerrado em: " + new Date().toISOString(), "", ...messages.map(m => "[" + new Date(m.createdTimestamp).toISOString() + "] " + (m.author?.tag || m.author?.username || "Desconhecido") + ": " + (m.content || "[sem texto]") + (m.attachments?.size ? " | Anexos: " + [...m.attachments.values()].map(a => a.url).join(", ") : "") + (m.embeds?.length ? " | Embeds: " + m.embeds.length : ""))];
  return Buffer.from(lines.join("\n"), "utf8");
}
module.exports = {
  customId: /^yukina:ticket:(claim|close):(\d+)$/,
  async execute(interaction) {
    const match = interaction.customId.match(/^yukina:ticket:(claim|close):(\d+)$/);
    if (!match || !interaction.guild || !interaction.channel) return;
    const action = match[1], id = Number(match[2]), guild = interaction.guild;
    const config = await storage.get(guild.id, "config", {}), ticket = await storage.get(guild.id, "ticket:" + id, null);
    if (!ticket || ticket.channelId !== interaction.channel.id || ticket.status !== "open") return interaction.reply({ content: "❄️ Este ticket já foi encerrado ou não está mais ativo.", flags: MessageFlags.Ephemeral });
    if (action === "claim") {
      if (!await isStaff(interaction, config)) return interaction.reply({ content: "🫧 Apenas a equipe de atendimento pode assumir este ticket.", flags: MessageFlags.Ephemeral });
      if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) return interaction.reply({ content: "🌙 Este atendimento já está com <@" + ticket.claimedBy + ">.", flags: MessageFlags.Ephemeral });
      ticket.claimedBy = interaction.user.id; ticket.claimedAt = Date.now(); await storage.set(guild.id, "ticket:" + id, ticket);
      await interaction.reply({ content: "🙋 Atendimento assumido por <@" + interaction.user.id + ">.", flags: MessageFlags.Ephemeral });
      return interaction.channel.send({ content: "🌸 <@" + interaction.user.id + "> assumiu este atendimento. Vamos resolver isso juntos!", allowedMentions: { users: [interaction.user.id] } });
    }
    const staff = await isStaff(interaction, config);
    if (interaction.user.id !== ticket.userId && !staff) return interaction.reply({ content: "🫧 Somente quem abriu o ticket ou a equipe autorizada pode encerrá-lo.", flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    ticket.status = "closed"; ticket.closedAt = Date.now(); ticket.closedBy = interaction.user.id;
    await storage.set(guild.id, "ticket:" + id, ticket);
    try {
      const transcript = await makeTranscript(interaction.channel, ticket);
      const logChannel = config.logChannelId && (guild.channels.cache.get(config.logChannelId) || await guild.channels.fetch(config.logChannelId).catch(() => null));
      if (logChannel?.isTextBased()) {
        const embed = new EmbedBuilder().setColor(0xA7D8F0).setTitle("📜 Ticket encerrado · #" + id).setDescription("O atendimento foi encerrado e sua transcrição está anexada.")
          .addFields({ name: "Solicitante", value: "<@" + ticket.userId + "> (" + ticket.username + ")", inline: true }, { name: "Encerrado por", value: "<@" + interaction.user.id + ">", inline: true }, { name: "Categoria", value: ticket.typeLabel, inline: true }, { name: "Responsável", value: ticket.claimedBy ? "<@" + ticket.claimedBy + ">" : "Não atribuído", inline: true }).setTimestamp();
        await logChannel.send({ embeds: [embed], files: [new AttachmentBuilder(transcript, { name: "ticket-" + id + "-transcricao.txt" })], allowedMentions: { parse: [] } });
      }
      await interaction.editReply("🔒 Ticket encerrado. A transcrição foi enviada ao canal privado de registros quando disponível.");
      await interaction.channel.delete("Ticket #" + id + " encerrado por " + interaction.user.id);
    } catch (error) {
      console.error("[Tickets] Falha ao encerrar ticket:", error);
      await interaction.editReply("🫧 O ticket foi marcado como encerrado, mas houve um problema ao gerar a transcrição. Avise a equipe antes de apagar manualmente o canal.");
    }
  }
};
