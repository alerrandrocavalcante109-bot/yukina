"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require("discord.js");

const MESSAGES = [
  "🌸 As pétalas de sakura começam a repousar lentamente, mas a lembrança deste encontro ainda floresce. Obrigada por cada participação, cada reação e cada instante compartilhado; a Yukina espera encontrar todos novamente em uma próxima aventura.",
  "🌙 A luz tranquila da lua acompanha nossa despedida. Que este momento fique guardado como uma pequena lembrança bonita, e que vocês continuem espalhando alegria pelos cantinhos deste servidor até nossa próxima celebração.",
  "❄️ Os flocos de neve caem suavemente sobre este capítulo. A Yukina agradece de coração a todos que passaram por aqui e convida vocês a continuarem aproveitando os outros espaços da nossa comunidade.",
  "🎐 O vento atravessa as ruas de uma pequena vila japonesa e leva consigo os ecos desta brincadeira. Obrigada por fazerem parte dela; ainda há muitas conversas, risadas e surpresas esperando por vocês.",
  "🌸 Cada pessoa que apareceu deixou uma pétala neste jardim. Mesmo quando chega a hora de nos despedirmos de um momento, a comunidade continua viva e cheia de novas histórias para construir.",
  "✨ As lanternas começam a brilhar mais suavemente, como se estivessem desejando boa noite. A Yukina adorou dividir este instante com vocês e espera que continuem espalhando essa energia pelos canais do servidor.",
  "🦊 A pequena raposa da sorte já está seguindo seu caminho entre as cerejeiras. Obrigada por entrarem na brincadeira e por tornarem este encontro tão especial; nos vemos em uma próxima ocasião.",
  "🌌 Sob um céu salpicado de estrelas, deixamos esta pequena lembrança repousar. Que a noite seja gentil com todos e que vocês encontrem boas companhias nas próximas conversas.",
  "🍡 Até os docinhos do festival parecem mais gostosos quando compartilhados. A Yukina agradece a presença de cada um e deixa um convite carinhoso para continuarem aproveitando a companhia uns dos outros.",
  "⛩️ O sino do templo ecoa ao longe, anunciando apenas uma pausa em nossa pequena celebração. Levem consigo as boas lembranças e continuem explorando tudo o que nossa comunidade preparou.",
  "🌷 As flores se inclinam com a brisa da tarde, como um último aceno de carinho. Obrigada por participarem e por ajudarem a transformar uma simples atividade em um momento cheio de vida.",
  "💫 Toda aventura deixa pequenas estrelas pelo caminho. A Yukina guarda com carinho a energia de vocês e espera que novos encontros tragam ainda mais motivos para sorrir.",
  "🐾 Passinhos delicados seguem pela neve enquanto nossa despedida acontece. Obrigada por caminharem junto comigo neste momento; ainda temos muitos caminhos para percorrer dentro deste servidor.",
  "🌕 A lua está alta e ilumina o caminho de volta para casa. A Yukina deseja uma noite tranquila a todos e agradece por cada pessoa que dedicou um pouquinho do seu tempo a esta atividade.",
  "🎊 Que festival bonito foi compartilhar este instante com vocês! As lanternas podem descansar, mas a alegria continua nos encontros, nas conversas e nas próximas surpresas que ainda virão.",
  "🍃 As folhas de bordo dançam pelo caminho e nos lembram que cada estação traz algo novo. Obrigada por fazerem parte desta passagem; que a próxima venha acompanhada de boas notícias.",
  "🌸 O jardim da Yukina nunca fica vazio por muito tempo: sempre há uma nova flor, uma nova conversa e uma nova história surgindo. Obrigada por deixarem sua marca neste pequeno momento.",
  "☁️ As nuvens seguem devagar pelo céu, levando consigo o último aceno desta ocasião. Agradeço pela companhia de vocês e espero que encontrem bons momentos nos demais cantinhos da comunidade.",
  "🎎 Como em um festival de verão, cada presença tornou a noite mais colorida. A Yukina envia um abraço cheio de carinho e deseja que a próxima reunião seja ainda mais alegre.",
  "❄️ Mesmo com o frio da neve, momentos compartilhados aquecem o coração. Obrigada por estarem por perto e por contribuírem com a energia tão especial deste servidor.",
  "🌙 A brisa noturna passeia entre os telhados e as cerejeiras. Que vocês tenham um descanso sereno e continuem encontrando boas companhias por aqui; a Yukina estará esperando pelo próximo encontro.",
  "🫧 Pequenas lembranças são como bolhas brilhantes: aparecem por um instante e deixam o dia mais bonito. Obrigada por compartilharem esta experiência comigo e por fazerem parte da nossa comunidade.",
  "🏮 As lanternas vermelhas iluminam o caminho enquanto nos despedimos deste momento. Se ainda quiserem conversar, há muitos espaços esperando por vocês para continuar a noite.",
  "🌸 Uma pétala pousa sobre a água e segue tranquila pelo riacho. Assim também seguem nossas lembranças: leves, bonitas e prontas para dar lugar a novas histórias. Obrigada pela companhia!",
  "🗻 Até as montanhas cobertas de neve parecem guardar silêncio nesta despedida. A Yukina agradece a participação de todos e deseja que os próximos dias tragam sorte, amizade e muitas risadas.",
  "🎐 Que a melodia dos sinos de vento acompanhe vocês depois desta pequena celebração. Obrigada por cada interação; continuem espalhando gentileza e alegria pelos canais do servidor.",
  "🌠 Uma estrela cadente atravessa o céu e leva nosso último desejo: que nunca faltem motivos para se reunir, conversar e se divertir. A Yukina agradece por ter vocês por perto.",
  "🍵 A chaleira já está descansando e o chá continua quentinho. Antes de seguir, a Yukina deixa seu agradecimento por cada instante compartilhado e um convite para continuarem aproveitando a comunidade.",
  "🌺 O caminho entre as cerejeiras permanece aberto para novos encontros. Obrigada por trazerem tanta vida a este momento; que a próxima aventura encontre todos com o coração leve.",
  "🌙 Com um último aceno sob o luar, a Yukina se despede desta ocasião com muito carinho. As histórias continuam nos outros espaços do servidor, e será uma alegria encontrar vocês por lá."
];

function chooseMessage() {
  const index = Math.floor(Math.random() * MESSAGES.length);
  return { index, fallback: MESSAGES[index] };
}

function clean(value) {
  return String(value || "")
    .replace(/^[\"'“”]+|[\"'“”]+$/g, "")
    .replace(/@everyone|@here/g, match => "@\u200b" + match.slice(1))
    .replace(/<@&?\d+>/g, "")
    .trim()
    .slice(0, 3500);
}

function chooseChannels(guild, currentChannel) {
  const candidates = [...guild.channels.cache.values()].filter(channel =>
    channel.type === ChannelType.GuildText &&
    channel.viewable &&
    channel.id !== currentChannel?.id &&
    !channel.name.startsWith("ticket-") &&
    !channel.name.startsWith("private-")
  );
  if (!candidates.length) return [];
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, Math.min(candidates.length, Math.random() < 0.5 ? 1 : 2));
}

async function run(channel, guild, reply) {
  if (!channel?.isTextBased?.() || !channel.send || !guild) return false;
  const selected = chooseMessage();
  const chosenChannels = chooseChannels(guild, channel);
  const mentions = chosenChannels.length
    ? "\n\n**🌸 Se quiserem continuar a conversa, encontrem a Yukina por aqui:**\n" + chosenChannels.map(item => "・<#"+item.id+">").join("\n")
    : "";
  const embed = new EmbedBuilder()
    .setColor(0xDDA8C7)
    .setTitle("🌸 Até nosso próximo encontro")
    .setDescription(selected.fallback.slice(0, 3500) + mentions)
    .setFooter({ text: "Com carinho, Yukina ❄️" })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    return true;
  } catch (error) {
    console.error("[Yukina fim] Falha ao enviar mensagem:", error);
    await reply("🫧 Não consegui enviar a mensagem neste canal. Verifique minhas permissões de enviar mensagens e incorporar links.");
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fim")
    .setDescription("Enviar uma despedida especial da Yukina sem encerrar o sorteio.")
    .setDMPermission(false),
  aliases: ["encerramento", "despedida"],
  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: "❄️ Este comando só funciona em um servidor.", ephemeral: true });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "🌙 Você precisa da permissão **Gerenciar mensagens** ou **Gerenciar servidor**.", ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const sent = await run(interaction.channel, interaction.guild, content => interaction.editReply(content));
    if (sent) return interaction.editReply("🌸 Mensagem de despedida enviada!");
  },
  async prefixExecute(message) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona em um servidor.");
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) &&
        !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply("🌙 Você precisa da permissão **Gerenciar mensagens** ou **Gerenciar servidor**.");
    }
    return run(message.channel, message.guild, content => message.reply(content));
  }
};
