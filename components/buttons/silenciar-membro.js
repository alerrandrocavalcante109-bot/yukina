"use strict";
const {PermissionFlagsBits}=require("discord.js"),command=require("../../commands/silenciar-membro");
module.exports={customId:/^silenciar-membro:(confirmar|discreto):([a-z0-9]+)$/i,async execute(i){
 const [,mode,token]=i.customId.match(/^silenciar-membro:(confirmar|discreto):([a-z0-9]+)$/i),item=command._pending.get(token);
 if(!item)return i.update({content:"Esta confirmação expirou ou já foi usada. Execute o comando novamente.",components:[]});
 if(i.user.id!==item.moderatorId)return i.reply({content:"Somente quem iniciou esta solicitação pode confirmar.",ephemeral:true});
 if(Date.now()-item.createdAt>300000){command._pending.delete(token);return i.update({content:"Esta confirmação expirou. Execute o comando novamente.",components:[]});}
 const g=await i.client.guilds.fetch(item.guildId).catch(()=>null),m=g&&await g.members.fetch(item.moderatorId).catch(()=>null),t=g&&await g.members.fetch(item.targetId).catch(()=>null),b=g&&(g.members.me||await g.members.fetchMe().catch(()=>null));
 if(!g||!m||!t||!m.permissions.has(PermissionFlagsBits.ModerateMembers)||!b?.permissions.has(PermissionFlagsBits.ModerateMembers)||t.id===g.ownerId||(m.id!==g.ownerId&&t.roles.highest.position>=m.roles.highest.position)||t.roles.highest.position>=b.roles.highest.position||!t.moderatable){command._pending.delete(token);return i.update({content:"Silenciamento bloqueado: permissões ou hierarquia não permitem esta ação.",components:[]});}
 if(t.isCommunicationDisabled()){command._pending.delete(token);return i.update({content:"Esse membro já está silenciado.",components:[]});}
 await i.update({content:"⏳ Confirmação recebida. A Yukina está aplicando o silenciamento...",components:[]});
 try{await t.timeout(item.durationMs,(item.reason+" | Staff: "+m.user.tag+" ("+m.id+")").slice(0,500));const text=mode==="discreto"?"❄️ A decisão foi executada discretamente. O membro foi silenciado sem um anúncio público, preservando a discrição da equipe de moderação.":"🌸 A decisão foi concluída. O silenciamento temporário foi aplicado. Que a tranquilidade e o respeito continuem prevalecendo em nossa comunidade.";await i.channel.send({content:text,reply:{messageReference:i.message.id},allowedMentions:{repliedUser:false,parse:[]}});}
 catch(e){console.error("[Silenciar membro]",e);await i.followUp({content:"❌ Não consegui silenciar o membro. Confira as permissões e a hierarquia da Yukina.",ephemeral:true});}finally{command._pending.delete(token);}
}};
