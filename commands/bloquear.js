"use strict";
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { changeChannel, getTarget } = require("../systems/channel-lock");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bloquear")
    .setDescription("Bloquear um canal para @everyone.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName("canal").setDescription("Canal que será bloqueado").setRequired(false)),
  aliases: ["lock", "trancar", "fechar"],
  async execute(i) {
    if (!i.inGuild()) return i.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", flags: MessageFlags.Ephemeral });
    const channel = i.options.getChannel("canal") || i.channel;
    return changeChannel({ guild: i.guild, channel, moderator: i.member, action: "lock", reply: content => i.reply({ content, flags: MessageFlags.Ephemeral }) });
  },
  async prefixExecute(m, args) {
    const channel = await getTarget(m, args);
    return changeChannel({ guild: m.guild, channel, moderator: m.member, action: "lock", reply: content => m.reply(content) });
  }
};
