"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const storage = require("../../system-storage").forSystem("economy");
const notifications = require("../../systems/work-notifications");
const CUSTOM_ID = /^yukina-work-notify:(\d{17,20})$/;
function buildRow(userId, enabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("yukina-work-notify:" + userId)
      .setLabel(enabled ? "Desativar aviso por DM" : "Receber aviso por DM")
      .setEmoji(enabled ? "🔕" : "🔔")
      .setStyle(enabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
  );
}
async function execute(interaction, client) {
  const match = interaction.customId.match(CUSTOM_ID);
  if (!match) return;
  const ownerId = match[1];
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: "🏮 Esse botão controla as notificações de quem executou o trabalho.", flags: MessageFlags.Ephemeral });
  }
  if (!interaction.guildId) {
    return interaction.reply({ content: "🌙 Use esta opção dentro do servidor onde trabalhou.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferUpdate();
  const record = await storage.get(interaction.guildId, "profile", {
    lastWorkAt: 0, totalEarned: 0, jobsCompleted: 0,
  }, ownerId);
  const enabled = !Boolean(record.notificationEnabled);
  const lastWorkAt = Number(record.lastWorkAt) || 0;
  const updated = { ...record, notificationEnabled: enabled };
  if (enabled && lastWorkAt <= 0) updated.lastWorkAt = Date.now();
  await storage.set(interaction.guildId, "profile", updated, ownerId);
  if (enabled) notifications.schedule(client, interaction.guildId, ownerId, Number(updated.lastWorkAt) || Date.now());
  else notifications.cancel(interaction.guildId, ownerId);
  await interaction.message.edit({ components: [buildRow(ownerId, enabled)] }).catch(() => {});
  await interaction.followUp({
    content: enabled
      ? "🔔 **Avisos ativados!** A Yukina enviará uma DM quando seu próximo turno estiver disponível."
      : "🔕 **Avisos desativados.** A Yukina não enviará mais avisos de trabalho por DM.",
    flags: MessageFlags.Ephemeral,
  });
}
module.exports = { customId: CUSTOM_ID, execute, initialize: notifications.initialize };
