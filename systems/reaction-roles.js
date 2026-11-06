"use strict";

const { EmbedBuilder, PermissionsBitField } = require("discord.js");

const EMOJIS = ["🎮","🎨","🎵","🎬","📚","⚽","🌸","🌙","⭐","🔥","💎","🦋","🐺","🐱","🐼","🍀","🌻","🍓","☕","🎧"];

function install(client, getSettingsCollection) {
  async function resolve(reaction) {
    if (reaction.partial) await reaction.fetch();
    const message = reaction.message;
    if (!message.guild || message.author?.id !== client.user.id) return null;
    const collection = await getSettingsCollection();
    const doc = await collection.findOne({ guildId: message.guild.id }, { projection: { "settings.reactionRoles": 1 } });
    const config = doc?.settings?.reactionRoles;
    if (!config?.enabled || String(config.messageId) !== message.id) return null;
    const item = (config.items || []).find(entry => entry.emoji === reaction.emoji.name);
    return item ? { guild: message.guild, item } : null;
  }

  async function updateRole(reaction, user, add) {
    if (user.bot) return;
    try {
      const found = await resolve(reaction);
      if (!found) return;
      const member = await found.guild.members.fetch(user.id).catch(() => null);
      if (!member || !member.manageable) return;
      const role = await found.guild.roles.fetch(String(found.item.roleId)).catch(() => null);
      if (!role || role.managed || role.id === found.guild.id) return;
      if (add && !member.roles.cache.has(role.id)) await member.roles.add(role, "Cargo obtido por reação configurada no painel da Yukina");
      if (!add && member.roles.cache.has(role.id)) await member.roles.remove(role, "Reação de cargo removida");
    } catch (error) {
      console.error("[Cargos por reação] Falha ao atualizar cargo:", error.message || error);
    }
  }

  client.on("messageReactionAdd", (reaction, user) => updateRole(reaction, user, true));
  client.on("messageReactionRemove", (reaction, user) => updateRole(reaction, user, false));
}

async function handleApi(req, res, url, context) {
  if (url.pathname !== "/api/reaction-roles/config") return false;
  const { sendJson, readBody, authorizePanel, getSettingsCollection } = context;
  if (!["GET", "POST"].includes(req.method)) {
    sendJson(res, 405, { detail: "Use GET para carregar ou POST para salvar." });
    return true;
  }
  try {
    const body = req.method === "POST" ? await readBody(req) : {};
    const guildId = String(req.method === "GET" ? url.searchParams.get("guildId") || "" : body.guildId || "").trim();
    if (!/^\d{17,20}$/.test(guildId)) {
      sendJson(res, 400, { detail: "Selecione um servidor válido." });
      return true;
    }
    const authorized = await authorizePanel(req, guildId);
    const guild = authorized?.guild;
    if (!guild || guild.id !== guildId) {
      sendJson(res, 403, { detail: "Você não tem autorização para configurar este servidor." });
      return true;
    }
    const collection = await getSettingsCollection();
    const previous = (await collection.findOne({ guildId }, { projection: { "settings.reactionRoles": 1 } }))?.settings?.reactionRoles || null;
    if (req.method === "GET") {
      sendJson(res, 200, { ok: true, config: previous, emojis: EMOJIS });
      return true;
    }

    const channelId = String(body.channelId || "").trim();
    const messageText = String(body.message || "").trim().slice(0, 1800);
    const submitted = Array.isArray(body.items) ? body.items : [];
    if (!/^\d{17,20}$/.test(channelId) || !messageText || !submitted.length || submitted.length > EMOJIS.length) {
      sendJson(res, 400, { detail: "Escolha um canal, escreva a mensagem e adicione ao menos um cargo (máximo de 20)." });
      return true;
    }
    const roleIds = new Set();
    const items = [];
    for (const [index, entry] of submitted.entries()) {
      const roleId = String(entry?.roleId || "").trim();
      if (!/^\d{17,20}$/.test(roleId) || roleIds.has(roleId)) {
        sendJson(res, 400, { detail: "Selecione um cargo existente e não repita o mesmo cargo." });
        return true;
      }
      const role = await guild.roles.fetch(roleId).catch(() => null);
      if (!role || role.guild.id !== guild.id || role.id === guild.id || role.managed) {
        sendJson(res, 400, { detail: "Um dos cargos não existe ou não pode ser atribuído." });
        return true;
      }
      roleIds.add(roleId);
      items.push({ roleId, roleName: role.name, emoji: EMOJIS[index] });
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== 0) {
      sendJson(res, 400, { detail: "Escolha um canal de texto válido." });
      return true;
    }
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const required = [PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AddReactions];
    if (!botMember || !required.every(flag => botMember.permissions.has(flag))) {
      sendJson(res, 403, { detail: "A Yukina precisa das permissões Gerenciar cargos, Ver canal, Enviar mensagens, Incorporar links e Adicionar reações." });
      return true;
    }
    const channelPerms = channel.permissionsFor(botMember);
    if (!channelPerms || ![PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AddReactions].every(flag => channelPerms.has(flag))) {
      sendJson(res, 403, { detail: "A Yukina não tem as permissões necessárias no canal escolhido." });
      return true;
    }
    for (const item of items) {
      const role = await guild.roles.fetch(item.roleId);
      if (role.position >= botMember.roles.highest.position) {
        sendJson(res, 403, { detail: "Mova os cargos selecionados para baixo do cargo mais alto da Yukina." });
        return true;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xc4b5fd)
      .setTitle("🌸 Escolha seus cargos")
      .setDescription(items.map(item => item.emoji + "  **" + item.roleName.replace(/[*_~`|]/g, "") + "**").join("\n"))
      .setFooter({ text: "Yukina • Reaja para receber ou remover o cargo." });

    let message = null;
    if (previous?.messageId && String(previous.channelId) === channel.id) {
      message = await channel.messages.fetch(String(previous.messageId)).catch(() => null);
    }
    if (message) {
      await message.edit({ content: messageText, embeds: [embed] });
      await message.reactions.removeAll();
    } else {
      message = await channel.send({ content: messageText, embeds: [embed] });
    }
    for (const item of items) await message.react(item.emoji);

    const saved = {
      enabled: true, channelId: channel.id, channelName: channel.name, messageId: message.id,
      message: messageText, items, updatedAt: new Date().toISOString()
    };
    await collection.updateOne(
      { guildId },
      { $set: { guildId, guildName: guild.name, "settings.reactionRoles": saved, updatedAt: new Date() } },
      { upsert: true }
    );

    if (previous?.messageId && String(previous.messageId) !== message.id) {
      const oldChannel = await guild.channels.fetch(String(previous.channelId)).catch(() => null);
      const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(String(previous.messageId)).catch(() => null) : null;
      if (oldMessage) await oldMessage.delete().catch(() => {});
    }
    sendJson(res, 200, { ok: true, config: saved, detail: "Painel de cargos por reação atualizado na mesma mensagem." });
    return true;
  } catch (error) {
    console.error("[Cargos por reação] Falha ao salvar:", error.stack || error.message || error);
    sendJson(res, error.status || 500, { detail: error.message || "Não foi possível salvar os cargos por reação." });
    return true;
  }
}

module.exports = { install, handleApi, EMOJIS };
