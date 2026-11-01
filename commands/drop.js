"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const dropManager=require("../systems/drop-manager");
function parseTime(value){
  const match=String(value||"").trim().match(/^(\d{1,5})\s*(s|seg|segundos?|m|min|minutos?|h|horas?|d|dias?)$/i);
  if(!match)throw new Error("Use um tempo como 30s, 10m, 2h ou 1d.");
  const n=Number(match[1]),unit=match[2].toLowerCase();
  const factor=/^s|^seg/.test(unit)?1000:/^m/.test(unit)?60000:/^h/.test(unit)?3600000:86400000;
  const ms=n*factor;
  if(!Number.isSafeInteger(ms)||n<1||ms<10000||ms>30*86400000)throw new Error("O drop deve durar entre 10 segundos e 30 dias.");
  return ms;
}
async function run({guild,channel,member,user,tempo,ganhadores,premio,reply,client}){
  if(!guild)return reply("❄️ Este comando só funciona dentro de um servidor.");
  if(!member.permissions.has(PermissionFlagsBits.ManageGuild)&&!member.permissions.has(PermissionFlagsBits.ManageMessages))return reply("🌙 Você precisa da permissão **Gerenciar servidor** ou **Gerenciar mensagens**.");
  let duration;try{duration=parseTime(tempo);}catch(e){return reply("⚠️ "+e.message);}
  const count=Number(ganhadores);
  if(!Number.isInteger(count)||count<1||count>20)return reply("⚠️ A quantidade de ganhadores deve ser de 1 a 20.");
  const prize=String(premio||"").trim();
  if(!prize||prize.length>180)return reply("⚠️ Informe um prêmio com até 180 caracteres.");
  if(!channel?.isTextBased?.()||!channel.send)return reply("❄️ Este canal não aceita mensagens.");
  try{
    const result=await dropManager.create(client,{guild,channel,creator:user,tempo:duration,winnerCount:count,prize});
    return reply("🎁 Drop criado com sucesso em "+result.message.url+".");
  }catch(error){
    console.error("[Yukina drop] Falha ao criar drop:",error);
    return reply("🫧 "+(error.message||"Não consegui criar o drop. Verifique a configuração do painel e minhas permissões."));
  }
}
module.exports={
 data:new SlashCommandBuilder().setName("drop").setDescription("Criar um drop usando as regras salvas no painel.")
  .setDMPermission(false)
  .addStringOption(o=>o.setName("tempo").setDescription("Ex.: 10m, 2h ou 1d").setRequired(true).setMaxLength(20))
  .addIntegerOption(o=>o.setName("ganhadores").setDescription("Quantidade de ganhadores (1 a 20)").setRequired(true).setMinValue(1).setMaxValue(20))
  .addStringOption(o=>o.setName("premio").setDescription("Prêmio do drop").setRequired(true).setMaxLength(180)),
 aliases:["giveaway","sorteio"],
 async execute(i){return run({guild:i.guild,channel:i.channel,member:i.member,user:i.user,tempo:i.options.getString("tempo",true),ganhadores:i.options.getInteger("ganhadores",true),premio:i.options.getString("premio",true),client:i.client,reply:content=>i.reply({content})});},
 async prefixExecute(m,args){const raw=m.content.replace(/^\s*[Yy](?:drop|giveaway|sorteio)\b/i,"").trim();const match=raw.match(/^(\S+)\s+(\d+)\s+([\s\S]+)$/);if(!match)return m.reply("Uso: Ydrop <tempo> <ganhadores> <premio>. Exemplo: Ydrop 10m 2 Um plano VIP.");return run({guild:m.guild,channel:m.channel,member:m.member,user:m.author,tempo:match[1],ganhadores:match[2],premio:match[3],client:m.client,reply:content=>m.reply(content)});}
};
