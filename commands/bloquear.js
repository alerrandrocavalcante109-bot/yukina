"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { changeChannel, getTarget } = require("../systems/channel-lock");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bloquear")
    .setDescription("Bloquear um canal para @everyone.")
    .setDMPermission(false)
    .addChannelOption(o => o.setName("canal").setDescription("Canal que será bloqueado").setRequired(false)),
  aliases: ["lock", "trancar", "fechar"],
  async execute(i) {
    const channel = i.options.getChannel("canal") || i.channel;
    return changeChannel({ guild: i.guild, channel, moderator: i.member, action: "lock", reply: content => i.reply({ content }) });
  },
  async prefixExecute(m, args) {
    const channel = await getTarget(m, args);
    return changeChannel({ guild: m.guild, channel, moderator: m.member, action: "lock", reply: content => m.reply(content) });
  }
};
