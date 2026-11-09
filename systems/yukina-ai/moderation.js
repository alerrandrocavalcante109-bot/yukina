"use strict";

const { PermissionFlagsBits, ChannelType } = require("discord.js");

const BULK_DELETE_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const CHAT_CLEAR_BATCHES = 10;

function getRoleId(text) {
  return String(text || "").match(/<@&(\d{17,20})>/)?.[1] || null;
}
function getMemberId(text) {
  return String(text || "").match(/<@!?(\d{17,20})>/)?.[1] || null;
}
function getChannelId(text) {
  return String(text || "").match(/<#(\d{17,20})>/)?.[1] || null;
}
function isTextChannel(channel) {
  return Boolean(channel && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type));
}
function reply(text) {
  return { handled: true, text };
}
function hasPermission(member, permission) {
  return Boolean(member?.permissions?.has(permission) || member?.permissions?.has(PermissionFlagsBits.Administrator));
}
async function getChannel(guild, context, prompt) {
  const id = getChannelId(prompt);
  if (!id) return context.channel;
  return guild.channels.fetch(id).catch(() => null);
}
async function getActor(guild, context) {
  return guild.members.fetch(context.actorId).catch(() => null);
}
async function checkBotPermission(guild, channel, permission) {
  const bot = guild.members.me || await guild.members.fetchMe().catch(() => null);
  return Boolean(bot?.permissionsIn(channel).has(permission));
}

async function changeLock({ guild, channel, actor, lock }) {
  if (!isTextChannel(channel)) return reply("🌸 Escolha um canal de texto deste servidor.");
  if (!hasPermission(actor, PermissionFlagsBits.ManageChannels)) return reply("🔒 Você precisa da permissão **Gerenciar canais** para fazer isso.");
  if (!await checkBotPermission(guild, channel, PermissionFlagsBits.ManageChannels)) return reply("🫧 Preciso da permissão **Gerenciar canais** neste canal.");
  const everyone = guild.roles.everyone;
  const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
  const explicitDeny = Boolean(overwrite?.deny?.has(PermissionFlagsBits.SendMessages));
  const effective = channel.permissionsFor(everyone)?.has(PermissionFlagsBits.SendMessages) ?? true;
  if (lock) {
    if (explicitDeny || !effective) return reply("🌙 " + channel.toString() + " já está bloqueado por uma regra existente. Não alterei as permissões.");
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason: "Bloqueio solicitado por " + actor.user.tag });
      return reply("🔒 Canal " + channel.toString() + " bloqueado. Os membros não poderão enviar mensagens.");
    } catch (error) {
      console.error("[Yukina IA moderação] Falha ao bloquear canal:", error);
      return reply("🫧 Não consegui bloquear esse canal. Confira minhas permissões.");
    }
  }
  if (!explicitDeny) return reply(effective
    ? "🌸 " + channel.toString() + " já está desbloqueado."
    : "🌙 O bloqueio de " + channel.toString() + " vem de uma categoria ou outra regra herdada. Não alterei as permissões.");
  try {
    await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, { reason: "Desbloqueio solicitado por " + actor.user.tag });
    return reply("🔓 Canal " + channel.toString() + " desbloqueado conforme as permissões herdadas.");
  } catch (error) {
    console.error("[Yukina IA moderação] Falha ao desbloquear canal:", error);
    return reply("🫧 Não consegui desbloquear esse canal. Confira minhas permissões.");
  }
}

function parseDuration(text) {
  const raw = String(text || "").toLowerCase();
  if (/\b(off|desativar|desligar|zero)\b/.test(raw)) return 0;
  const match = raw.match(/\b(\d+)\s*(s|seg|segundos?|m|min|minutos?|h|horas?)\b/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const seconds = amount * (["m", "min", "minuto", "minutos"].includes(unit) ? 60 : ["h", "hora", "horas"].includes(unit) ? 3600 : 1);
  return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= 21600 ? seconds : null;
}
async function changeSlowmode({ guild, channel, actor, prompt, enable }) {
  if (!isTextChannel(channel)) return reply("🌸 Escolha um canal de texto deste servidor.");
  if (!hasPermission(actor, PermissionFlagsBits.ManageChannels)) return reply("🔒 Você precisa da permissão **Gerenciar canais** para alterar o modo lento.");
  if (!await checkBotPermission(guild, channel, PermissionFlagsBits.ManageChannels)) return reply("🫧 Preciso da permissão **Gerenciar canais** neste canal.");
  const seconds = enable ? parseDuration(prompt) : 0;
  if (seconds === null) return reply("📝 Informe o intervalo, por exemplo: **30 segundos**, **5 minutos** ou **1 hora**. O máximo é 6 horas.");
  try {
    await channel.setRateLimitPerUser(seconds, "Modo lento configurado por " + actor.user.tag);
    return reply(seconds === 0
      ? "🌙 O modo lento foi desativado em " + channel.toString() + "."
      : "🐢 O modo lento foi ativado em " + channel.toString() + " com intervalo de **" + seconds + " segundo(s)**.");
  } catch (error) {
    console.error("[Yukina IA moderação] Falha no modo lento:", error);
    return reply("🫧 Não consegui alterar o modo lento. Confira minhas permissões.");
  }
}

async function clearMessages({ guild, channel, actor, amount }) {
  if (!hasPermission(actor, PermissionFlagsBits.ManageMessages)) return reply("🔒 Você precisa da permissão **Gerenciar mensagens** para limpar o canal.");
  if (!await checkBotPermission(guild, channel, PermissionFlagsBits.ManageMessages)) return reply("🫧 Preciso da permissão **Gerenciar mensagens** neste canal.");
  if (!Number.isInteger(amount) || amount < 2 || amount > 100) return reply("🌸 Posso apagar de **2 a 100 mensagens** por comando. Diga, por exemplo, 'limpe 20 mensagens'.");
  try {
    const deleted = await channel.bulkDelete(amount, true);
    return reply("🧹 Apaguei **" + deleted.size + "** mensagem(ns). Mensagens com mais de 14 dias não podem ser removidas em massa pelo Discord.");
  } catch (error) {
    console.error("[Yukina IA moderação] Falha ao limpar mensagens:", error);
    return reply("🫧 Não consegui limpar as mensagens. Confira minhas permissões.");
  }
}

async function clearChat({ guild, channel, actor }) {
  if (!hasPermission(actor, PermissionFlagsBits.ManageMessages)) return reply("🔒 Você precisa da permissão **Gerenciar mensagens** para limpar o chat.");
  if (!await checkBotPermission(guild, channel, PermissionFlagsBits.ManageMessages)) return reply("🫧 Preciso da permissão **Gerenciar mensagens** neste canal.");
  const cutoff = Date.now() - BULK_DELETE_MAX_AGE;
  let before;
  let total = 0;
  let batches = 0;
  try {
    while (batches < CHAT_CLEAR_BATCHES) {
      const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!page.size) break;
      const oldest = page.last();
      const recent = page.filter(message => message.createdTimestamp >= cutoff && !message.pinned);
      if (recent.size) total += (await channel.bulkDelete(recent, true)).size;
      batches += 1;
      if (page.size < 100 || !oldest || oldest.createdTimestamp < cutoff) break;
      before = oldest.id;
    }
    return reply("🧹 Limpei **" + total + "** mensagem(ns) do chat." +
      (batches >= CHAT_CLEAR_BATCHES ? " Alcancei o limite de 1.000 mensagens por execução." : "") +
      " Preservei mensagens fixadas. O Discord não permite apagar em massa mensagens com mais de 14 dias.");
  } catch (error) {
    console.error("[Yukina IA moderação] Falha ao limpar o chat:", error);
    return reply("🫧 A limpeza foi interrompida. Confira minhas permissões e tente novamente.");
  }
}

async function changeRole({ guild, actor, prompt, add }) {
  if (!hasPermission(actor, PermissionFlagsBits.ManageRoles)) return reply("🔒 Você precisa da permissão **Gerenciar cargos** para conceder ou retirar cargos.");
  const userId = getMemberId(prompt);
  const roleId = getRoleId(prompt);
  if (!userId || !roleId) return reply("🌸 Mencione o membro e o cargo. Exemplo: 'conceda @Cargo para @Membro' ou 'retire @Cargo de @Membro'.");
  const target = await guild.members.fetch(userId).catch(() => null);
  const role = await guild.roles.fetch(roleId).catch(() => null);
  const bot = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!target || !role) return reply("🫧 Não encontrei esse membro ou cargo neste servidor.");
  if (!bot?.permissions.has(PermissionFlagsBits.ManageRoles)) return reply("🫧 Preciso da permissão **Gerenciar cargos**.");
  if (role.id === guild.id || role.managed) return reply("🌙 Esse cargo não pode ser alterado manualmente.");
  if (role.position >= bot.roles.highest.position) return reply("🌙 Meu cargo está abaixo ou no mesmo nível do cargo que você selecionou.");
  if (actor.id !== guild.ownerId && role.position >= actor.roles.highest.position) return reply("🌸 Você não pode alterar um cargo acima ou no mesmo nível do seu.");
  if (target.id === guild.ownerId && actor.id !== guild.ownerId) return reply("🌙 Não posso alterar os cargos do proprietário do servidor.");
  if (target.id !== actor.id && actor.id !== guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) return reply("🌙 Você não pode alterar os cargos de alguém com cargo igual ou superior ao seu.");
  if (add && target.roles.cache.has(role.id)) return reply("🌸 " + target.user.tag + " já possui o cargo **" + role.name + "**.");
  if (!add && !target.roles.cache.has(role.id)) return reply("🌙 " + target.user.tag + " não possui o cargo **" + role.name + "**.");
  try {
    if (add) {
      await target.roles.add(role, "Cargo concedido pela Yukina a pedido de " + actor.user.tag);
      await require("../../staff-promotion-announcements").announcePromotion(guild.client, target, role).catch(() => {});
      return reply("❄️ Concedi o cargo **" + role.name + "** a **" + target.user.tag + "**.");
    }
    await target.roles.remove(role, "Cargo retirado pela Yukina a pedido de " + actor.user.tag);
    return reply("🌙 Retirei o cargo **" + role.name + "** de **" + target.user.tag + "**.");
  } catch (error) {
    console.error("[Yukina IA moderação] Falha ao alterar cargo:", error);
    return reply("🫧 Não consegui alterar esse cargo. Confira a hierarquia e as permissões.");
  }
}

async function handleRequest({ prompt, context } = {}) {
  const original = String(prompt || "").trim();
  if (!original || !context?.guild || !context?.actorId) return { handled: false };
  const normalized = original.toLocaleLowerCase("pt-BR").replace(/^yukina[,!\\s]+/, "").trim();
  const guild = context.guild;

  const grantVerb = /^(conceda|conceder|atribua|atribuir|adicione|adicionar|dê|de)\\b/.test(normalized);
  const removeVerb = /^(retire|retirar|remova|remover|tire|tirar)\\b/.test(normalized);
  const hasRoleTarget = Boolean(getRoleId(original)) || /\\bcargo\\b/.test(normalized);
  const grant = grantVerb && hasRoleTarget;
  const remove = removeVerb && hasRoleTarget;
  const lock = /^(bloqueie|bloquear|lock|trancar|feche)\\b/.test(normalized) && (/\\b(canal|chat)\\b|<#\\d{17,20}>/.test(normalized));
  const unlock = /^(desbloqueie|desbloquear|unlock|destrancar|abra)\\b/.test(normalized) && (/\\b(canal|chat)\\b|<#\\d{17,20}>/.test(normalized));
  const slow = /^(ative|ativar|ligue|ligar|desative|desativar|desligue|desligar)\\b/.test(normalized) && /\\b(modo lento|slowmode)\\b/.test(normalized);
  const amountMatch = normalized.match(/^(?:limpe|limpar|apague|apagar|clear)\\s+(\\d+)\\s+(?:mensagens?|msgs?)\\b/);
  const clearAll = /^(limpe|limpar|apague|apagar|clear)\\b/.test(normalized) && /\\b(chat|canal)\\b/.test(normalized);

  if (!grant && !remove && !lock && !unlock && !slow && !amountMatch && !clearAll) return { handled: false };

  const actor = await getActor(guild, context);
  if (!actor) return reply("🫧 Não consegui confirmar sua conta no servidor.");

  if (grant || remove) return changeRole({ guild, actor, prompt: original, add: grant });
  if (lock || unlock) {
    const channel = await getChannel(guild, context, original);
    return changeLock({ guild, channel, actor, lock });
  }
  if (slow) {
    const enable = !/^(desative|desativar|desligue|desligar)\\b/.test(normalized);
    const channel = await getChannel(guild, context, original);
    return changeSlowmode({ guild, channel, actor, prompt: normalized, enable });
  }
  if (amountMatch) {
    const channel = await getChannel(guild, context, original);
    return clearMessages({ guild, channel, actor, amount: Number(amountMatch[1]) });
  }
  const channel = await getChannel(guild, context, original);
  return clearChat({ guild, channel, actor });
}
module.exports = { handleRequest };
