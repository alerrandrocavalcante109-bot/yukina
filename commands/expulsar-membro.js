"use strict";
const {SlashCommandBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,PermissionFlagsBits}=require("discord.js");
const pending=new Map();
async function request({guild,moderator,targetId,reason,reply}){
 if(!guild)return reply({content:"❄️ Este comando só funciona dentro de um servidor.",ephemeral:true});
 if(!moderator.permissions.has(PermissionFlagsBits.KickMembers))return reply({content:"Você precisa da permissão **Expulsar membros**.",ephemeral:true});
 if(targetId===moderator.id||targetId===guild.client.user.id)return reply({content:"Você não pode expulsar a si mesmo ou a Yukina.",ephemeral:true});
 const target=await guild.members.fetch(targetId).catch(()=>null),bot=guild.members.me||await guild.members.fetchMe().catch(()=>null);
 if(!target)return reply({content:"Esse usuário não é membro deste servidor.",ephemeral:true});
 if(target.id===guild.ownerId||(moderator.id!==guild.ownerId&&target.roles.highest.position>=moderator.roles.highest.position)||target.roles.highest.position>=bot.roles.highest.position)return reply({content:"Expulsão bloqueada pela hierarquia de cargos do Discord.",ephemeral:true});
 const token=Date.now().toString(36)+Math.random().toString(36).slice(2,7),safe=String(reason||"Nenhum motivo informado").trim().slice(0,400);
 pending.set(token,{guildId:guild.id,moderatorId:moderator.id,targetId,reason:safe,createdAt:Date.now()});
 const timer=setTimeout(()=>pending.delete(token),300000);timer.unref?.();
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("expulsar-membro:confirmar:"+token).setLabel("Expulsar membro").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("expulsar-membro:discreto:"+token).setLabel("Expulsão discreta").setStyle(ButtonStyle.Secondary));
 return reply({content:"🌸 **Solicitação de expulsão**\n*Uma decisão deve ser tomada com responsabilidade.*\n\n<@"+moderator.id+">, você deseja expulsar <@"+targetId+"> do servidor?\nMotivo: "+safe+".\n*Toda escolha tem consequências. Que esta decisão seja tomada com sabedoria e respeito à nossa comunidade.*\n\n⏳ **Tempo para aceitar: 5 minutos.**",components:[row],allowedMentions:{users:[moderator.id,targetId],parse:[]}});
}
module.exports={data:new SlashCommandBuilder().setName("expulsar").setDescription("Comandos de expulsão da Yukina.").setDMPermission(false).addSubcommand(s=>s.setName("membro").setDescription("Expulsar um membro").addUserOption(o=>o.setName("usuario").setDescription("Membro que será expulso").setRequired(true)).addStringOption(o=>o.setName("motivo").setDescription("Motivo da expulsão").setMaxLength(400))),aliases:["kick","expulsar"],async execute(i){return request({guild:i.guild,moderator:i.member,targetId:i.options.getUser("usuario",true).id,reason:i.options.getString("motivo"),reply:p=>i.reply(p)});},async prefixExecute(m){const u=m.mentions.users.first();if(!u)return m.reply("Uso: Yexpulsar @usuario [motivo]. Também funciona com Ykick.");const reason=m.content.replace(/^\s*[Yy](?:expulsar|kick)\b/i,"").replace(new RegExp("<@!?"+u.id+">"),"").trim();return request({guild:m.guild,moderator:m.member,targetId:u.id,reason,reply:p=>m.reply(p)});},_pending:pending};
