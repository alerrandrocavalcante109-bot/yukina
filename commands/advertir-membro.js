"use strict";
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const idioma = require("../systems/idioma");
const LOCALES = require("../systems/idioma/locales/warnings");
const pending = new Map();
function translator(language) {
  const locale = LOCALES[language] || LOCALES["pt-BR"];
  return (key, variables = {}) => String(locale[key] || LOCALES["pt-BR"][key] || key)
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : ""
    );
}
async function request({guild, moderator, targetId, reason, reply, language}) {
 const t = translator(language);
 if (!guild) return reply({content:t("serverOnly"),ephemeral:true});
 if (!reason || !String(reason).trim()) return reply({content:t("requiredReason"),ephemeral:true});
 if (!moderator.permissions.has(PermissionFlagsBits.ModerateMembers)) return reply({content:t("permission"),ephemeral:true});
 if (targetId===moderator.id || targetId===guild.client.user.id) return reply({content:t("selfTarget"),ephemeral:true});
 const target=await guild.members.fetch(targetId).catch(()=>null);
 if (!target) return reply({content:t("notMember"),ephemeral:true});
 if (target.id===guild.ownerId || (moderator.id!==guild.ownerId && target.roles.highest.position>=moderator.roles.highest.position)) return reply({content:t("hierarchy"),ephemeral:true});
 const safe=String(reason).trim().slice(0,400), token=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 pending.set(token,{guildId:guild.id,moderatorId:moderator.id,targetId,reason:safe,createdAt:Date.now()});
 const timer=setTimeout(()=>pending.delete(token),300000); timer.unref?.();
 const row=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId("advertencia-membro:confirmar:"+token).setLabel(t("warnButton")).setStyle(ButtonStyle.Danger),
   new ButtonBuilder().setCustomId("advertencia-membro:discreto:"+token).setLabel(t("discreetButton")).setStyle(ButtonStyle.Secondary)
 );
 return reply({content:t("requestTitle")+"\n"+t("guidance")+"\n\n"+t("ask",{moderator:moderator.id,target:targetId})+"\n"+t("reason")+": **"+safe+"**\n"+t("community")+"\n\n"+t("acceptTime"),components:[row],allowedMentions:{users:[moderator.id,targetId],parse:[]}});
}
module.exports={
 data:new SlashCommandBuilder().setName("advertir").setDescription("Sistema de advertências da Yukina.").setDMPermission(false).addSubcommand(s=>s.setName("membro").setDescription("Advertir um membro").addUserOption(o=>o.setName("usuario").setDescription("Membro que receberá a advertência").setRequired(true)).addStringOption(o=>o.setName("motivo").setDescription("Motivo obrigatório").setRequired(true).setMaxLength(400))),
 aliases:["warn","warning","advertencia","advertência","warnmember","警告","注意","avertir","avertissement"],
 async execute(i){ const language=await idioma.getUserLanguage(i.user.id); return request({guild:i.guild,moderator:i.member,targetId:i.options.getUser("usuario",true).id,reason:i.options.getString("motivo",true),reply:p=>i.reply(p),language}); },
 async prefixExecute(m){
   const language=await idioma.getUserLanguage(m.author.id), t=translator(language);
   const u=m.mentions.users.first();
   if(!u)return m.reply(t("prefixUsage"));
   const reason=m.content.replace(/^\s*[Yy](?:advertir|advertencia|advertência|warn|warning)\b/i,"").replace(new RegExp("<@!?"+u.id+">"),"").trim();
   if(!reason)return m.reply(t("prefixReason"));
   return request({guild:m.guild,moderator:m.member,targetId:u.id,reason,reply:p=>m.reply(p),language});
 },
 _pending:pending
};
