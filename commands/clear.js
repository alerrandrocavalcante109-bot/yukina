"use strict";

const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "clear",
  aliases: ["limpar", "purge"],

  // Comando exclusivamente por prefixo; não possui versão slash.
  async execute() {},

  async prefixExecute(message, args) {
    const amountText = args?.[0];
    const amount = Number(amountText);

    if (!/^\d+$/.test(String(amountText || "")) || !Number.isInteger(amount) || amount < 2 || amount > 100) {
      return message.reply("❄️ Use **Yclear 2 a 100** para escolher quantas mensagens deseja apagar.");
    }

    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply("🌙 Você precisa da permissão **Gerenciar mensagens** para usar este comando.");
    }

    const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
    if (!botMember?.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages)) {
      return message.reply("🫧 Preciso da permissão **Gerenciar mensagens** neste canal.");
    }

    try {
      // O Discord não permite exclusão em massa de mensagens com mais de 14 dias.
      const deleted = await message.channel.bulkDelete(amount, true);
      const count = deleted.size;

      const confirmation = await message.channel.send({
        content: count
          ? `❄️ Limpeza concluída. **${count}** mensagem(ns) apagada(s).`
          : "🌙 Nenhuma mensagem recente pôde ser apagada."
      });

      setTimeout(() => confirmation.delete().catch(() => {}), 5000);
      return confirmation;
    } catch (error) {
      console.error("[Yukina clear] Falha ao apagar mensagens:", error);
      return message.reply("🫧 Não consegui apagar as mensagens. Verifique minhas permissões e tente novamente.");
    }
  }
};
