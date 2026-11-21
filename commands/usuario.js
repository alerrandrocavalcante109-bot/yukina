"use strict";

const { SlashCommandBuilder, EmbedBuilder, UserFlags } = require("discord.js");
const idioma = require("../systems/idioma");
const LOCALES = require("../systems/idioma/locales/usuario");
const COLOR = 0xA7D8F0;
const translator = language => {
  const locale = LOCALES[language] || LOCALES["pt-BR"];
  return key => locale[key] || LOCALES["pt-BR"][key] || key;
};
function discordDate(date, t) {
  if (!date || Number.isNaN(new Date(date).getTime())) return t("na");
  const unix = Math.floor(new Date(date).getTime() / 1000);
  return "<t:" + unix + ":F>\n<t:" + unix + ":R>";
}
function statusLabel(presence, t) {
  if (!presence) return t("na");
  return ({ online:"🟢 Online", idle:"🌙 Idle", dnd:"🔴 Do Not Disturb", offline:"⚫ Offline" })[presence.status] || t("na");
}
function buildUserInfo(user, member, requester, t) {
  const roles = member ? member.roles.cache.filter(role => role.id !== member.guild.id).sort((a,b)=>b.position-a.position) : [];
  const roleText = roles.size ? roles.map(role => "<@&"+role.id+">").join(", ").slice(0,1000) : t("noRoles");
  const verifiedBot = user.bot ? (user.flags?.has(UserFlags.VerifiedBot) ? t("yes") : t("no")) : t("notApplicable");
  const embed = new EmbedBuilder().setColor(COLOR)
    .setAuthor({ name:t("author"), iconURL:requester.displayAvatarURL({size:128}) })
    .setTitle((user.globalName || user.username).slice(0,256))
    .setDescription("**"+t("username")+":** @"+user.username+"\n**"+t("nickname")+":** "+(member?.nickname || t("no"))+"\n**"+t("mention")+":** <@"+user.id+">")
    .addFields(
      {name:t("id"),value:"\x60"+user.id+"\x60",inline:false},
      {name:t("type"),value:user.bot?t("bot"):t("person"),inline:true},
      {name:t("verified"),value:verifiedBot,inline:true},
      {name:t("created"),value:discordDate(user.createdAt,t),inline:false},
      {name:t("joined"),value:discordDate(member?.joinedAt,t),inline:false},
      {name:t("status"),value:statusLabel(member?.presence,t),inline:true},
      {name:t("rolesCount"),value:String(roles.size),inline:true},
      {name:t("highestRole"),value:member && member.roles.highest.id===member.guild.id?t("noRoles"):(member?.roles?.highest?member.roles.highest.toString():t("na")),inline:false},
      {name:t("boosting"),value:member?.premiumSince?t("yes")+" · "+t("since")+" "+discordDate(member.premiumSince,t):(member?t("no"):t("na")),inline:false},
      {name:t("roles"),value:roleText,inline:false}
    ).setFooter({text:t("footer")}).setTimestamp();
  const avatar=user.displayAvatarURL({size:1024}); if(avatar) embed.setThumbnail(avatar);
  const banner=user.bannerURL({size:1024}); if(banner) embed.setImage(banner);
  return embed;
}
async function showUserInfo(source,targetUser) {
  const language=await idioma.getUserLanguage((source.user||source.author).id), t=translator(language);
  if(!source.guild) return source.reply({content:t("serverOnly"),ephemeral:true});
  try {
    const user=await targetUser.fetch(true).catch(()=>targetUser);
    const member=await source.guild.members.fetch({user:user.id,force:true}).catch(()=>null);
    return source.reply({embeds:[buildUserInfo(user,member,source.user||source.author,t)],allowedMentions:{parse:[]}});
  } catch(error) {
    console.error("[Yukina /usuario informações]",error);
    const payload={content:t("error"),ephemeral:true};
    if(source.deferred||source.replied) return source.followUp(payload).catch(()=>{});
    return source.reply(payload).catch(()=>{});
  }
}
module.exports={
 data:new SlashCommandBuilder().setName("usuario").setDescription("Consulte informações de um usuário.").setDMPermission(false)
  .addSubcommand(sub=>sub.setName("informações").setDescription("Mostra as informações da conta e do membro.").addUserOption(opt=>opt.setName("usuário").setDescription("Usuário que deseja consultar.").setRequired(true))),
 aliases:["userinfo","infousar"],
 async execute(interaction){ if(interaction.options.getSubcommand()!=="informações") return; return showUserInfo(interaction,interaction.options.getUser("usuário",true)); },
 async prefixExecute(message,args=[]) {
  const language=await idioma.getUserLanguage(message.author.id), t=translator(language);
  if(!message.guild) return message.reply(t("serverOnly"));
  const mention=message.mentions.users.first(), rawId=args.find(value=>/^\d{17,20}$/.test(String(value)));
  const targetUser=mention||(rawId?await message.client.users.fetch(rawId).catch(()=>null):null);
  if(!targetUser) return message.reply(t("prompt"));
  return showUserInfo({guild:message.guild,user:message.author,author:message.author,reply:p=>message.reply(p),followUp:p=>message.reply(p),deferred:false,replied:false},targetUser);
 }
};