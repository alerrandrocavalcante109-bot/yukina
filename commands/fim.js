"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const MESSAGES = [
  "🌸 As pétalas deste momento começam a repousar... Obrigada por participarem! Que a sorte continue caminhando ao lado de vocês.",
  "🌙 A lua acompanhou cada instante deste pequeno evento. Espero que tenham aproveitado essa jornada com a Yukina!",
  "❄️ Os flocos desta celebração estão se aquietando. Obrigada por fazerem parte desse momento tão especial!",
  "🎐 O vento leva consigo as emoções deste evento. Até a próxima aventura, meus queridos!",
  "🌸 Cada participação tornou este momento mais bonito. A Yukina agradece de coração pela companhia!",
  "✨ As luzes deste evento vão diminuindo devagar... mas novas surpresas ainda podem florescer por aqui!",
  "🐇 A raposinha da sorte já está descansando. Obrigada por compartilharem essa diversão comigo!",
  "🌙 Sob o luar, guardarei este momento com carinho. Nos vemos na próxima surpresa!",
  "❄️ A neve está cobrindo os últimos passos deste evento. Obrigada por participarem!",
  "🎎 Mais uma pequena celebração chega ao seu momento de pausa. Que venham muitas outras!",
  "🌸 As sakuras dançaram junto com vocês hoje. Agradeço por cada presença!",
  "💫 O brilho deste momento ficará guardado. Até nosso próximo encontro!",
  "🍡 Hora de guardar os docinhos e descansar um pouquinho. Obrigada pela diversão!",
  "🌌 A noite segue tranquila, e a Yukina agradece a companhia de todos nesta ocasião.",
  "🦊 A sorte fez sua visita por aqui! Obrigada por entrarem na brincadeira.",
  "🌷 Que este pequeno evento deixe uma lembrança bonita no coração de vocês. Até breve!",
  "☁️ As nuvens passam e levam o último instante desta atividade. Obrigada por estarem aqui!",
  "🌙 O sino do templo anuncia uma pausa. A Yukina espera encontrar vocês na próxima!",
  "❄️ Os últimos flocos caem suavemente... Foi muito bom compartilhar este momento com vocês!",
  "🎐 A brisa de hoje se despede levando boas lembranças. Até a próxima, pessoal!",
  "🌸 Mesmo quando um evento termina, novas histórias podem começar. Obrigada pela presença!",
  "✨ Foi uma alegria ter vocês por perto. Que a sorte sorria para todos nos próximos eventos!",
  "🍃 As folhas voltam a repousar. Agradeço por cada pessoa que participou desta atividade!",
  "🐾 A pequena jornada de hoje chega ao fim. A Yukina manda um abraço geladinho para todos!",
  "🌕 A lua já está alta e é hora de descansar. Obrigada por viverem este momento comigo!",
  "🎊 Que energia bonita vocês trouxeram! A Yukina agradece e espera vocês na próxima!",
  "🌸 As flores se recolhem por hoje, mas o jardim da Yukina ainda terá muitas novidades.",
  "🫧 Nossa brincadeira fez uma pausa por aqui. Obrigada por cada instante compartilhado!",
  "❄️ Guardem o calor deste momento, mesmo sob a neve. Até nossa próxima aventura!",
  "🌙 Com carinho e um último aceno, a Yukina se despede deste evento. Até logo!"
];
const SYSTEM_PROMPT = "Você escreve mensagens curtas em português brasileiro para a Yukina, uma bot de Discord com personalidade delicada, acolhedora e divertida. A estética mistura Japão, sakura, neve e luar. Crie uma mensagem de despedida/encerramento simbólico de um evento, drop ou sorteio. Não diga que o sorteio foi finalizado, não anuncie ganhadores e não afirme que o evento terminou de verdade. Preserve o sentido da inspiração. Use no máximo 2 emojis. Retorne somente a mensagem, sem aspas.";

function chooseMessage() {
  const index = Math.floor(Math.random() * MESSAGES.length);
  return { index, fallback: MESSAGES[index] };
}

async function generateWithAI(baseMessage) {
  const timeout = AbortSignal.timeout(9000);
  const prompt = SYSTEM_PROMPT + "\n\nUse esta inspiração sem copiá-la literalmente: " + baseMessage;

  if (process.env.GROQ_API_KEY) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + process.env.GROQ_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.YUKINA_GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
          temperature: 0.95,
          max_tokens: 120
        }),
        signal: timeout
      });
      if (!response.ok) throw new Error("Groq HTTP " + response.status);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return clean(text);
    } catch (error) {
      console.warn("[Yukina fim] Groq indisponível:", error.message);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.YUKINA_SITE_URL || "https://yukina.onrender.com",
          "X-Title": "Yukina Discord Bot"
        },
        body: JSON.stringify({
          model: process.env.YUKINA_OPENROUTER_MODEL || "openrouter/free",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
          temperature: 0.95,
          max_tokens: 120
        }),
        signal: timeout
      });
      if (!response.ok) throw new Error("OpenRouter HTTP " + response.status);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return clean(text);
    } catch (error) {
      console.warn("[Yukina fim] OpenRouter indisponível:", error.message);
    }
  }
  return baseMessage;
}

function clean(value) {
  return String(value)
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/@everyone|@here/g, "@\u200b$&".replace("@\u200b@", "@\u200b"))
    .slice(0, 1000)
    .trim();
}

async function run(channel, reply) {
  if (!channel?.isTextBased?.() || !channel.send) {
    return reply("❄️ Este canal não aceita mensagens.");
  }
  const selected = chooseMessage();
  const content = await generateWithAI(selected.fallback);
  try {
    await channel.send({ content, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Yukina fim] Falha ao enviar mensagem:", error);
    return reply("🫧 Não consegui enviar a mensagem neste canal. Verifique minhas permissões.");
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fim")
    .setDescription("Enviar uma mensagem especial de despedida da Yukina.")
    .setDMPermission(false),
  aliases: ["encerramento", "despedida"],
  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: "❄️ Este comando só funciona em um servidor.", ephemeral: true });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "🌙 Você precisa da permissão **Gerenciar mensagens** ou **Gerenciar servidor**.", ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    await run(interaction.channel, content => interaction.editReply(content));
    if (!interaction.replied) return interaction.editReply("🌸 Mensagem enviada!");
    return interaction.editReply("🌸 Mensagem de despedida enviada!");
  },
  async prefixExecute(message) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona em um servidor.");
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) &&
        !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("🌙 Você precisa da permissão **Gerenciar mensagens** ou **Gerenciar servidor**.");
    }
    return run(message.channel, content => message.reply(content));
  }
};
