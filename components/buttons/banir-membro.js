"use strict";
const { PermissionFlagsBits } = require("discord.js");
const command = require("../../commands/banir-membro");
const MAX_TIMEOUT = 2147483647;
function scheduleUnban(guild, userId, durationMs) {
  if (!durationMs) return;
  const unbanAt = Date.now() + durationMs;
  const run = async () => {
    const remaining = unbanAt - Date.now();
    if (remaining > 0) {
      const timer = setTimeout(run, Math.min(remaining, MAX_TIMEOUT));
      timer.unref?.();
      return;
    }
    try {
      await guild.members.unban(userId, "Fim da duração de banimento temporário da Yukina");
      console.log("[Banir membro] Banimento temporário encerrado: " + userId + " no servidor " + guild.id);
    } catch (error) {
      if (error.code !== 10026) console.error("[Banir membro] Não consegui remover banimento temporário:", error.message);
    }
  };
  const timer = setTimeout(run, Math.min(durationMs, MAX_TIMEOUT));
  timer.unref?.();
}
module.exports = {
  customId: /^banir-membro:(confirmar|silencioso):([a-z0-9]+)$/i,
  async execute(interaction) {
    const match = interaction.customId.match(/^banir-membro:(confirmar|silencioso):([a-z0-9]+)$/i);
    const mode = match[1], token = match[2];
    const item = command._pending.get(token);
    if (!item) return interaction.update({ content: "Esta confirmação expirou ou já foi usada. Execute o comando novamente.", components: [] });
    if (interaction.user.id !== item.moderatorId) return interaction.reply({ content: "Somente quem iniciou esta solicitação pode confirmar.", ephemeral: true });
    if (Date.now() - item.createdAt > 5 * 60 * 1000) {
      command._pending.delete(token);
      return interaction.update({ content: "Esta confirmação expirou. Execute o comando novamente.", components: [] });
    }
    const guild = await interaction.client.guilds.fetch(item.guildId).catch(() => null);
    const moderator = guild && await guild.members.fetch(item.moderatorId).catch(() => null);
    const botMember = guild && (guild.members.me || await guild.members.fetchMe().catch(() => null));
    if (!guild || !moderator || !moderator.permissions.has(PermissionFlagsBits.BanMembers) || !botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
      command._pending.delete(token);
      return interaction.update({ content: "Banimento bloqueado: servidor, moderador ou permissões não estão mais disponíveis.", components: [] });
    }
    const targetMember = await guild.members.fetch(item.targetId).catch(() => null);
    if (targetMember && (targetMember.id === guild.ownerId || (moderator.id !== guild.ownerId && targetMember.roles.highest.position >= moderator.roles.highest.position) || targetMember.roles.highest.position >= botMember.roles.highest.position)) {
      command._pending.delete(token);
      return interaction.update({ content: "Banimento bloqueado pela hierarquia de cargos do Discord.", components: [] });
    }
    await interaction.update({ content: "⏳ Confirmação recebida. A Yukina está executando o banimento...", components: [] });
    try {
      await guild.members.ban(item.targetId, { reason: (item.reason + " | Staff: " + moderator.user.tag + " (" + moderator.id + ")").slice(0, 500) });
      scheduleUnban(guild, item.targetId, item.durationMs);
      if (mode === "silencioso") {
        await interaction.followUp({ content: "✅ Banimento aplicado silenciosamente a <@" + item.targetId + ">.", ephemeral: true, allowedMentions: { parse: [] } });
      } else {
        await interaction.followUp({
          content: "<@" + item.targetId + "> foi banido do servidor por <@" + moderator.id + ">!!\nSTAFF responsável: <@" + moderator.id + ">\nMembro banido: <@" + item.targetId + ">\nMotivo: " + item.reason + (item.durationMs ? "\nDuração: " + command._formatDuration(item.durationMs) + "." : "\nDuração: permanente."),
          allowedMentions: { users: [item.targetId, moderator.id], parse: [] }
        });
      }
    } catch (error) {
      console.error("[Banir membro] Falha ao banir:", error);
      await interaction.followUp({ content: "❌ Não consegui banir o usuário. Confira as permissões e a hierarquia de cargos da Yukina.", ephemeral: true });
    } finally {
      command._pending.delete(token);
    }
  }
};
