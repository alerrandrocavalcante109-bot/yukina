"use strict";
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const pending = new Map();
async function request({guild, moderator, targetId, reason, reply}) {
 if (!guild) return reply({content:"❄️ Este comando só funciona dentro de um servidor.",ephemeral:true});
 if (!reason || !String(reason).trim()) return reply({content:"Informe obrigatoriamente o motivo da advertência.",ephemeral:true});
 if (!moderator.permissions.has(PermissionFlagsBits.ModerateMembers)) return reply({content:"Você precisa da permissão **Moderar membros**.",ephemeral:true});
 if (targetId===moderator.id || targetId===guild.client.user.id) return reply({content:"Você não pode advertir a si mesmo ou a Yukina.",ephemeral:true});
 const target=await guild.members.fetch(targetId).catch(()=>null);
 if (!target) return reply({content:"Esse usuário não é membro deste servidor.",ephemeral:true});
 if (target.id===guild.ownerId || (moderator.id!==guild.ownerId && target.roles.highest.position>=moderator.roles.highest.position)) return reply({content:"Advertência bloqueada pela hierarquia de cargos do Discord.",ephemeral:true});
 const safe=String(reason).trim().slice(0,400), token=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 pending.set(token,{guildId:guild.id,moderatorId:moderator.id,targetId,reason:safe,createdAt:Date.now()});
 const timer=setTimeout(()=>pending.delete(token),300000); timer.unref?.();
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("advertencia-membro:confirmar:"+token).setLabel("Advertir membro").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("advertencia-membro:discreto:"+token).setLabel("Advertência discreta").setStyle(ButtonStyle.Secondary));
 return reply({content:"🌸 **Solicitação de advertência**\n*Uma orientação deve ser feita com responsabilidade.*\n\n<@"+moderator.id+">, você deseja advertir <@"+targetId+">?\nMotivo: **"+safe+"**\n*Que a orientação contribua para a tranquilidade e o respeito da comunidade.*\n\n⏳ **Tempo para aceitar: 5 minutos.**",components:[row],allowedMentions:{users:[moderator.id,targetId],parse:[]}});
}
module.exports={
 data:new SlashCommandBuilder().setName("advertir").setDescription("Sistema de advertências da Yukina.").setDMPermission(false).addSubcommand(s=>s.setName("membro").setDescription("Advertir um membro").addUserOption(o=>o.setName("usuario").setDescription("Membro que receberá a advertência").setRequired(true)).addStringOption(o=>o.setName("motivo").setDescription("Motivo obrigatório").setRequired(true).setMaxLength(400))),
 aliases:["warn","warning","advertencia","advertência","warnmember","警告","注意","avertir","avertissement"],
 async execute(i){return request({guild:i.guild,moderator:i.member,targetId:i.options.getUser("usuario",true).id,reason:i.options.getString("motivo",true),reply:p=>i.reply(p)});},
 async prefixExecute(m){const u=m.mentions.users.first();if(!u)return m.reply("Uso: Yadvertir @usuario motivo. O motivo é obrigatório. Também funciona com Ywarn.");const reason=m.content.replace(/^\s*[Yy](?:advertir|advertencia|advertência|warn|warning)\b/i,"").replace(new RegExp("<@!?"+u.id+">"),"").trim();if(!reason)return m.reply("🌸 Informe o motivo obrigatório da advertência. Exemplo: Yadvertir @usuario comportamento inadequado.");return request({guild:m.guild,moderator:m.member,targetId:u.id,reason,reply:p=>m.reply(p)});},
 _pending:pending
};