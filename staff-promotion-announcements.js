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
    "❄️ Uma nova etapa começa!",
    "Hoje celebramos {member} pela promoção para {role}! Que essa nova jornada seja repleta de aprendizado, confiança e conquistas."
  ],
  [
    "🌸 Florescendo em uma nova missão",
    "Com alegria, anunciamos {member} em {role}. Que essa responsabilidade floresça com dedicação e respeito."
  ],
  [
    "🌙 Um novo brilho na equipe",
    "{member} alcançou uma nova etapa e agora ocupa {role}. Que sua presença continue fazendo a diferença."
  ],
  [
    "✨ Reconhecimento merecido",
    "Toda dedicação merece ser reconhecida. Parabéns, {member}, pela promoção para {role}!"
  ],
  [
    "⛩️ Uma nova responsabilidade",
    "As portas de uma nova jornada se abrem para {member}, promovido(a) a {role}. Conte com a equipe!"
  ],
  [
    "🌷 Um passo adiante",
    "Damos as boas-vindas a {member} em sua nova função: {role}. Que venham experiências incríveis!"
  ],
  [
    "💜 Conquista celebrada",
    "Temos uma novidade especial: {member} agora faz parte de {role}. Parabéns!"
  ],
  [
    "🌨️ Uma nova missão sob a lua",
    "A equipe celebra a promoção de {member} para {role}. Que sua jornada seja guiada por equilíbrio e dedicação."
  ],
  [
    "🎐 Novos ventos, novos caminhos",
    "{member} inicia uma nova etapa como {role}. Que essa mudança traga crescimento!"
  ],
  [
    "🌟 Destaque da vez",
    "Hoje o reconhecimento vai para {member}, promovido(a) a {role}. Parabéns!"
  ],
  [
    "🌸 Mais um capítulo",
    "Um novo capítulo começa para {member}, agora no cargo de {role}. Que seja uma história de união."
  ],
  [
    "❄️ A equipe cresce",
    "Nossa equipe ganha uma nova etapa com {member} assumindo {role}. Desejamos uma jornada excelente!"
  ],
  [
    "🪷 Dedicação que inspira",
    "A dedicação de {member} ganha um novo reconhecimento: a promoção para {role}."
  ],
  [
    "🌙 Sob uma nova luz",
    "É hora de celebrar {member}, que agora assume {role}. Que essa responsabilidade venha com grandes momentos."
  ],
  [
    "🎎 Uma conquista especial",
    "Anunciamos {member} no cargo de {role}. Que essa nova fase seja leve e memorável!"
  ],
  [
    "✨ Um novo horizonte",
    "{member} alcançou um novo horizonte em nossa equipe e agora ocupa {role}. Parabéns!"
  ],
  [
    "🌺 Reconhecimento e confiança",
    "A confiança da equipe acompanha {member} nesta nova etapa como {role}. Sucesso!"
  ],
  [
    "🌨️ Mais uma estrela no caminho",
    "Hoje celebramos a promoção de {member} para {role}. Que sua contribuição continue iluminando a comunidade."
  ],
  [
    "🍡 Uma doce conquista",
    "Uma notícia para comemorar: {member} foi promovido(a) a {role}!"
  ],
  [
    "🏮 Uma nova posição",
    "As lanternas se acendem para uma nova etapa: {member} agora ocupa {role}. Parabéns!"
  ],
  [
    "💫 Crescimento reconhecido",
    "É muito bom ver nossa equipe crescer. Parabéns a {member} pela promoção para {role}!"
  ],
  [
    "🌸 Um momento para celebrar",
    "Celebramos {member}, que agora assume o cargo de {role}. Sucesso nessa nova fase!"
  ],
  [
    "❄️ Novos passos na neve",
    "{member} dá mais um passo em sua trajetória e chega ao cargo de {role}."
  ],
  [
    "🌙 Uma missão de confiança",
    "Com confiança e alegria, anunciamos {member} como novo(a) integrante de {role}."
  ],
  [
    "🎐 A jornada continua",
    "A caminhada de {member} ganha um novo capítulo com a promoção para {role}."
  ],
  [
    "🪻 Uma evolução especial",
    "Celebramos a evolução de {member}, agora promovido(a) a {role}."
  ],
  [
    "⭐ Uma conquista que merece destaque",
    "Parabéns, {member}! Sua nova posição é {role}. Que sua trajetória seja brilhante."
  ],
  [
    "🌸 Sakura de celebração",
    "Como as sakuras anunciam uma nova estação, celebramos a nova etapa de {member} em {role}."
  ],
  [
    "🧭 Um novo caminho na equipe",
    "{member} começa agora uma nova caminhada como {role}. Desejamos sabedoria!"
  ],
  [
    "💜 Um reconhecimento especial",
    "Anunciamos a promoção de {member} para {role}. Que essa confiança traga grandes feitos!"
  ],
  [
    "🌨️ A neve traz novidades",
    "Temos uma novidade: {member} agora ocupa {role}. Que essa nova etapa seja cheia de realizações!"
  ],
  [
    "🏯 Uma nova honra",
    "Anunciamos {member} no cargo de {role}. Parabéns pela conquista e pela nova responsabilidade!"
  ],
  [
    "✨ Mais uma vitória",
    "Uma nova vitória para celebrar: {member} foi promovido(a) a {role}!"
  ],
  [
    "🌷 Um ciclo se renova",
    "Um novo ciclo começa para {member}, agora em {role}. Que não faltem motivação e união!"
  ],
  [
    "🌙 A lua testemunha uma conquista",
    "Sob a luz da lua, celebramos a promoção de {member} para {role}."
  ],
  [
    "🎏 Boas notícias para a equipe",
    "Nossa equipe tem mais um motivo para comemorar: {member} agora faz parte de {role}."
  ],
  [
    "❄️ Um passo de confiança",
    "{member} recebe uma nova demonstração de confiança e assume {role}."
  ],
  [
    "🌼 Uma nova oportunidade",
    "Uma nova oportunidade se apresenta para {member}, promovido(a) a {role}. Aproveite cada aprendizado!"
  ],
  [
    "💎 Talento reconhecido",
    "Hoje reconhecemos o crescimento de {member}, que passa a ocupar {role}. Parabéns!"
  ],
  [
    "🌸 A primavera da equipe",
    "Nossa comunidade celebra mais uma conquista: {member} agora assume {role}."
  ],
  [
    "🕊️ Uma etapa de crescimento",
    "Com respeito e alegria, celebramos {member} em sua nova função: {role}."
  ],
  [
    "🌌 Um novo lugar entre as estrelas",
    "{member} alcançou uma nova posição em nossa equipe: {role}. Continue brilhando!"
  ],
  [
    "🎐 Uma conquista compartilhada",
    "Essa conquista também é motivo de alegria para toda a equipe. Parabéns, {member}, pela promoção para {role}!"
  ],
  [
    "🪷 Novas responsabilidades, novas conquistas",
    "{member} inicia sua jornada em {role}. Que cada responsabilidade seja uma oportunidade!"
  ],
  [
    "🌙 Um anúncio especial da Yukina",
    "Com muita alegria, a Yukina anuncia: {member} agora ocupa {role}. Parabéns!"
  ],
  [
    "🏵️ Mérito celebrado",
    "A promoção de {member} para {role} merece ser celebrada. Desejamos sucesso!"
  ],
  [
    "❄️ Uma nova fase começa agora",
    "Chegou a hora de uma nova etapa para {member}, promovido(a) a {role}."
  ],
  [
    "🌸 A equipe recebe uma novidade",
    "Com alegria, recebemos {member} em sua nova posição como {role}."
  ],
  [
    "✨ Confiança que se transforma em conquista",
    "{member} assume agora o cargo de {role}. Que essa confiança marque uma trajetória ainda melhor!"
  ],
  [
    "🌠 Um futuro cheio de possibilidades",
    "Parabéns a {member} pela promoção para {role}! Que os próximos passos tragam aprendizado e união!"
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
