"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const dropManager = require("../systems/drop-manager");

async function run({ guild, channel, member, client, messageId, reply }) {
  if (!guild) return reply("❄️ Este comando só funciona dentro de um servidor.");
  if (!member.permissions.has(PermissionFlagsBits.ManageGuild) &&
      !member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return reply("🌙 Você precisa da permissão **Gerenciar servidor** ou **Gerenciar mensagens**.");
  }

  try {
    const drop = await dropManager.findActive(guild.id, channel.id, messageId);
    if (!drop) {
      return reply(messageId
        ? "🌙 Não encontrei um drop ativo neste canal com esse ID de mensagem."
        : "🌙 Não há drops ativos neste canal para encerrar.");
    }

    await dropManager.finish(client, String(drop._id), { force: true });
    return reply("🏁 O drop foi encerrado. O resultado foi publicado no canal.");
  } catch (error) {
    console.error("[Yukina drop-end] Falha ao encerrar:", error);
    return reply("🫧 Não consegui encerrar o drop. Tente novamente e verifique minhas permissões.");
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("drop-encerrar")
    .setDescription("Encerrar um drop ativo neste canal.")
    .setDMPermission(false)
    .addStringOption(o => o.setName("mensagem").setDescription("ID da mensagem do drop (opcional)").setRequired(false)),
  aliases: ["dropfim", "encerrardrop", "encerrarsorteio", "finalizarsorteio"],
  async execute(i) {
    return run({
      guild: i.guild,
      channel: i.channel,
      member: i.member,
      client: i.client,
      messageId: i.options.getString("mensagem"),
      reply: content => i.reply({ content, ephemeral: true })
    });
  },
  async prefixExecute(m, args) {
    return run({
      guild: m.guild,
      channel: m.channel,
      member: m.member,
      client: m.client,
      messageId: args?.[0],
      reply: content => m.reply(content)
    });
  }
};
