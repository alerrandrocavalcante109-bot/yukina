"use strict";

const { EmbedBuilder, PermissionsBitField } = require("discord.js");

const COLORS = [
  { key: "red", name: "Vermelho", hex: "#E74C3C", emoji: "🔴" },
  { key: "orange", name: "Laranja", hex: "#E67E22", emoji: "🟠" },
  { key: "yellow", name: "Amarelo", hex: "#F1C40F", emoji: "🟡" },
  { key: "green", name: "Verde", hex: "#2ECC71", emoji: "🟢" },
  { key: "blue", name: "Azul", hex: "#3498DB", emoji: "🔵" },
  { key: "cyan", name: "Ciano", hex: "#1ABC9C", emoji: "🩵" },
  { key: "purple", name: "Roxo", hex: "#9B59B6", emoji: "🟣" },
  { key: "pink", name: "Rosa", hex: "#E84393", emoji: "🌸" },
  { key: "white", name: "Branco", hex: "#ECF0F1", emoji: "⚪" },
  { key: "black", name: "Preto", hex: "#2C3E50", emoji: "⚫" }
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
      if (!member) return;
      const roleIds = (resolved.config.colors || []).map(item => String(item.roleId || "")).filter(Boolean);
      const current = roleIds.filter(id => member.roles.cache.has(id));
      if (adding) {
        const selectedId = String(resolved.color.roleId);
        const remove = current.filter(id => id !== selectedId);
        if (remove.length) await member.roles.remove(remove, "Troca de cor do nick pela Yukina");
        if (!member.roles.cache.has(selectedId)) await member.roles.add(selectedId, "Cor de nick escolhida pelo membro");
      } else if (member.roles.cache.has(String(resolved.color.roleId))) {
        await member.roles.remove(String(resolved.color.roleId), "Reação de cor removida");
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
    const authorized = await authorizePanel(req, targetGuildId);
    const guild = authorized.guild;
    const collection = await getSettingsCollection();
    if (req.method === "GET") {
      const doc = await collection.findOne({ guildId: targetGuildId }, { projection: { "settings.nickColors": 1 } });
      sendJson(res, 200, { ok: true, config: doc?.settings?.nickColors || null, palette: COLORS });
      return true;
    }

    const channelId = String(body.channelId || "");
    const messageText = String(body.message || "Escolha a cor do seu nick reagindo ao emoji correspondente abaixo.").trim().slice(0, 1800);
    const selectedKeys = Array.isArray(body.colors) ? [...new Set(body.colors.map(String))] : [];
    const selected = COLORS.filter(color => selectedKeys.includes(color.key));
    if (!/^\d{17,20}$/.test(channelId) || !selected.length) {
      sendJson(res, 400, { detail: "Escolha um canal e pelo menos uma cor." });
      return true;
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
    const oldDoc = await collection.findOne({ guildId: targetGuildId }, { projection: { "settings.nickColors": 1 } });
    const oldConfig = oldDoc?.settings?.nickColors || {};
    const oldColors = Array.isArray(oldConfig.colors) ? oldConfig.colors : [];
    const oldByKey = new Map(oldColors.map(item => [String(item.key), item]));
    const selectedKeySet = new Set(selected.map(item => item.key));
    const removedBeforeSave = oldColors.filter(item => item.roleId && !selectedKeySet.has(String(item.key)));
    for (const item of removedBeforeSave) {
      const role = await guild.roles.fetch(String(item.roleId)).catch(() => null);
      if (role && role.position >= botMember.roles.highest.position) {
        sendJson(res, 403, { detail: "Não consigo excluir o cargo " + role.name + " porque ele está acima ou na mesma posição do cargo da Yukina. Mova o cargo da Yukina acima dele e tente novamente." });
        return true;
      }
    }
    const roles = [];
    for (const color of selected) {
      let role = oldByKey.has(color.key) ? await guild.roles.fetch(String(oldByKey.get(color.key).roleId)).catch(() => null) : null;
      if (role && role.managed) throw new Error("Um cargo gerenciado não pode ser usado como cor: " + color.name + ".");
      if (!role) {
        role = await guild.roles.create({
          name: "Cor • " + color.name,
          color: color.hex,
          reason: "Cargo automático do sistema Cores de Nick da Yukina"
        });
      } else if (role.name !== "Cor • " + color.name || role.hexColor.toLowerCase() !== color.hex.toLowerCase()) {
        await role.edit({ name: "Cor • " + color.name, color: color.hex }, "Atualização da paleta de cores da Yukina");
      }
      if (role.position >= botMember.roles.highest.position) {
        sendJson(res, 403, { detail: "Mova o cargo da Yukina acima dos cargos de cor para que ela consiga gerenciá-los." });
        return true;
      }
      roles.push({ ...color, roleId: role.id });
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
      message: messageText, colors: roles, updatedAt: new Date().toISOString()
    };
    await collection.updateOne(
      { guildId: targetGuildId },
      { $set: { guildId: targetGuildId, guildName: guild.name, "settings.nickColors": saved, updatedAt: new Date() } },
      { upsert: true }
    );

    if (oldConfig.messageId && oldConfig.messageId !== sent.id) {
      const oldChannel = await guild.channels.fetch(String(oldConfig.channelId)).catch(() => null);
      const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(String(oldConfig.messageId)).catch(() => null) : null;
      if (oldMessage) await oldMessage.delete().catch(() => {});
    }
    const selectedIds = new Set(roles.map(item => String(item.roleId)));
    const removed = oldColors.filter(item => item.roleId && !selectedIds.has(String(item.roleId)));
    for (const item of removed) {
      const role = await guild.roles.fetch(String(item.roleId)).catch(() => null);
      if (role && !role.managed) await role.delete("Cor removida no painel da Yukina; cargo correspondente excluído");
    }
    sendJson(res, 200, { ok: true, config: saved, detail: "Cores salvas e mensagem publicada. Os cargos das cores removidas também foram excluídos." });
    return true;
  } catch (error) {
    console.error("[Cores de Nick] Falha ao salvar:", error.stack || error.message || error);
    sendJson(res, error.status || 500, { detail: error.message || "Não foi possível salvar o sistema de cores." });
    return true;
  }
}

module.exports = { install, handleApi, COLORS };
