"use strict";
const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");

const games = new Map();
const dominoes = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) dominoes.push({ a, b, id: `${a}-${b}` });
const dots = ["⚪","⚫","🔵","🔴","🟢","🟣","🟡"];
const tileText = t => `[${dots[t.a]} ${t.a} │ ${t.b} ${dots[t.b]}]`;
const shuffle = arr => { const out=[...arr]; for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };
function boardContainer(game, notice = "") {
  const board = game.board.length ? game.board.map(t => tileText(t)).join("  ") : "_A mesa ainda está vazia. Jogue qualquer peça para começar._";
  const body = [
    "# 🎲 Domino • Yukina",
    notice,
    "**Mesa**",
    board,
    "",
    `**Vez:** <@${game.players[game.turn]}>`,
    "**Peças restantes:**",
    game.players.map(id => `<@${id}> — ${game.hands[id].length} peça(s)`).join("\\n"),
    "",
    "_Use “Ver minhas peças” para abrir sua mão privada._"
  ].filter(Boolean).join("\\n");
  return new ContainerBuilder()
    .setAccentColor(0x9edfff)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(controls(game));
}
function controls(game) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`domino:hand:${game.id}`).setLabel("Ver minhas peças").setEmoji("🀄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`domino:play:${game.id}`).setLabel("Jogar").setEmoji("🎲").setStyle(ButtonStyle.Primary)
  );
}
async function start(channel, starterId, mentions) {
  const ids=[...new Set([starterId,...mentions])].slice(0,4);
  if(ids.length<1||ids.length>4) throw new Error("O Domino precisa de 1 a 4 pessoas.");
  const shuffled=shuffle(dominoes);
  const hands={};
  const perPlayer=ids.length===2?7:ids.length===3?6:5;
  ids.forEach((id,i)=>hands[id]=shuffled.slice(i*perPlayer,(i+1)*perPlayer));
  const game={id:Math.random().toString(36).slice(2,9),guildId:channel.guild.id,channelId:channel.id,players:ids,hands,board:[],turn:ids[0],turnIndex:0,passes:0,startedBy:starterId,messageId:null};
  games.set(game.id,game);
  const msg=await channel.send({components:[boardContainer(game, ids.map(id=>`<@${id}>`).join(" ")+" — a partida começou!")],flags:MessageFlags.IsComponentsV2,allowedMentions:{users:ids}});
  game.messageId=msg.id;
  return game;
}
async function showHand(interaction,game) {
  const hand=game.hands[interaction.user.id];
  if(!hand) return interaction.reply({content:"Você não está nesta partida.",ephemeral:true});
  const menu=new StringSelectMenuBuilder().setCustomId(`domino:tile:${game.id}`).setPlaceholder("Escolha uma peça para jogar").setMinValues(1).setMaxValues(1)
    .addOptions(hand.map(t=>({label:`${t.a} | ${t.b}`,description:`Peça ${t.a} e ${t.b}`,value:t.id,emoji:"🎲"})));
  return interaction.reply({content:`🀄 **Suas peças — apenas você pode ver**\n${hand.map(tileText).join("   ")}\n\nEscolha uma peça no menu para tentar jogá-la na mesa.`,components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true});
}
async function playTile(interaction,game,tileId) {
  if(!game.players.includes(interaction.user.id)) return interaction.reply({content:"Você não está nesta partida.",ephemeral:true});
  if(game.turn!==interaction.user.id) return interaction.reply({content:"Ainda não é sua vez.",ephemeral:true});
  const hand=game.hands[interaction.user.id];
  const index=hand.findIndex(t=>t.id===tileId);
  if(index<0) return interaction.reply({content:"Essa peça não está mais na sua mão.",ephemeral:true});
  const tile=hand[index], left=game.board[0]?.a, right=game.board.at(-1)?.b;
  let placed={...tile};
  if(game.board.length) {
    if(tile.a!==left&&tile.b!==left&&tile.a!==right&&tile.b!==right) return interaction.reply({content:`Essa peça não encaixa. As pontas abertas são **${left}** e **${right}**.`,ephemeral:true});
    if(tile.a===left) { game.board.unshift(placed); }
    else if(tile.b===left) { placed={a:tile.b,b:tile.a,id:tile.id}; game.board.unshift(placed); }
    else if(tile.a===right) game.board.push(placed);
    else { placed={a:tile.b,b:tile.a,id:tile.id}; game.board.push(placed); }
  } else game.board.push(placed);
  hand.splice(index,1); game.passes=0;
  if(!hand.length) {
    games.delete(game.id);
    await interaction.deferUpdate();
    const channel=await interaction.client.channels.fetch(game.channelId);
    const boardMessage=await channel.messages.fetch(game.messageId);
    await boardMessage.edit({components:[new ContainerBuilder().setAccentColor(0x9edfff).addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🏆 Domino • Yukina\\n<@${interaction.user.id}> venceu o Domino!\\n\\n${game.players.map(id=>`<@${id}> — ${game.hands[id].length} peça(s)`).join("\\n")}`))],flags:MessageFlags.IsComponentsV2,allowedMentions:{users:game.players}});
    await interaction.followUp({content:"🏆 Você jogou sua última peça e venceu!",ephemeral:true}).catch(()=>{});
    return;
  }
  game.turnIndex=(game.turnIndex+1)%game.players.length;game.turn=game.players[game.turnIndex];
  await interaction.deferUpdate();
  const channel=await interaction.client.channels.fetch(game.channelId);
  const boardMessage=await channel.messages.fetch(game.messageId);
  await boardMessage.edit({components:[boardContainer(game, `🎲 <@${interaction.user.id}> jogou ${tileText(placed)}.`)],flags:MessageFlags.IsComponentsV2,allowedMentions:{users:game.players}});
  await interaction.followUp({content:`Você jogou ${tileText(placed)} na mesa.`,ephemeral:true}).catch(()=>{});
}
async function handleInteraction(interaction) {
  const id=interaction.customId||"";
  if(!id.startsWith("domino:")) return;
  const [,action,gameId]=id.split(":");
  const game=games.get(gameId);
  if(!game) return interaction.reply({content:"Esta partida não está mais ativa.",ephemeral:true}).catch(()=>{});
  if(action==="hand"||action==="play") return showHand(interaction,game);
  if(action==="tile") return playTile(interaction,game,interaction.values?.[0]);
}
module.exports = {
  data:new SlashCommandBuilder().setName("domino").setDescription("Inicie uma partida de domino com 1 a 4 pessoas.")
    .addUserOption(o=>o.setName("usar").setDescription("Primeira pessoa para jogar").setRequired(false))
    .addUserOption(o=>o.setName("usar2").setDescription("Segunda pessoa para jogar").setRequired(false))
    .addUserOption(o=>o.setName("usar3").setDescription("Terceira pessoa para jogar").setRequired(false))
    .addUserOption(o=>o.setName("usar4").setDescription("Quarta pessoa para jogar").setRequired(false)),
  async execute(interaction) {
    const users=[1,2,3,4].map(n=>interaction.options.getUser(n===1?"usar":`usar${n}`)).filter(Boolean).map(u=>u.id);
    const game=await start(interaction.channel,interaction.user.id,users);
    return interaction.reply({content:`🎲 Partida de Domino criada! Código: ${game.id}`,ephemeral:true});
  },
  async prefixExecute(message,args) {
    const mentions=message.mentions.users.filter(u=>!u.bot).map(u=>u.id).filter(id=>id!==message.author.id);
    const game=await start(message.channel,message.author.id,mentions);
    return message.reply(`🎲 Partida de Domino criada! Código: ${game.id}`);
  },
  handleInteraction
};
