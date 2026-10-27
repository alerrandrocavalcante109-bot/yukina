"use strict";

const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const WIDTH = 1000;
const HEIGHT = 420;
const COLORS = ["#f6b8d4", "#c8b8ff", "#a9e8ff"];

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.closePath();
}

function hashPair(a, b) {
  const key = [String(a), String(b)].sort().join(":");
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function compatibility(a, b) {
  // A porcentagem permanece igual para o mesmo par, evitando mudanças injustas a cada uso.
  return 50 + (hashPair(a, b) % 51);
}

async function drawAvatar(ctx, user, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 220, 240, 0.24)";
  ctx.fill();
  ctx.strokeStyle = "#ffe3f0";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  try {
    const avatar = await loadImage(user.displayAvatarURL({ extension: "png", size: 256 }));
    ctx.drawImage(avatar, x, y, size, size);
  } catch {
    ctx.fillStyle = "#927cae";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("?", x + size / 2, y + size / 2 + 18);
  }
  ctx.restore();
}

async function buildShipCard(first, second) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const score = compatibility(first.id, second.id);

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#241b3d");
  background.addColorStop(0.5, "#754c82");
  background.addColorStop(1, "#d889b5");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Brilho suave de luar e pétalas de sakura.
  const glow = ctx.createRadialGradient(500, 185, 12, 500, 185, 370);
  glow.addColorStop(0, "rgba(255, 230, 247, 0.28)");
  glow.addColorStop(1, "rgba(255, 230, 247, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < 55; i++) {
    const x = (i * 173 + 41) % WIDTH;
    const y = (i * 97 + 23) % HEIGHT;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i % 7) * 0.42);
    ctx.fillStyle = i % 2 ? "rgba(255, 223, 241, 0.72)" : "rgba(218, 232, 255, 0.65)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  roundedRect(ctx, 20, 20, WIDTH - 40, HEIGHT - 40, 30);
  ctx.fillStyle = "rgba(31, 21, 55, 0.58)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 229, 247, 0.48)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe6f4";
  ctx.font = "bold 19px sans-serif";
  ctx.fillText("YUKINA  ·  LAÇOS SOB O LUAR", WIDTH / 2, 62);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 37px sans-serif";
  ctx.fillText("Combinação do destino", WIDTH / 2, 108);

  await drawAvatar(ctx, first, 175, 135, 142);
  await drawAvatar(ctx, second, 683, 135, 142);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(first.globalName || first.username, 246, 305, 240);
  ctx.fillText(second.globalName || second.username, 754, 305, 240);

  // Coração central estilizado.
  ctx.fillStyle = "#ffb7db";
  ctx.font = "bold 92px sans-serif";
  ctx.fillText("♥", WIDTH / 2, 225);
  ctx.fillStyle = "#fff2fa";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(score + "%", WIDTH / 2, 276);

  roundedRect(ctx, 285, 323, 430, 18, 9);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fill();
  if (score > 0) {
    roundedRect(ctx, 285, 323, 430 * score / 100, 18, 9);
    const bar = ctx.createLinearGradient(285, 0, 715, 0);
    bar.addColorStop(0, COLORS[0]);
    bar.addColorStop(0.55, COLORS[1]);
    bar.addColorStop(1, COLORS[2]);
    ctx.fillStyle = bar;
    ctx.fill();
  }

  const phrase = score >= 90
    ? "Uma conexão digna das estrelas!"
    : score >= 75
      ? "As pétalas parecem aproximar vocês."
      : score >= 60
        ? "Pode nascer uma bela história."
        : score >= 45
          ? "Uma amizade pode florescer por aqui."
          : "O destino ainda guarda mistérios.";
  ctx.fillStyle = "#ffe8f5";
  ctx.font = "18px sans-serif";
  ctx.fillText(phrase, WIDTH / 2, 378);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "13px sans-serif";
  ctx.fillText("Diversão entre amigos · Yukina ❄", WIDTH / 2, 399);

  return { buffer: canvas.toBuffer("image/png"), score };
}

async function sendShip(reply, first, second) {
  const { buffer, score } = await buildShipCard(first, second);
  const attachment = new AttachmentBuilder(buffer, { name: "yukina-ship.png" });
  return reply({
    content: score >= 90
      ? "🌸 O destino está fazendo hora extra por vocês!"
      : score >= 70
        ? "💗 Yukina sente uma energia especial neste par..."
        : "❄️ Yukina consultou as estrelas. Será que esse laço vai florescer?",
    files: [attachment],
    allowedMentions: { parse: [] },
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Descubra a compatibilidade divertida entre duas pessoas.")
    .setDMPermission(false)
    .addUserOption(option => option.setName("pessoa1").setDescription("Primeira pessoa do ship.").setRequired(true))
    .addUserOption(option => option.setName("pessoa2").setDescription("Segunda pessoa do ship.").setRequired(false)),
  aliases: ["casal", "compatibilidade"],
  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true });
    }
    const first = interaction.options.getUser("pessoa1") || interaction.user;
    const second = interaction.options.getUser("pessoa2") || interaction.user;
    if (first.id === second.id) {
      return interaction.reply({ content: "🌸 Escolha duas pessoas diferentes para consultar as estrelas!", ephemeral: true });
    }
    try {
      return await sendShip(payload => interaction.reply(payload), first, second);
    } catch (error) {
      console.error("[Yukina /ship]", error);
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: "💧 As estrelas estão nubladas. Não consegui gerar o cartão agora.", ephemeral: true }).catch(() => {});
      }
      return interaction.reply({ content: "💧 As estrelas estão nubladas. Não consegui gerar o cartão agora.", ephemeral: true }).catch(() => {});
    }
  },
  async prefixExecute(message) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    const mentioned = [...message.mentions.users.values()];
    let first;
    let second;
    if (mentioned.length >= 2) {
      [first, second] = mentioned;
    } else if (mentioned.length === 1) {
      first = message.author;
      second = mentioned[0];
    } else {
      return message.reply("🌸 Mencione uma pessoa para formar o ship: `Yship @membro` ou duas: `Yship @pessoa1 @pessoa2`.");
    }
    if (first.id === second.id) return message.reply("🌸 Escolha duas pessoas diferentes para consultar as estrelas!");
    try {
      return await sendShip(payload => message.channel.send(payload), first, second);
    } catch (error) {
      console.error("[Yukina Yship]", error);
      return message.reply("💧 As estrelas estão nubladas. Não consegui gerar o cartão agora.").catch(() => {});
    }
  },
};
