"use strict";

const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const memberData = require("../member-data");
const profileStorage = require("../system-storage").forSystem("user-profiles");
const { getVipCollection } = require("../vip-store");

const W = 230, H = 180, SCALE = 3, MAX_ABOUT = 120;
const PLAN_NAMES = { starter: "Starter", plus: "Plus", premium: "Premium", ultra: "Ultra", infinity: "Infinity" };

function levelForXp(xp) { return Math.floor(Math.max(0, Number(xp) || 0) / 1000) + 1; }
async function activePlan(userId) {
  try {
    const col = await getVipCollection();
    const subs = await col.find({ userId: String(userId), status: "active", expiresAt: { $gt: new Date() } }).toArray();
    const weight = { starter: 1, plus: 2, premium: 3, ultra: 4, infinity: 5 };
    const best = subs.filter(s => weight[String(s.planKey || "").toLowerCase()]).sort((a,b) => weight[String(b.planKey).toLowerCase()] - weight[String(a.planKey).toLowerCase()])[0];
    return best ? PLAN_NAMES[String(best.planKey).toLowerCase()] : null;
  } catch (e) { console.error("[Perfil] Falha ao consultar VIP:", e.message); return null; }
}
function rounded(ctx,x,y,w,h,r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function fit(ctx,text,max,font) {
  let size = 9;
  while (size > 6) { ctx.font = "bold " + size + "px sans-serif"; if (ctx.measureText(text).width <= max) break; size--; }
  return ctx.font;
}
async function render(user, xp, plan, profile) {
  const canvas = createCanvas(W*SCALE,H*SCALE), ctx = canvas.getContext("2d");
  ctx.scale(SCALE,SCALE);
  const gradient = ctx.createLinearGradient(0,0,W,H);
  gradient.addColorStop(0,"#101a38"); gradient.addColorStop(.52,"#29466e"); gradient.addColorStop(1,"#815b91");
  ctx.fillStyle = gradient; ctx.fillRect(0,0,W,H);
  // Fundo cosmético: a seleção de itens comprados será conectada à loja quando o inventário estiver disponível.
  const glow = ctx.createRadialGradient(184,18,2,184,18,95);
  glow.addColorStop(0,"rgba(255,210,241,.32)"); glow.addColorStop(1,"rgba(255,210,241,0)");
  ctx.fillStyle=glow; ctx.fillRect(90,0,140,110);
  for(let i=0;i<24;i++){ctx.beginPath();ctx.arc((i*43+17)%W,(i*31+9)%H,i%4===0?1:.55,0,Math.PI*2);ctx.fillStyle="rgba(238,245,255,.75)";ctx.fill();}
  rounded(ctx,3,3,224,174,10); ctx.fillStyle="rgba(7,13,31,.72)"; ctx.fill(); ctx.strokeStyle="rgba(222,220,255,.7)";ctx.lineWidth=.8;ctx.stroke();

  // Avatar e identificação.
  ctx.save(); ctx.beginPath();ctx.arc(31,35,22,0,Math.PI*2);ctx.clip();
  try { const av=await loadImage(user.displayAvatarURL({extension:"png",size:128}));ctx.drawImage(av,9,13,44,44); }
  catch { ctx.fillStyle="#54739c";ctx.fillRect(9,13,44,44); }
  ctx.restore();ctx.beginPath();ctx.arc(31,35,22.5,0,Math.PI*2);ctx.strokeStyle="#d8c8ff";ctx.lineWidth=1.4;ctx.stroke();

  const name=String(user.globalName||user.username||"Aventureiro").replace(/[\u0000-\u001f]/g,"").slice(0,32);
  ctx.fillStyle="#aeeaff";ctx.font="bold 7px sans-serif";ctx.fillText("YUKINA  ✦  PERFIL",62,19);
  ctx.fillStyle="#fff";ctx.font=fit(ctx,name,122);ctx.fillText(name,62,34,122);
  const level=levelForXp(xp);
  ctx.fillStyle="#f5d9f1";ctx.font="bold 7px sans-serif";ctx.fillText("XP " + Math.max(0,Number(xp)||0).toLocaleString("pt-BR") + "  •  NÍVEL " + level,62,46,125);
  if(plan){ctx.fillStyle="#ffdf9b";ctx.font="bold 7px sans-serif";ctx.fillText("PLANO " + plan.toUpperCase(),62,57,125);}
  ctx.fillStyle="#bcecff";ctx.font="bold 7px sans-serif";ctx.fillText("REPUTAÇÃO",177,18);
  ctx.fillStyle="#fff";ctx.font="bold 13px sans-serif";ctx.fillText("0",193,34);

  // Oito espaços reservados aos emblemas de conquistas selecionados pelo membro.
  const emblems=Array.isArray(profile.emblems)?profile.emblems.slice(0,8):[];
  for(let i=0;i<8;i++){
    const x=16,y=73+i*12;
    ctx.beginPath();ctx.arc(x,y,4.3,0,Math.PI*2);
    ctx.fillStyle=emblems[i]?"#f4d58e":"rgba(220,235,255,.13)";ctx.fill();
    ctx.strokeStyle=emblems[i]?"#fff0bf":"rgba(220,235,255,.55)";ctx.lineWidth=.7;ctx.stroke();
    if(emblems[i]){ctx.fillStyle="#49375c";ctx.font="bold 5px sans-serif";ctx.textAlign="center";ctx.fillText("✦",x,y+1.8);ctx.textAlign="left";}
  }
  // Área de imagem de fundo e sobre mim.
  rounded(ctx,29,68,188,76,6);ctx.fillStyle="rgba(30,43,75,.28)";ctx.fill();ctx.strokeStyle="rgba(220,230,255,.28)";ctx.stroke();
  if(profile.backgroundUrl && /^https:\/\//i.test(profile.backgroundUrl)){
    try{const bg=await loadImage(profile.backgroundUrl);ctx.save();rounded(ctx,29,68,188,76,6);ctx.clip();ctx.globalAlpha=.42;ctx.drawImage(bg,29,68,188,76);ctx.restore();}catch{}
  }
  rounded(ctx,29,149,188,22,5);ctx.fillStyle="rgba(7,12,28,.68)";ctx.fill();ctx.strokeStyle="rgba(240,210,245,.38)";ctx.stroke();
  ctx.fillStyle="#f7c7e8";ctx.font="bold 6px sans-serif";ctx.fillText("SOBRE MIM",36,158);
  const about=String(profile.about||"Ainda não escreveu sobre si.").replace(/\s+/g," ").slice(0,MAX_ABOUT);
  ctx.fillStyle="#fff";ctx.font="6.5px sans-serif";
  const words=about.split(" ");let line="",lines=[],maxWidth=170;
  for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
  if(line)lines.push(line);ctx.fillText(lines[0]||"",36,167,170);
  return canvas.toBuffer("image/png");
}
async function show(interaction,target,editable){
  await memberData.initialize();
  const record=memberData.getRecord(interaction.guild.id,target.id);
  const profile=await profileStorage.get("global","profile",{},target.id);
  const plan=await activePlan(target.id);
  const png=await render(target,record.xp,plan,profile||{});
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("yukina_profile_about:"+target.id).setLabel("Editar Sobre mim").setEmoji("✏️").setStyle(ButtonStyle.Secondary).setDisabled(!editable));
  return interaction.reply({files:[new AttachmentBuilder(png,{name:"yukina-perfil.png"})],components:[row],allowedMentions:{parse:[]}});
}
async function openAboutModal(interaction){
  const owner=interaction.customId.split(":")[1];
  if(interaction.user.id!==owner)return interaction.reply({content:"Esse perfil pertence a outra pessoa.",flags:MessageFlags.Ephemeral});
  const profile=await profileStorage.get("global","profile",{},owner)||{};
  const modal=new ModalBuilder().setCustomId("yukina_profile_about_modal:"+owner).setTitle("Editar Sobre mim");
  const field=new TextInputBuilder().setCustomId("about").setLabel("Conte um pouco sobre você").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(MAX_ABOUT).setPlaceholder("Escreva algo sobre você...").setValue(String(profile.about||""));
  modal.addComponents(new ActionRowBuilder().addComponents(field));
  return interaction.showModal(modal);
}
async function saveAbout(interaction){
  const owner=interaction.customId.split(":")[1];
  if(interaction.user.id!==owner)return interaction.reply({content:"Você não pode editar o perfil de outra pessoa.",flags:MessageFlags.Ephemeral});
  const about=interaction.fields.getTextInputValue("about").trim().slice(0,MAX_ABOUT);
  await profileStorage.update("global","profile",{about},owner);
  return interaction.reply({content:"🌸 Seu Sobre mim foi salvo! Use /perfil para ver a atualização.",flags:MessageFlags.Ephemeral});
}
module.exports={
 data:new SlashCommandBuilder().setName("perfil").setDescription("Mostra seu perfil personalizado na Yukina.").setDMPermission(false).addUserOption(o=>o.setName("membro").setDescription("Perfil de outro membro").setRequired(false)),
 aliases:["perfil"],
 async execute(interaction){
   if(!interaction.inGuild()||!interaction.guild)return interaction.reply({content:"❄️ Este comando só funciona dentro de um servidor.",flags:MessageFlags.Ephemeral});
   const target=interaction.options.getUser("membro")||interaction.user;
   try{return await show(interaction,target,target.id===interaction.user.id);}
   catch(e){console.error("[Yukina /perfil]",e);return interaction.reply({content:"💧 Não consegui gerar seu perfil agora. Verifique a conexão com o banco de dados e tente novamente.",flags:MessageFlags.Ephemeral}).catch(()=>{});}
 },
 async prefixExecute(message,args=[]){
   if(!message.guild)return message.reply("❄️ Este comando só funciona dentro de um servidor.");
   let target=message.mentions.users.first()||message.author;
   if(!message.mentions.users.first()&&args[0]&&/^\d{17,20}$/.test(args[0]))target=await message.client.users.fetch(args[0]).catch(()=>message.author);
   const fake={guild:message.guild,user:message.author,reply:payload=>message.channel.send(payload)};
   try{return await show(fake,target,target.id===message.author.id);}
   catch(e){console.error("[Yukina Yperfil]",e);return message.reply("💧 Não consegui gerar seu perfil agora.");}
 },
 async handleInteraction(interaction){
   if(interaction.isButton()&&interaction.customId.startsWith("yukina_profile_about:"))return openAboutModal(interaction);
   if(interaction.isModalSubmit()&&interaction.customId.startsWith("yukina_profile_about_modal:"))return saveAbout(interaction);
 }
};
