/**
 * Anúncios de promoção da equipe.
 * Compartilha a mesma rotina entre alterações externas e o comando /cargo.
 */
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { getGuildSettings } = require("./guild-settings-store");

const inFlight = new Set();
const recentlySent = new Map();
const DEDUPE_WINDOW_MS = 30_000;

const promotionPhrasePools = new Map();
const PROMOTION_PHRASES = [
  [
    "🌸 Um novo capítulo floresce",
    "Hoje, os caminhos da nossa equipe se abrem para {member}. A partir de agora, essa nova jornada será vivida no cargo de {role}. Que cada passo floresça em boas conquistas!"
  ],
  [
    "🏮 Comunicado oficial da equipe",
    "Temos a satisfação de anunciar a promoção de {member} para **{role}**. Esta nova posição representa confiança, reconhecimento e responsabilidade. Parabéns por esta conquista."
  ],
  [
    "✨ O mérito encontrou seu brilho",
    "Algumas conquistas merecem os holofotes. Hoje, eles são de {member}, que alcançou o cargo de {role}. Que esse brilho continue inspirando toda a comunidade!"
  ],
  [
    "🎐 Uma notícia que merece ser celebrada",
    "Parem um instante para comemorar: {member} acaba de chegar a **{role}**! Uma nova etapa começa, e estamos felizes em tê-lo(a) conosco nessa caminhada."
  ],
  [
    "🌙 Sob a luz de uma nova fase",
    "A lua testemunha mais uma mudança em nossa história. {member} assume agora o cargo de **{role}**. Que haja sabedoria nas decisões e serenidade nos desafios."
  ],
  [
    "📜 Registro de uma conquista",
    "Fica registrado neste momento: **{member}** foi promovido(a) e passa a ocupar **{role}**. Que esta conquista seja o início de muitas outras."
  ],
  [
    "💜 Confiança que cresce",
    "Nossa confiança em {member} ganha um novo capítulo. A partir de hoje, sua função será **{role}**. Obrigado(a) por aceitar esse novo desafio!"
  ],
  [
    "🎊 Pode comemorar!",
    "Tem promoção chegando! 🎉 {member} agora é **{role}**! Deixe seu carinho e suas felicitações para essa conquista especial."
  ],
  [
    "⛩️ Uma nova honra no santuário",
    "As portas de uma nova responsabilidade se abrem. {member} recebe a honra de integrar **{role}**. Que sua jornada seja guiada pelo respeito e pela dedicação."
  ],
  [
    "🪷 Dedicação em cada detalhe",
    "O cuidado, a presença e o esforço de {member} não passaram despercebidos. Hoje celebramos sua promoção para **{role}**. Nosso reconhecimento por essa caminhada!"
  ],
  [
    "🚀 Próxima etapa desbloqueada",
    "**Nova etapa desbloqueada!**\n\nJogador(a): {member}\nNova função: **{role}**\n\nQue venham novos desafios, aprendizados e vitórias!"
  ],
  [
    "🌷 Uma mudança cheia de significado",
    "Há mudanças que representam muito mais do que um novo título. Para {member}, hoje começa a experiência de atuar como **{role}**. Estamos torcendo por você!"
  ],
  [
    "🔔 Atenção, comunidade!",
    "Uma novidade importante acaba de chegar: {member} foi promovido(a) para **{role}**. Recebam essa nova etapa com entusiasmo!"
  ],
  [
    "🌌 Uma estrela muda de lugar",
    "No céu da nossa equipe, {member} passa a ocupar um novo espaço: **{role}**. Que continue iluminando o caminho de todos ao seu redor."
  ],
  [
    "🤝 Uma conquista de toda a equipe",
    "Quando alguém cresce, toda a equipe cresce junto. Parabéns, {member}, pela promoção para **{role}**. Conte com o nosso apoio nessa nova fase!"
  ],
  [
    "❄️ Novos passos, novas responsabilidades",
    "A jornada continua e os desafios também evoluem. {member} agora assume **{role}**. Que não faltem equilíbrio, coragem e boas escolhas."
  ],
  [
    "🎎 Celebração especial",
    "Hoje é dia de reconhecimento! Com alegria, anunciamos {member} como novo(a) integrante de **{role}**. Que esta etapa seja memorável."
  ],
  [
    "🧭 Um novo caminho começa aqui",
    "Uma nova direção se apresenta para {member}, que agora assume o cargo de **{role}**. Siga com confiança: sua próxima jornada começa agora."
  ],
  [
    "💎 Uma joia reconhecida",
    "Talento e dedicação merecem ser valorizados. {member} recebe hoje uma nova posição: **{role}**. Parabéns por conquistar esse espaço!"
  ],
  [
    "🌺 A equipe tem um novo motivo para sorrir",
    "Nossa comunidade ganha mais uma boa notícia: {member} foi promovido(a) para **{role}**. Que essa novidade traga ainda mais união!"
  ],
  [
    "⚔️ Chamado para uma nova missão",
    "Uma nova missão foi confiada a {member}!\n\n**Missão:** assumir o cargo {role}\n**Objetivo:** crescer, colaborar e fortalecer a equipe.\n\nBoa sorte nessa jornada!"
  ],
  [
    "📣 É oficial: temos promoção!",
    "Depois de uma caminhada de dedicação, {member} chega a **{role}**. A promoção está anunciada — agora é hora de escrever o próximo capítulo!"
  ],
  [
    "🍡 Uma conquista para adoçar o dia",
    "Tem notícia boa no ar! {member} acaba de conquistar o cargo de **{role}**. Que essa nova fase seja tão especial quanto este momento!"
  ],
  [
    "🏆 Reconhecimento conquistado",
    "**Conquista confirmada.** {member} foi promovido(a) para **{role}**. Nosso respeito por todo o empenho demonstrado até aqui."
  ],
  [
    "🌿 Crescer também é florescer",
    "Cada experiência prepara o próximo passo. Hoje, {member} floresce em uma nova função: **{role}**. Que continue aprendendo e fazendo a diferença."
  ],
  [
    "🎏 Os ventos trouxeram novidades",
    "Novos ventos sopram na equipe! {member} inicia sua jornada como **{role}**. Que essa mudança traga energia e grandes realizações."
  ],
  [
    "🕊️ Uma etapa de confiança",
    "Com respeito e confiança, celebramos a promoção de {member} para **{role}**. Que suas atitudes continuem fortalecendo nossa comunidade."
  ],
  [
    "🌠 O próximo capítulo já começou",
    "A história de {member} na equipe acaba de ganhar uma nova página: agora, o cargo é **{role}**. Que venham capítulos incríveis!"
  ],
  [
    "🎨 Uma nova cor na nossa equipe",
    "Nossa equipe ganha uma nova tonalidade com a chegada de {member} ao cargo **{role}**. Que sua presença torne este espaço ainda melhor!"
  ],
  [
    "🪭 Com honra e alegria",
    "É com grande alegria que reconhecemos {member} em sua nova posição: **{role}**. Receba nossos parabéns e votos de uma excelente jornada."
  ],
  [
    "⏳ O esforço trouxe novos frutos",
    "Toda caminhada é feita de pequenos passos. Hoje, eles levam {member} ao cargo de **{role}**. Que este reconhecimento motive novas conquistas."
  ],
  [
    "🌸 Sakura em festa!",
    "As sakuras estão em festa: {member} foi promovido(a) para **{role}**! Que esta nova estação seja repleta de crescimento e boas lembranças."
  ],
  [
    "🛡️ Uma nova responsabilidade confiada",
    "A equipe confia a {member} uma nova responsabilidade: **{role}**. Que sua atuação seja marcada por equilíbrio, compromisso e respeito."
  ],
  [
    "💫 Hoje a Yukina tem um anúncio especial",
    "Com um sorriso, a Yukina anuncia: {member} agora ocupa **{role}**! Parabéns por essa conquista. Estamos felizes em acompanhar sua evolução."
  ],
  [
    "📖 Capítulo concluído, jornada renovada",
    "Uma etapa foi concluída e outra começa. {member} passa a fazer parte de **{role}**. Que cada experiência daqui em diante valha a pena!"
  ],
  [
    "🌈 Um futuro cheio de possibilidades",
    "A promoção de {member} para **{role}** abre espaço para novas ideias, experiências e oportunidades. Que seja uma fase extraordinária!"
  ],
  [
    "🥁 Atenção para os aplausos!",
    "Um aplauso para {member}! 👏 A partir de hoje, assume o cargo de **{role}**. Essa conquista merece ser celebrada por todos!"
  ],
  [
    "🏯 Uma nova posição na história",
    "Mais um marco na história da nossa comunidade: {member} assume **{role}**. Que essa posição seja ocupada com honra e dedicação!"
  ],
  [
    "🌻 Que venham novos aprendizados",
    "Parabéns, {member}! Sua promoção para **{role}** é o começo de uma fase cheia de oportunidades. Aprenda, compartilhe e continue crescendo."
  ],
  [
    "🔮 Um novo destino se revela",
    "O próximo destino de {member} dentro da equipe é **{role}**. Que o caminho seja iluminado por boas escolhas e grandes conquistas!"
  ]
];
function nextPromotionPhrase(guildId) {
  let pool = promotionPhrasePools.get(String(guildId));
  if (!pool || pool.remaining.length === 0) {
    const remaining = PROMOTION_PHRASES.map((_, index) => index);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    if (pool && remaining.length > 1 && remaining[remaining.length - 1] === pool.last) {
      [remaining[0], remaining[remaining.length - 1]] = [remaining[remaining.length - 1], remaining[0]];
    }
    pool = { remaining, last: pool?.last ?? -1 };
    promotionPhrasePools.set(String(guildId), pool);
  }
  const index = pool.remaining.pop();
  pool.last = index;
  return PROMOTION_PHRASES[index];
}

async function announcePromotion(client, member, promotedRole) {
  if (!member?.guild || member.user?.bot || !promotedRole) return false;
  const roleId = String(promotedRole.id || promotedRole);
  const key = member.guild.id + ":" + member.id + ":" + roleId;
  const sentAt = recentlySent.get(key) || 0;
  if (inFlight.has(key) || Date.now() - sentAt < DEDUPE_WINDOW_MS) return false;
  inFlight.add(key);

  try {
    const settings = await getGuildSettings(member.guild.id, { force: true });
    const config = settings.staffPromotion && typeof settings.staffPromotion === "object"
      ? settings.staffPromotion
      : {};
    const configuredRoleIds = Array.isArray(config.roleIds)
      ? config.roleIds.map(String)
      : (config.roleId ? [String(config.roleId)] : []);
    if (config.enabled === false || !configuredRoleIds.includes(roleId)) return false;

    const role = typeof promotedRole === "object"
      ? promotedRole
      : await member.guild.roles.fetch(roleId).catch(() => null);
    const channelId = String(config.channelId || "");
    const notificationRoleId = String(config.notificationRoleId || "");
    const channel = channelId ? await member.guild.channels.fetch(channelId).catch(() => null) : null;
    const notificationRole = notificationRoleId
      ? await member.guild.roles.fetch(notificationRoleId).catch(() => null)
      : null;
    if (!role || !channel || !channel.isTextBased() || channel.type === ChannelType.GuildVoice) return false;
    if (notificationRoleId && !notificationRole) {
      console.warn("[Promoção staff] O cargo de notificação configurado não existe mais no servidor.");
      return false;
    }

    const me = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
    const permissions = me && channel.permissionsFor(me);
    if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions.has(PermissionFlagsBits.SendMessages) ||
        (channel.isThread?.() && !permissions.has(PermissionFlagsBits.SendMessagesInThreads))) {
      console.warn("[Promoção staff] A Yukina não tem permissão para enviar anúncio no canal configurado.");
      return false;
    }

    const phrase = nextPromotionPhrase(member.guild.id);
    const embed = new EmbedBuilder()
      .setColor(role.color || 0xA7D8F0)
      .setAuthor({ name: "Yukina • Promoção da equipe", iconURL: client.user.displayAvatarURL() })
      .setTitle(phrase[0])
      .setDescription(phrase[1].replaceAll("{member}", member.toString()).replaceAll("{role}", role.toString()))
      .addFields(
        { name: "Membro promovido", value: member.user.tag, inline: true },
        { name: "Novo cargo", value: role.name, inline: true }
      )
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await channel.send({
      content: notificationRole ? notificationRole.toString() : undefined,
      embeds: [embed],
      allowedMentions: { users: [member.id], roles: notificationRole ? [notificationRole.id] : [], parse: [] }
    });
    recentlySent.set(key, Date.now());
    console.log("[Promoção staff] Anúncio publicado para " + member.user.tag + " em " + member.guild.name + ".");
    return true;
  } catch (error) {
    console.error("[Promoção staff] Falha ao anunciar promoção:", error.message || error);
    return false;
  } finally {
    inFlight.delete(key);
  }
}

function startStaffPromotionAnnouncements(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (!newMember?.guild || newMember.user?.bot) return;
    try {
      const settings = await getGuildSettings(newMember.guild.id);
      const config = settings.staffPromotion && typeof settings.staffPromotion === "object"
        ? settings.staffPromotion
        : {};
      const configuredRoleIds = Array.isArray(config.roleIds)
        ? config.roleIds.map(String)
        : (config.roleId ? [String(config.roleId)] : []);
      const addedRoleId = configuredRoleIds.find(id =>
        !oldMember.roles.cache.has(id) && newMember.roles.cache.has(id)
      );
      if (addedRoleId) await announcePromotion(client, newMember, addedRoleId);
    } catch (error) {
      console.error("[Promoção staff] Falha ao verificar alteração de cargos:", error.message || error);
    }
  });
  console.log("[Promoção staff] Anúncios de promoção da equipe ativados.");
}

startStaffPromotionAnnouncements.announcePromotion = announcePromotion;
module.exports = startStaffPromotionAnnouncements;
