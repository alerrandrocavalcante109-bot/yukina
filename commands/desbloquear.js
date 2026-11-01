"use strict";
const { SlashCommandBuilder } = require("discord.js");
const { changeChannel, getTarget } = require("../systems/channel-lock");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("desbloquear")
    .setDescription("Desbloquear um canal.")
    .setDMPermission(false)
    .addChannelOption(o => o.setName("canal").setDescription("Canal que será desbloqueado").setRequired(false)),
  aliases: ["unlock", "destrancar", "abrir"],
  async execute(i) {
    const channel = i.options.getChannel("canal") || i.channel;
    return changeChannel({ guild: i.guild, channel, moderator: i.member, action: "unlock", reply: content => i.reply({ content }) });
  },
  async prefixExecute(m, args) {
    const channel = await getTarget(m, args);
    return changeChannel({ guild: m.guild, channel, moderator: m.member, action: "unlock", reply: content => m.reply(content) });
  }
};
