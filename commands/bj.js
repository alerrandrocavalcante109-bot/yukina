"use strict";
const bj=require("../systems/blackjack");
module.exports={name:"bj",aliases:["blackjack"],async prefixExecute(message,args=[],client){try{const r=await bj.startGame({client:client||message.client,guild:message.guild,channel:message.channel,user:message.author,betInput:args[0],send:p=>message.channel.send(p)});if(!r.ok)return message.reply(r.message);return r.message;}catch(e){console.error("[Yukina Blackjack]",e);return message.reply("Não foi possível iniciar o Blackjack agora.");}}};
