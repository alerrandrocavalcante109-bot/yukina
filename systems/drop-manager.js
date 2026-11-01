"use strict";

const { MongoClient, ObjectId } = require("mongodb");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const URI=(process.env.MONGODB_URI||"").trim();
const DB=(process.env.MONGODB_DB||"yukina").trim();
let client, db, giveaways, settings;
let connecting;
async function getDb(){
  if(db)return db;
  if(!URI)throw new Error("MONGODB_URI não está configurada.");
  if(!connecting)connecting=(async()=>{
    client=client||new MongoClient(URI,{appName:"Yukina-Drops",serverSelectionTimeoutMS:10000});
    await client.connect();db=client.db(DB);
    giveaways=db.collection("drop_giveaways");settings=db.collection("guild_settings");
    await giveaways.createIndex({guildId:1,status:1,endsAt:1});
    return db;
  })().catch(e=>{connecting=null;client=null;throw e;});
  return connecting;
}
function makeRow(id,disabled=false){
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("yukina-drop:join:"+id).setLabel("Participar do drop").setEmoji("🎁").setStyle(ButtonStyle.Primary).setDisabled(disabled));
}
function makeEmbed(drop,ended=false,winners=[]){
  const end=Math.floor(drop.endsAt/1000);
  const embed=new EmbedBuilder().setColor(0xC58AE8)
    .setTitle("🎁 Drop da Yukina")
    .setDescription("**Prêmio:** "+drop.prize+"\n**Ganhadores:** "+drop.winnerCount+"\n**Participantes:** "+Object.keys(drop.entries||{}).length+"\n\n"+(ended?"🌸 **Drop encerrado!**":"⏳ Encerra <t:"+end+":R>\nClique no botão abaixo para participar."))
    .setFooter({text:"Yukina · Boa sorte sob a luz da lua."})
    .setTimestamp(new Date(drop.createdAt));
  if(ended)embed.addFields({name:"🏆 Resultado",value:winners.length?winners.map((id,i)=>(i+1)+". <@"+id+">").join("\n"):"Ninguém participou deste drop."});
  return embed;
}
async function getConfig(guildId){
  const collection=await getDb().then(()=>settings);
  const doc=await collection.findOne({guildId:String(guildId)},{projection:{"settings.dropSystem":1}});
  const config=doc?.settings?.dropSystem||{};
  return {enabled:config.enabled!==false,roles:Array.isArray(config.roles)?config.roles:[]};
}
async function finish(clientRef,id){
  await getDb();
  const drop=await giveaways.findOne({_id:new ObjectId(id),status:"active"});
  if(!drop)return;
  if(Date.now()<Number(drop.endsAt)){schedule(clientRef,drop);return;}
  timers.delete(String(drop._id));
  const pool=[];
  for(const [userId,entry] of Object.entries(drop.entries||{})){
    const tickets=Math.max(1,Math.min(1001,Number(entry.tickets)||1));
    for(let i=0;i<tickets;i++)pool.push(userId);
  }
  const winners=[];
  while(pool.length&&winners.length<drop.winnerCount){
    const picked=pool[Math.floor(Math.random()*pool.length)];
    if(!winners.includes(picked))winners.push(picked);
    for(let i=pool.length-1;i>=0;i--)if(pool[i]===picked)pool.splice(i,1);
  }
  await giveaways.updateOne({_id:drop._id,status:"active"},{$set:{status:"ended",winners,endedAt:Date.now()}});
  const channel=await clientRef.channels.fetch(drop.channelId).catch(()=>null);
  const message=channel?await channel.messages.fetch(drop.messageId).catch(()=>null):null;
  if(message)await message.edit({embeds:[makeEmbed({...drop,status:"ended"},true,winners)],components:[makeRow(id,true)]}).catch(()=>{});
  if(channel&&winners.length)await channel.send({content:"🌸 Parabéns aos ganhadores do drop **"+drop.prize+"**: "+winners.map(id=>"<@"+id+">").join(", ")+"!",allowedMentions:{users:winners}}).catch(()=>{});
  if(drop.dmWinners){
    for(const userId of winners){
      const user=await clientRef.users.fetch(userId).catch(()=>null);
      if(user)await user.send("🌸 Você ganhou o drop **"+drop.prize+"** no servidor **"+drop.guildName+"**!").catch(()=>{});
    }
  }
}
const timers=new Map();
function schedule(clientRef,drop){
  const old=timers.get(String(drop._id));if(old)clearTimeout(old);
  const delay=Math.max(0,Number(drop.endsAt)-Date.now());
  const timer=setTimeout(()=>finish(clientRef,String(drop._id)).catch(e=>console.error("[Drop] Falha ao encerrar:",e)),Math.min(delay,2147483647));
  timer.unref?.();timers.set(String(drop._id),timer);
}
async function initialize(clientRef){
  await getDb();
  const active=await giveaways.find({status:"active"}).toArray();
  for(const drop of active)schedule(clientRef,drop);
}
async function create(clientRef,{guild,channel,creator,tempo,winnerCount,prize}){
  await getDb();
  const config=await getConfig(guild.id);
  if(!config.enabled||!config.roles.length)throw new Error("Configure e salve os cargos participantes no painel do sistema de drop antes de iniciar um drop.");
  const now=Date.now(),endsAt=now+tempo;
  const drop={guildId:guild.id,guildName:guild.name,channelId:channel.id,messageId:null,creatorId:creator.id,prize,winnerCount,createdAt:now,endsAt,status:"active",entries:{},roles:config.roles,dmWinners:false};
  const result=await giveaways.insertOne(drop);
  const id=String(result.insertedId);
  try{
    const message=await channel.send({embeds:[makeEmbed(drop)],components:[makeRow(id)],allowedMentions:{parse:[]}});
    await giveaways.updateOne({_id:result.insertedId},{$set:{messageId:message.id}});
    drop.messageId=message.id;drop._id=result.insertedId;schedule(clientRef,drop);
    return {id,message};
  }catch(error){await giveaways.deleteOne({_id:result.insertedId});throw error;}
}
async function join(interaction,id){
  await getDb();
  const drop=await giveaways.findOne({_id:new ObjectId(id),status:"active"});
  if(!drop)return interaction.reply({content:"🌙 Este drop já foi encerrado ou não está mais disponível.",ephemeral:true});
  if(Date.now()>=drop.endsAt){await finish(interaction.client,id);return interaction.reply({content:"🌙 O tempo deste drop acabou.",ephemeral:true});}
  const member=await interaction.guild.members.fetch(interaction.user.id).catch(()=>null);
  if(!member)return interaction.reply({content:"❄️ Não consegui localizar seu membro no servidor.",ephemeral:true});
  const roles=Array.isArray(drop.roles)?drop.roles:[];
  if(roles.length&&!roles.some(rule=>member.roles.cache.has(String(rule.id)))){
    return interaction.reply({content:"🫧 Você não possui um dos cargos permitidos para participar deste drop.",ephemeral:true});
  }
  const extra=roles.filter(rule=>member.roles.cache.has(String(rule.id))).reduce((sum,rule)=>sum+Math.max(0,Math.min(1000,Number(rule.extras)||0)),0);
  const tickets=1+extra;
  await giveaways.updateOne({_id:drop._id,status:"active"},{$set:{["entries."+interaction.user.id]:{tickets,joinedAt:Date.now()}}});
  return interaction.reply({content:"🎁 Você está participando! Suas chances foram registradas com **"+tickets+" entrada(s)**.",ephemeral:true});
}
module.exports={create,join,initialize,finish};
