"use strict";
const { MongoClient } = require("mongodb");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const URI=(process.env.MONGODB_URI||"").trim(), DB=(process.env.MONGODB_DB||"Yukina").trim();
const NAMES={starter:"Starter",plus:"Plus",premium:"Premium",ultra:"Ultra",infinity:"Infinity"};
const RULES={
 starter:{interval:[18000000,21600000],reward:[25000,50000]},
 plus:{interval:[17100000,19500000],reward:[60000,120000]},
 premium:{interval:[12000000,14400000],reward:[100000,125000]},
 ultra:{interval:[10800000,13200000],reward:[130000,150000]},
 infinity:{interval:[3600000,5700000],reward:[150000,200000]}
};
let mongo,db,configs,runs,subs,balances,connecting;
const timers=new Map(),locks=new Set();
async function initDb(){
 if(db)return db;
 if(!URI)throw new Error("MONGODB_URI não configurada.");
 if(!connecting)connecting=(async()=>{
  mongo=mongo||new MongoClient(URI,{appName:"Yukina-Drop-Automatico",serverSelectionTimeoutMS:10000});
  await mongo.connect();db=mongo.db(DB);
  configs=db.collection("drop_auto_configs");runs=db.collection("drop_auto_runs");
  subs=db.collection("vip_subscriptions");balances=db.collection("economy_balances");
  await runs.createIndex({status:1,endsAt:1});
  await balances.createIndex({guildId:1,userId:1},{unique:true,name:"unique_guild_user_balance"});
  return db;
 })().catch(e=>{connecting=null;mongo=null;throw e;});
 return connecting;
}
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const fmt=n=>Math.floor(n).toLocaleString("pt-BR")+" KZ";
async function validPlan(userId,planKey){
 await initDb();
 const s=await subs.findOne({userId:String(userId),status:"active",expiresAt:{$gt:new Date()},guildId:{$exists:false}});
 return !!s&&String(s.planKey).toLowerCase()===String(planKey).toLowerCase();
}
function embed(d,ended=false,winners=[]){
 const e=new EmbedBuilder().setColor(0xA7D8F0)
 .setTitle("🌸 Drop "+(NAMES[d.planKey]||"")+" Automático")
 .setDescription("Um novo Drop chegou! Participe e concorra a Kizunas.\n❄️ Boa sorte! Que a lua ilumine seu caminho.")
 .addFields(
  {name:"💴 Valor",value:fmt(d.reward),inline:true},
  {name:"🏆 Ganhadores",value:String(d.winnerCount),inline:true},
  {name:"⏳ Duração",value:"1 minuto",inline:true},
  {name:"🌙 Participantes",value:String(Object.keys(d.entries||{}).length),inline:true}
 ).setFooter({text:ended?"Yukina · Drop encerrado":"Yukina · Sob o luar, entre estrelas"}).setTimestamp(new Date(d.createdAt));
 if(ended)e.addFields({name:"🎉 Resultado",value:winners.length?winners.map((id,i)=>(i+1)+". <@"+id+">").join("\n"):"Ninguém participou deste Drop."});
 else e.addFields({name:"⌛ Encerra",value:"<t:"+Math.floor(d.endsAt/1000)+":R>"});
 return e;
}
function row(id,disabled=false){
 return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("dropauto:join:"+id).setLabel("Participar do Drop").setEmoji("🎁").setStyle(ButtonStyle.Primary).setDisabled(disabled));
}
async function schedule(client,config,channelId,delay){
 const key=config.userId+":"+channelId,old=timers.get(key);if(old)clearTimeout(old);
 const t=setTimeout(()=>{timers.delete(key);publish(client,config,channelId).catch(async e=>{console.error("[Drop Automático]",e);await schedule(client,config,channelId,120000);});},Math.max(1000,delay));
 t.unref?.();timers.set(key,t);
}
async function scheduleNext(client,config,channelId){
 const rule=RULES[String(config.planKey).toLowerCase()];if(rule)await schedule(client,config,channelId,rnd(...rule.interval));
}
async function publish(client,config,channelId){
 await initDb();const key=config.userId+":"+channelId;if(locks.has(key))return;locks.add(key);
 try{
  const c=await configs.findOne({userId:String(config.userId),status:"active",enabled:true});
  if(!c||!c.channelIds?.includes(String(channelId)))return;
  if(!await validPlan(c.userId,c.planKey)){await configs.updateOne({_id:c._id},{$set:{status:"paused",enabled:false,pausedAt:new Date(),pauseReason:"plan_expired"}});return;}
  const rule=RULES[String(c.planKey).toLowerCase()];if(!rule)return;
  const guild=await client.guilds.fetch(String(c.guildId)).catch(()=>null);
  const channel=guild?await guild.channels.fetch(String(channelId)).catch(()=>null):null;
  if(!channel?.isTextBased()||!channel.send){await scheduleNext(client,c,channelId);return;}
  const now=Date.now(),d={userId:String(c.userId),planKey:String(c.planKey).toLowerCase(),guildId:guild.id,channelId:String(channelId),guildName:guild.name,reward:rnd(...rule.reward),winnerCount:rnd(1,5),createdAt:now,endsAt:now+60000,status:"active",entries:{},winners:[],payouts:[]};
  const inserted=await runs.insertOne(d);d._id=inserted.insertedId;
  const msg=await channel.send({embeds:[embed(d)],components:[row(String(d._id))],allowedMentions:{parse:[]}});
  await runs.updateOne({_id:d._id},{$set:{messageId:msg.id}});
  const t=setTimeout(()=>finish(client,String(d._id)).catch(console.error),60000);t.unref?.();timers.set("run:"+d._id,t);
 }finally{locks.delete(key);}
}
async function pay(guildId,userId,amount,runId){
 const claimed=await runs.updateOne({_id:runId,status:"paying",payouts:{$ne:String(userId)}},{$addToSet:{payouts:String(userId)}});
 if(!claimed.modifiedCount)return false;
 await balances.updateOne({guildId:String(guildId),userId:String(userId)},{$inc:{balance:amount},$set:{updatedAt:new Date()},$setOnInsert:{guildId:String(guildId),userId:String(userId),createdAt:new Date()}},{upsert:true});
 return true;
}
async function finish(client,runId){
 await initDb();const id=new (require("mongodb").ObjectId)(runId);
 const d=await runs.findOne({_id:id,status:"active"});if(!d)return;
 if(Date.now()<d.endsAt){const t=setTimeout(()=>finish(client,runId).catch(console.error),d.endsAt-Date.now());t.unref?.();timers.set("run:"+runId,t);return;}
 if(!(await runs.updateOne({_id:id,status:"active"},{$set:{status:"paying"}})).modifiedCount)return;
 const pool=Object.keys(d.entries||{}),winners=[];
 while(pool.length&&winners.length<Math.min(5,Math.max(1,d.winnerCount)))winners.push(pool.splice(rnd(0,pool.length-1),1)[0]);
 await runs.updateOne({_id:id},{$set:{winners,winnerCount:winners.length}});
 const channel=await client.channels.fetch(String(d.channelId)).catch(()=>null);
 const msg=channel?await channel.messages.fetch(String(d.messageId)).catch(()=>null):null;
 if(msg)await msg.edit({embeds:[embed(d,true,winners)],components:[row(runId,true)]}).catch(()=>{});
 const paid=[];
 for(const uid of winners){try{if(await pay(d.guildId,uid,d.reward,id))paid.push(uid);}catch(e){console.error("[Drop Automático] Crédito falhou:",e);}}
 if(channel&&paid.length)await channel.send({content:paid.map(uid=>"🌸 Parabéns <@"+uid+">! Você acaba de ganhar o Drop de **"+fmt(d.reward)+"**.").join("\n"),allowedMentions:{users:paid}}).catch(()=>{});
 else if(channel&&!winners.length)await channel.send({content:"🌙 O Drop terminou, mas ninguém participou desta vez.",allowedMentions:{parse:[]}}).catch(()=>{});
 await runs.updateOne({_id:id},{$set:{status:"ended",endedAt:Date.now()}});
 const c=await configs.findOne({userId:String(d.userId),status:"active",enabled:true});
 if(c&&c.channelIds?.includes(String(d.channelId))&&await validPlan(c.userId,c.planKey))await scheduleNext(client,c,d.channelId);
}
async function initialize(client){
 await initDb();
 for(const d of await runs.find({status:"active"}).toArray()){
  const delay=Math.max(0,d.endsAt-Date.now()),t=setTimeout(()=>finish(client,String(d._id)).catch(console.error),delay);
  t.unref?.();timers.set("run:"+d._id,t);
 }
 for(const c of await configs.find({status:"active",enabled:true}).toArray()){
  if(!await validPlan(c.userId,c.planKey)){await configs.updateOne({_id:c._id},{$set:{status:"paused",enabled:false,pausedAt:new Date(),pauseReason:"plan_expired"}});continue;}
  for(const channelId of c.channelIds||[])await scheduleNext(client,c,channelId);
 }
 console.log("[Drop Automático] Agendador iniciado.");
}
async function join(interaction,id){
 await initDb();
 if(!/^[a-f0-9]{24}$/i.test(id))return interaction.reply({content:"🌙 Este Drop não é válido.",flags:MessageFlags.Ephemeral});
 const _id=new (require("mongodb").ObjectId)(id),d=await runs.findOne({_id,status:"active"});
 if(!d||Date.now()>=d.endsAt){if(d)await finish(interaction.client,id);return interaction.reply({content:"🌙 Este Drop já foi encerrado ou o tempo acabou.",flags:MessageFlags.Ephemeral});}
 if(String(interaction.guildId)!==String(d.guildId)||String(interaction.channelId)!==String(d.channelId))return interaction.reply({content:"❄️ Este botão não pertence a este canal.",flags:MessageFlags.Ephemeral});
 const result=await runs.updateOne({_id,status:"active",endsAt:{$gt:Date.now()},["entries."+interaction.user.id]:{$exists:false}},{$set:{["entries."+interaction.user.id]:{joinedAt:Date.now()}}});
 if(!result.modifiedCount)return interaction.reply({content:"🌸 Você já está participando deste Drop ou o tempo acabou.",flags:MessageFlags.Ephemeral});
 return interaction.reply({content:"🎁 Sua participação foi registrada. Boa sorte!",flags:MessageFlags.Ephemeral});
}
module.exports={
 customId:/^dropauto:join:[a-f0-9]{24}$/i,
 async execute(interaction){return join(interaction,interaction.customId.split(":")[2]);},
 async initialize(client){return initialize(client);}
};
