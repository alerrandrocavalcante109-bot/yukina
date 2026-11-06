"use strict";

const { EmbedBuilder, PermissionsBitField } = require("discord.js");

const COLORS = [
  { key: "red", name: "Vermelho", emoji: "🔴" },
  { key: "orange", name: "Laranja", emoji: "🟠" },
  { key: "yellow", name: "Amarelo", emoji: "🟡" },
  { key: "green", name: "Verde", emoji: "🟢" },
  { key: "blue", name: "Azul", emoji: "🔵" },
  { key: "cyan", name: "Ciano", emoji: "🩵" },
  { key: "purple", name: "Roxo", emoji: "🟣" },
  { key: "pink", name: "Rosa", emoji: "🌸" },
  { key: "white", name: "Branco", emoji: "⚪" },
  { key: "black", name: "Preto", emoji: "⚫" }
];

function install(client, getSettingsCollection) {
  async function resolveReaction(reaction) {
    if (reaction.partial) await reaction.fetch();
    const message = reaction.message;
    if (!message.guild || message.author?.id !== client.user.id) return null;
    const collection = await getSettingsCollection();
    const doc = await collection.findOne(
      { guildId: message.guild.id },
      { projection: { "settings.nickColors": 1 } }
    );
    const config = doc?.settings?.nickColors;
    if (!config?.enabled || String(config.messageId) !== message.id) return null;
    const color = (config.colors || []).find(item => item.emoji === reaction.emoji.name);
    return color?.roleId ? { config, color, guild: message.guild } : null;
  }

  async function applyColor(reaction, user, adding) {
    if (user.bot) return;
    try {
      const resolved = await resolveReaction(reaction);
      if (!resolved) return;
      const member = await resolved.guild.members.fetch(user.id).catch(() => null);
      if (!member || !member.manageable && member.id === client.user.id) return;
      const roleIds = (resolved.config.colors || []).map(item => String(item.roleId || "")).filter(Boolean);
      const selectedId = String(resolved.color.roleId);
      if (adding) {
        const remove = roleIds.filter(id => id !== selectedId && member.roles.cache.has(id));
        if (remove.length) await member.roles.remove(remove, "Troca de cor do nick pela Yukina");
        if (!member.roles.cache.has(selectedId)) await member.roles.add(selectedId, "Cor de nick escolhida pelo membro");
      } else if (member.roles.cache.has(selectedId)) {
        await member.roles.remove(selectedId, "Reação de cor removida");
      }
    } catch (error) {
      console.error("[Cores de Nick] Falha ao atualizar a cor:", error.message || error);
    }
  }

  client.on("messageReactionAdd", (reaction, user) => applyColor(reaction, user, true));
  client.on("messageReactionRemove", (reaction, user) => applyColor(reaction, user, false));
}

async function handleApi(req, res, url, context) {
  if (url.pathname !== "/api/nick-colors/config") return false;
  const { sendJson, readBody, authorizePanel, getSettingsCollection } = context;
  if (!["GET", "POST"].includes(req.method)) {
    sendJson(res, 405, { detail: "Use GET para carregar ou POST para salvar as cores." });
    return true;
  }
  try {
    const guildId = String(req.method === "GET" ? url.searchParams.get("guildId") || "" : "").trim();
    let body = {};
    if (req.method === "POST") body = await readBody(req);
    const targetGuildId = req.method === "GET" ? guildId : String(body.guildId || "").trim();
    if (!/^\d{17,20}$/.test(targetGuildId)) {
      sendJson(res, 400, { detail: "Selecione um servidor válido." });
      return true;
    }

    // A autorização é validada no servidor; não confiamos em IDs ou permissões enviados pelo navegador.
    const authorized = await authorizePanel(req, targetGuildId);
    const guild = authorized?.guild;
    if (!guild || guild.id !== targetGuildId) {
      sendJson(res, 403, { detail: "Você não tem autorização para configurar este servidor." });
      return true;
    }
    const collection = await getSettingsCollection();
    if (req.method === "GET") {
      const doc = await collection.findOne({ guildId: targetGuildId }, { projection: { "settings.nickColors": 1 } });
      sendJson(res, 200, { ok: true, config: doc?.settings?.nickColors || null, palette: COLORS });
      return true;
    }

    const channelId = String(body.channelId || "").trim();
    const messageText = String(body.message || "").trim().slice(0, 1800);
    const submitted = Array.isArray(body.colors) ? body.colors : [];
    if (!/^\d{17,20}$/.test(channelId) || !messageText || !submitted.length || submitted.length > COLORS.length) {
      sendJson(res, 400, { detail: "Informe uma mensagem, escolha um canal e selecione ao menos uma cor." });
      return true;
    }
    const keys = new Set();
    const roleIds = new Set();
    const selected = [];
    for (const entry of submitted) {
      const key = String(entry?.key || "");
      const roleId = String(entry?.roleId || "").trim();
      const hex = String(entry?.hex || "").toUpperCase();
      const palette = COLORS.find(item => item.key === key);
      if (!palette || keys.has(key) || !/^\d{17,20}$/.test(roleId) || roleIds.has(roleId) || !/^#[0-9A-F]{6}$/.test(hex)) {
        sendJson(res, 400, { detail: "Uma das cores ou cargos selecionados é inválida. Confira a seleção e tente novamente." });
        return true;
      }
      keys.add(key);
      roleIds.add(roleId);
      selected.push({ ...palette, roleId, hex });
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== 0) {
      sendJson(res, 400, { detail: "Escolha um canal de texto válido." });
      return true;
    }
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const needed = [PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AddReactions];
    if (!botMember || !needed.every(flag => botMember.permissions.has(flag))) {
      sendJson(res, 403, { detail: "A Yukina precisa de Gerenciar cargos, Ver canal, Enviar mensagens, Incorporar links e Adicionar reações." });
      return true;
    }
    const channelPermissions = channel.permissionsFor(botMember);
    if (!channelPermissions || ![PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AddReactions].every(flag => channelPermissions.has(flag))) {
      sendJson(res, 403, { detail: "A Yukina não tem todas as permissões necessárias no canal escolhido." });
      return true;
    }

    // Confere todos os cargos antes de alterar qualquer um: somente cargos existentes, únicos e abaixo da Yukina.
    const roles = [];
    for (const color of selected) {
      const role = await guild.roles.fetch(color.roleId).catch(() => null);
      if (!role || role.guild.id !== guild.id || role.id === guild.id || role.managed) {
        sendJson(res, 400, { detail: "Selecione somente cargos existentes e não gerenciados deste servidor." });
        return true;
      }
      if (role.position >= botMember.roles.highest.position) {
        sendJson(res, 403, { detail: "O cargo @" + role.name + " está acima ou na mesma posição do cargo da Yukina. Mova o cargo da Yukina acima dele e tente novamente." });
        return true;
      }
      roles.push({ ...color, name: role.name, previousHex: role.hexColor, role });
    }

    // A cor visual é atualizada no cargo escolhido pelo administrador; nenhum cargo é criado ou excluído.
    for (const item of roles) {
      if (item.role.hexColor.toUpperCase() !== item.hex) {
        await item.role.edit({ color: item.hex }, "Cor definida pelo administrador no painel da Yukina");
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xc4b5fd)
      .setTitle("🎨 Escolha a cor do seu nick")
      .setDescription(roles.map(color => color.emoji + "  **" + color.name + "**").join("\n"))
      .setFooter({ text: "Yukina • Reaja para escolher. Uma cor por membro." });
    const sent = await channel.send({ content: messageText, embeds: [embed] });
    try {
      for (const color of roles) await sent.react(color.emoji);
    } catch (error) {
      await sent.delete().catch(() => {});
      throw new Error("Não consegui adicionar todas as reações. Confira a permissão Adicionar reações.");
    }

    const saved = {
      enabled: true, channelId, channelName: channel.name, messageId: sent.id,
      message: messageText, colors: roles.map(({ role, previousHex, ...item }) => item),
      updatedAt: new Date().toISOString()
    };
    await collection.updateOne(
      { guildId: targetGuildId },
      { $set: { guildId: targetGuildId, guildName: guild.name, "settings.nickColors": saved, updatedAt: new Date() } },
      { upsert: true }
    );

    const oldConfig = (await collection.findOne({ guildId: targetGuildId }, { projection: { "settings.nickColors": 1 } }))?.settings?.nickColors;
    // A mensagem antiga é removida; cargos não selecionados permanecem intactos no servidor.
    if (oldConfig?.messageId && oldConfig.messageId !== sent.id) {
      const oldChannel = await guild.channels.fetch(String(oldConfig.channelId)).catch(() => null);
      const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(String(oldConfig.messageId)).catch(() => null) : null;
      if (oldMessage) await oldMessage.delete().catch(() => {});
    }
    sendJson(res, 200, { ok: true, config: saved, detail: "Cores salvas e mensagem publicada. A Yukina utilizou apenas cargos existentes; nenhum cargo foi criado ou excluído." });
    return true;
  } catch (error) {
    console.error("[Cores de Nick] Falha ao salvar:", error.stack || error.message || error);
    sendJson(res, error.status || 500, { detail: error.message || "Não foi possível salvar o sistema de cores." });
    return true;
  }
}

module.exports = { install, handleApi, COLORS };
