"use strict";
const { PermissionFlagsBits } = require("discord.js");
const command = require("../../commands/advertir-membro");
const memberData = require("../../member-data");
module.exports={customId:/^advertencia-membro:(confirmar|discreto):([a-z0-9]+)$/i,async execute(i){
 const [,mode,token]=i.customId.match(/^advertencia-membro:(confirmar|discreto):([a-z0-9]+)$/i),item=command._pending.get(token);
 if(!item)return i.update({content:"Esta confirmação expirou ou já foi usada. Execute o comando novamente.",components:[]});
 if(i.user.id!==item.moderatorId)return i.reply({content:"Somente quem iniciou esta solicitação pode confirmar.",ephemeral:true});
 if(Date.now()-item.createdAt>300000){command._pending.delete(token);return i.update({content:"Esta confirmação expirou. Execute o comando novamente.",components:[]});}
 const g=await i.client.guilds.fetch(item.guildId).catch(()=>null),m=g&&await g.members.fetch(item.moderatorId).catch(()=>null),t=g&&await g.members.fetch(item.targetId).catch(()=>null);
 if(!g||!m||!t||!m.permissions.has(PermissionFlagsBits.ModerateMembers)||t.id===g.ownerId||(m.id!==g.ownerId&&t.roles.highest.position>=m.roles.highest.position)){command._pending.delete(token);return i.update({content:"Advertência bloqueada: permissões ou hierarquia de cargos não permitem esta ação.",components:[]});}
 await i.update({content:"⏳ Confirmação recebida. A Yukina está registrando a advertência...",components:[]});
 try{
  const warning=await memberData.addWarning(g.id,t.id,{reason:item.reason,moderatorId:m.id});
  const count=memberData.getWarnings(g.id,t.id).length;
  const text=mode==="discreto"?"❄️ A advertência foi registrada discretamente no histórico do membro, sem anúncio público.":"🌸 A advertência foi registrada no histórico do membro. Que esta orientação ajude a preservar o respeito e a tranquilidade da comunidade.";
  await i.channel.send({content:text+"\nRegistro: **#"+count+"** · Motivo: **"+warning.reason+"**",reply:{messageReference:i.message.id},allowedMentions:{repliedUser:false,parse:[]}});
 }catch(e){console.error("[Advertência] Falha ao salvar registro:",e);await i.followUp({content:"❌ Não consegui salvar a advertência no banco de dados. Nenhum registro foi confirmado.",ephemeral:true});}
 finally{command._pending.delete(token);}
}};