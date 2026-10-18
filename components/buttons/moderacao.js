const { pending, ACTIONS, hierarchyError } = require("../../commands/moderar");

module.exports = {
  customId: /^moderar:(confirmar|cancelar):(\d+:\d+)$/,
  async execute(interaction) {
    const match = interaction.customId.match(/^moderar:(confirmar|cancelar):(\d+:\d+)$/);
    const decision = match?.[1];
    const token = match?.[2];
    const item = pending.get(token);
    if (!item) return interaction.update({ content: "Esta confirmação expirou ou já foi utilizada. Execute o comando novamente.", components: [] });
    if (interaction.user.id !== item.moderatorId) return interaction.reply({ content: "Somente a pessoa que iniciou esta ação pode confirmar.", ephemeral: true });
    if (Date.now() - item.createdAt > 300000) {
      pending.delete(token);
      return interaction.update({ content: "Esta confirmação expirou. Execute o comando novamente.", components: [] });
    }
    const guild = await interaction.client.guilds.fetch(item.guildId).catch(() => null);
    if (!guild) {
      pending.delete(token);
      return interaction.update({ content: "Não consegui localizar o servidor. Nenhuma ação foi executada.", components: [] });
    }
    const config = ACTIONS[item.action];
    const moderator = await guild.members.fetch(item.moderatorId).catch(() => null);
    const target = await guild.members.fetch(item.targetId).catch(() => null);
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!moderator || !target || !config) {
      pending.delete(token);
      return interaction.update({ content: "O membro não está mais disponível no servidor. Nenhuma ação foi executada.", components: [] });
    }
    if (!moderator.permissions.has(config.permission)) {
      pending.delete(token);
      return interaction.update({ content: "A ação foi bloqueada: você não tem mais a permissão necessária.", components: [] });
    }
    if (!botMember?.permissions.has(config.botPermission)) {
      pending.delete(token);
      return interaction.update({ content: "A ação foi bloqueada: a Yukina não tem mais a permissão necessária.", components: [] });
    }
    const denial = hierarchyError(moderator, target, guild, botMember);
    if (denial) {
      pending.delete(token);
      return interaction.update({ content: "A ação foi bloqueada pelas regras de segurança: " + denial, components: [] });
    }

    await interaction.update({ content: "⏳ Confirmado. A Yukina está executando a ação...", components: [] });
    try {
      const auditReason = (item.reason + " | Moderador: " + moderator.user.tag + " (" + moderator.id + ")").slice(0, 500);
      if (item.action === "banir") await guild.members.ban(target.id, { reason: auditReason });
      else if (item.action === "expulsar") await target.kick(auditReason);
      else if (item.action === "timeout") await target.timeout(item.minutes * 60000, auditReason);
      else if (item.action === "remover-timeout") await target.timeout(null, auditReason);

      const messages = {
        banir: "🔨 " + target.user.tag + " foi banido(a) do servidor por " + moderator.user.tag + ". Motivo: " + item.reason,
        expulsar: "👢 " + target.user.tag + " foi expulso(a) do servidor por " + moderator.user.tag + ". Motivo: " + item.reason,
        timeout: "🔇 " + target.user.tag + " recebeu timeout de " + item.minutes + " minuto(s), aplicado por " + moderator.user.tag + ". Motivo: " + item.reason,
        "remover-timeout": "🔊 O timeout de " + target.user.tag + " foi removido por " + moderator.user.tag + ". Motivo: " + item.reason,
      };
      await interaction.followUp({ content: messages[item.action], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error("[Moderação] Falha ao executar ação:", error);
      await interaction.followUp({ content: "❌ Não consegui concluir a ação. Verifique minhas permissões, a hierarquia dos cargos e se o membro ainda está disponível.", allowedMentions: { parse: [] } });
    } finally {
      pending.delete(token);
    }
  },
};
