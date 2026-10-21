"use strict";
const {
  SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder
} = require("discord.js");
const { createCanvas } = require("@napi-rs/canvas");

const games = new Map();
const dominoes = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) dominoes.push({ a, b, id: `${a}-${b}` });
const tileText = t => `[${t.a} | ${t.b}]`;
const shuffle = arr => { const out=[...arr]; for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };

function drawHalf(ctx, value, x, y, size) {
  const p = size / 4;
  const spots = {
    0: [],
    1: [[2,2]],
    2: [[1,1],[3,3]],
    3: [[1,1],[2,2],[3,3]],
    4: [[1,1],[1,3],[3,1],[3,3]],
    5: [[1,1],[1,3],[2,2],[3,1],[3,3]],
    6: [[1,1],[1,2],[1,3],[3,1],[3,2],[3,3]]
  };
  ctx.fillStyle = "#182235";
  for (const [cx, cy] of spots[value]) {
    ctx.beginPath();
    ctx.arc(x + cx * p, y + cy * p, Math.max(3, size * 0.055), 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderTiles(tiles, title = "YUKINA • DOMINÓ") {
  const perRow = 6, tileW = 126, tileH = 58, gap = 14, pad = 28, header = 62;
  const rows = Math.max(1, Math.ceil(tiles.length / perRow));
  const width = pad * 2 + perRow * tileW + (perRow - 1) * gap;
  const height = header + pad + rows * tileH + (rows - 1) * gap + pad;
  const canvas = createCanvas(width, height), ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#101827"); bg.addColorStop(1, "#24334a");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#9edfff"; ctx.font = "bold 25px sans-serif"; ctx.fillText(title, pad, 40);
  if (!tiles.length) {
    ctx.fillStyle = "#e7edf5"; ctx.font = "20px sans-serif";
    ctx.fillText("A mesa está vazia — aguardando a primeira peça!", pad, header + 40);
  }
  // Desenha a sequência inteira em zigue-zague, com a primeira peça no centro.
  const cols = Math.min(perRow, Math.max(1, tiles.length));
  const startCol = Math.floor((perRow - cols) / 2);
  tiles.forEach((tile, i) => {
    const row = Math.floor(i / perRow), pos = i % perRow;
    const col = startCol + (row % 2 ? cols - 1 - pos : pos);
    const x = pad + col * (tileW + gap), y = header + row * (tileH + gap);
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.roundRect(x, y, tileW, tileH, 9); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + tileW / 2, y + 8); ctx.lineTo(x + tileW / 2, y + tileH - 8); ctx.stroke();
    drawHalf(ctx, tile.a, x + 4, y + 2, tileH - 4);
    drawHalf(ctx, tile.b, x + tileW / 2 + 4, y + 2, tileH - 4);
    if (i < tiles.length - 1) {
      ctx.strokeStyle = "#9edfff"; ctx.lineWidth = 3;
      const nextRow = Math.floor((i + 1) / perRow);
      if (nextRow === row) {
        const dir = row % 2 ? -1 : 1;
        const edgeX = dir > 0 ? x + tileW + 3 : x - 3;
        ctx.beginPath(); ctx.moveTo(edgeX, y + tileH / 2); ctx.lineTo(edgeX + dir * (gap - 6), y + tileH / 2); ctx.stroke();
      } else {
        const nextRowCol = startCol + ((row + 1) % 2 ? cols - 1 : 0) * 1;
        const targetX = pad + nextRowCol * (tileW + gap) + tileW / 2;
        ctx.beginPath(); ctx.moveTo(x + tileW / 2, y + tileH + 2); ctx.lineTo(targetX, y + tileH + gap - 2); ctx.stroke();
      }
    }
  });
  return canvas.toBuffer("image/png");
}
function boardContainer(game, notice = "") {
  const body = [
    "# 🎲 Domino • Yukina",
    notice,
    "**Última peça jogada**",
    `**Peças na mesa:** ${game.board.length}`,
    "",
    `**Vez:** <@${game.players[game.turn]}>`,
    "**Peças restantes:**",
    game.players.map(id => `<@${id}> — ${game.hands[id].length} peça(s)`).join("\n"),
    "",
    "_Use “Ver minhas peças” para abrir sua mão privada._"
  ].filter(Boolean).join("\n");
  return new ContainerBuilder()
    .setAccentColor(0x9edfff)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL("attachment://domino-board.png").setDescription(game.lastPlayed ? `Mesa completa; última peça: ${game.lastPlayed.a} e ${game.lastPlayed.b}` : "Mesa de dominó — aguardando a primeira peça")
    ))
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
  const shuffled=shuffle(dominoes), hands={};
  const perPlayer=ids.length===2?7:ids.length===3?6:5;
  ids.forEach((id,i)=>hands[id]=shuffled.slice(i*perPlayer,(i+1)*perPlayer));
  const game={id:Math.random().toString(36).slice(2,9),guildId:channel.guild.id,channelId:channel.id,players:ids,hands,board:[],lastPlayed:null,turn:ids[0],turnIndex:0,passes:0,startedBy:starterId,messageId:null};
  games.set(game.id,game);
  const attachment = new AttachmentBuilder(renderTiles([], "YUKINA • MESA DE DOMINÓ"), { name:"domino-board.png" });
  const msg=await channel.send({components:[boardContainer(game, ids.map(id=>`<@${id}>`).join(" ")+ " — a partida começou!")],files:[attachment],flags:MessageFlags.IsComponentsV2,allowedMentions:{users:ids}});
  game.messageId=msg.id;
  return game;
}
async function showHand(interaction,game) {
  const hand=game.hands[interaction.user.id];
  if(!hand) return interaction.reply({content:"Você não está nesta partida.",flags:MessageFlags.Ephemeral});
  const menu=new StringSelectMenuBuilder().setCustomId(`domino:tile:${game.id}`).setPlaceholder("Escolha uma peça para jogar").setMinValues(1).setMaxValues(1)
    .addOptions(hand.map(t=>({label:`${t.a} | ${t.b}`,description:`Peça ${t.a} e ${t.b}`,value:t.id,emoji:"🎲"})));
  const image = new AttachmentBuilder(renderTiles(hand, "YUKINA • SUA MÃO"), { name:"domino-hand.png" });
  return interaction.reply({content:"🀄 **Suas peças — apenas você pode ver**\nEscolha uma peça no menu para tentar jogá-la na mesa.",files:[image],components:[new ActionRowBuilder().addComponents(menu)],flags:MessageFlags.Ephemeral});
}
async function playTile(interaction,game,tileId) {
  if(!game.players.includes(interaction.user.id)) return interaction.reply({content:"Você não está nesta partida.",flags:MessageFlags.Ephemeral});
  if(game.turn!==interaction.user.id) return interaction.reply({content:"Ainda não é sua vez.",flags:MessageFlags.Ephemeral});
  const hand=game.hands[interaction.user.id], index=hand.findIndex(t=>t.id===tileId);
  if(index<0) return interaction.reply({content:"Essa peça não está mais na sua mão.",flags:MessageFlags.Ephemeral});
  const tile=hand[index], left=game.board[0]?.a, right=game.board.at(-1)?.b;
  let placed={...tile};
  if(game.board.length) {
    if(tile.a!==left&&tile.b!==left&&tile.a!==right&&tile.b!==right) return interaction.reply({content:`Essa peça não encaixa. As pontas abertas são **${left}** e **${right}**.`,flags:MessageFlags.Ephemeral});
    if(tile.a===left) { placed={a:tile.b,b:tile.a,id:tile.id}; game.board.unshift(placed); }
    else if(tile.b===left) game.board.unshift(placed);
    else if(tile.a===right) game.board.push(placed);
    else { placed={a:tile.b,b:tile.a,id:tile.id}; game.board.push(placed); }
  } else game.board.push(placed);
  hand.splice(index,1); game.passes=0; game.lastPlayed={...placed};
  await interaction.deferUpdate();
  const channel=await interaction.client.channels.fetch(game.channelId);
  const boardMessage=await channel.messages.fetch(game.messageId);
  if(!hand.length) {
    games.delete(game.id);
    const winnerBody = `# 🏆 Domino • Yukina\n<@${interaction.user.id}> venceu o Domino!\n\n${game.players.map(id=>`<@${id}> — ${game.hands[id].length} peça(s)`).join("\n")}`;
    await boardMessage.edit({components:[new ContainerBuilder().setAccentColor(0x9edfff).addTextDisplayComponents(new TextDisplayBuilder().setContent(winnerBody)).addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL("attachment://domino-board.png").setDescription(`Mesa completa; última peça: ${game.lastPlayed.a} e ${game.lastPlayed.b}`)))],files:[new AttachmentBuilder(renderTiles(game.board, "YUKINA • MESA FINAL"), {name:"domino-board.png"})],flags:MessageFlags.IsComponentsV2,allowedMentions:{users:game.players}});
    await interaction.followUp({content:"🏆 Você jogou sua última peça e venceu!",flags:MessageFlags.Ephemeral}).catch(()=>{});
    return;
  }
  game.turnIndex=(game.turnIndex+1)%game.players.length; game.turn=game.players[game.turnIndex];
  await boardMessage.edit({components:[boardContainer(game, `🎲 <@${interaction.user.id}> jogou ${tileText(placed)}.`)],files:[new AttachmentBuilder(renderTiles(game.board, "YUKINA • MESA DE DOMINÓ"), {name:"domino-board.png"})],flags:MessageFlags.IsComponentsV2,allowedMentions:{users:game.players}});
  await interaction.followUp({content:`Você jogou ${tileText(placed)} na mesa.`,flags:MessageFlags.Ephemeral}).catch(()=>{});
}
async function handleInteraction(interaction) {
  const id=interaction.customId||"";
  if(!id.startsWith("domino:")) return;
  const [,action,gameId]=id.split(":");
  const game=games.get(gameId);
  if(!game) return interaction.reply({content:"Esta partida não está mais ativa.",flags:MessageFlags.Ephemeral}).catch(()=>{});
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
    return interaction.reply({content:`🎲 Partida de Domino criada! Código: ${game.id}`,flags:MessageFlags.Ephemeral});
  },
  async prefixExecute(message,args) {
    const mentions=message.mentions.users.filter(u=>!u.bot).map(u=>u.id).filter(id=>id!==message.author.id);
    const game=await start(message.channel,message.author.id,mentions);
    return message.reply(`🎲 Partida de Domino criada! Código: ${game.id}`);
  },
  handleInteraction
};
