"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");
const { PermissionFlagsBits } = require("discord.js");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "temporary-roles.json");
const DAY_MS = 86400000;
const WARNING_MS = DAY_MS;
const URI = (process.env.MONGODB_URI || "").trim();
const ENABLED = (process.env.MONGODB_ENABLED || "false").trim().toLowerCase() === "true";
const DB_NAME = (process.env.MONGODB_DB || "Yukina").trim();
let mongo = null, collection = null, initPromise = null, records = [], clientRef = null, running = false;
function loadLocal() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); if (fs.existsSync(DATA_FILE)) { const d=JSON.parse(fs.readFileSync(DATA_FILE,"utf8")); if(Array.isArray(d.records)) records=d.records; } }
  catch(e) { console.error("[Cargos temporários] Falha lendo arquivo local:",e.message); }
}
function saveLocal() { fs.mkdirSync(DATA_DIR,{recursive:true}); const t=DATA_FILE+".tmp"; fs.writeFileSync(t,JSON.stringify({records},null,2)); fs.renameSync(t,DATA_FILE); }
async function initialize() {
  if(initPromise) return initPromise;
  initPromise=(async()=> {
    loadLocal();
    if(ENABLED && URI) {
      try { mongo=new MongoClient(URI,{appName:"Yukina-TemporaryRoles",serverSelectionTimeoutMS:10000,connectTimeoutMS:10000,maxPoolSize:5}); await mongo.connect(); const db=mongo.db(DB_NAME); await db.command({ping:1}); collection=db.collection("temporary_roles"); await collection.createIndex({guildId:1,userId:1,roleId:1}); await collection.createIndex({expiresAt:1}); console.log("[Cargos temporários] MongoDB conectado."); }
      catch(e) { console.error("[Cargos temporários] MongoDB indisponível; usando arquivo local:",e.message); if(mongo) await mongo.close().catch(()=>{}); mongo=null; collection=null; }
    } else console.warn("[Cargos temporários] MongoDB desativado/não configurado; arquivo local pode não sobreviver a reinicializações do Render.");
  })();
  return initPromise;
}
const filter=(g,u,r)=>({guildId:String(g),userId:String(u),roleId:String(r),removedAt:{$exists:false}});
async function findActive(g,u,r) { await initialize(); return collection ? collection.findOne(filter(g,u,r)) : records.find(x=>x.guildId===String(g)&&x.userId===String(u)&&x.roleId===String(r)&&!x.removedAt)||null; }
async function createOrRenew(r) {
  await initialize();
  const d={...r,guildId:String(r.guildId),userId:String(r.userId),roleId:String(r.roleId),expiresAt:Number(r.expiresAt),warningSentAt:null,createdAt:Date.now(),renewedAt:Date.now()};
  if(collection) { await collection.updateOne(filter(d.guildId,d.userId,d.roleId),{$set:d,$unset:{removedAt:"",expiredAt:""}},{upsert:true}); return d; }
  const i=records.findIndex(x=>x.guildId===d.guildId&&x.userId===d.userId&&x.roleId===d.roleId&&!x.removedAt); if(i>=0) records[i]=d; else records.push(d); saveLocal(); return d;
}
async function due(now) {
  await initialize();
  if(collection) return collection.find({removedAt:{$exists:false},$or:[{warningSentAt:null,expiresAt:{$gt:now,$lte:now+WARNING_MS}},{expiresAt:{$lte:now}}]}).limit(500).toArray();
  return records.filter(x=>!x.removedAt&&((x.warningSentAt==null&&x.expiresAt>now&&x.expiresAt<=now+WARNING_MS)||x.expiresAt<=now)).slice(0,500);
}
async function mark(record, fields) {
  if(collection) await collection.updateOne({_id:record._id},{$set:fields});
  else { const x=records.find(y=>y.guildId===record.guildId&&y.userId===record.userId&&y.roleId===record.roleId&&!y.removedAt); if(x) Object.assign(x,fields); saveLocal(); }
}
async function check() {
  if(!clientRef||running) return; running=true;
  try {
    for(const r of await due(Date.now())) {
      const guild=clientRef.guilds.cache.get(String(r.guildId))||await clientRef.guilds.fetch(String(r.guildId)).catch(()=>null); if(!guild) continue;
      if(r.expiresAt<=Date.now()) {
        const member=await guild.members.fetch(String(r.userId)).catch(()=>null);
        const role=await guild.roles.fetch(String(r.roleId)).catch(()=>null);
        if(member?.roles.cache.has(String(r.roleId))) {
          const bot=guild.members.me||await guild.members.fetchMe().catch(()=>null);
          if(!role||role.managed||!bot?.permissions.has(PermissionFlagsBits.ManageRoles)||role.position>=bot.roles.highest.position) { console.error("[Cargos temporários] Cargo vencido não removido: confira permissão/hierarquia."); continue; }
          try { await member.roles.remove(role,"Cargo temporário expirado pela Yukina"); } catch(e) { console.error("[Cargos temporários] Falha removendo cargo:",e.message); continue; }
        }
        await mark(r,{removedAt:Date.now(),expiredAt:Date.now()}); continue;
      }
      if(r.warningSentAt==null&&r.expiresAt<=Date.now()+WARNING_MS) {
        const member=await guild.members.fetch(String(r.userId)).catch(()=>null);
        if(!member) { await mark(r,{warningSentAt:Date.now()}); continue; }
        const ts=Math.floor(r.expiresAt/1000);
        try {
          await member.send({embeds:[{color:0xA7D8F0,title:"⏳ Seu cargo está chegando ao fim",description:"Olá! O cargo **"+String(r.roleName||"temporário")+"** que você recebeu no servidor **"+guild.name+"** está chegando ao fim.\n\n《📅》**Vencimento:** <t:"+ts+":F> (<t:"+ts+":R>)\n《❄️》**Para continuar com ele:** entre no servidor, procure a equipe e solicite a renovação antes do vencimento. A Yukina não renova automaticamente sem autorização da equipe.",footer:{text:"Yukina · Cuidando deste cantinho"}}]});
        } catch { console.warn("[Cargos temporários] DM de vencimento indisponível."); }
        await mark(r,{warningSentAt:Date.now()});
      }
    }
  } catch(e) { console.error("[Cargos temporários] Erro verificando vencimentos:",e.message); }
  finally { running=false; }
}
function start(client) { clientRef=client; const begin=async()=>{await initialize(); await check(); const timer=setInterval(()=>void check(),60000); timer.unref?.(); console.log("[Cargos temporários] Avisos e vencimentos ativados.");}; if(client.isReady()) void begin(); else client.once("clientReady",()=>void begin()); }
module.exports={start,initialize,findActive,createOrRenew};
