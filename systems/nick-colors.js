"use strict";

const { EmbedBuilder, PermissionsBitField } = require("discord.js");

const activeGuildSaves = new Set();

const COLORS = Array.from({ length: 20 }, (_, index) => ({
  key: "color" + (index + 1), name: "Cor " + (index + 1), emoji: ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🇦","🇧","🇨","🇩","🇪","🇫","🇬","🇭","🇮","🇯"][index]
}));

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
      if (!member || !member.manageable) return;
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
  let saveLockGuildId = null;
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
    if (req.method === "POST") {
      if (activeGuildSaves.has(targetGuildId)) {
        sendJson(res, 409, { detail: "Já existe uma atualização de cores em andamento neste servidor. Aguarde alguns segundos e tente novamente." });
        return true;
      }
      activeGuildSaves.add(targetGuildId);
      saveLockGuildId = targetGuildId;
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
      if (!palette || keys.has(key) || (roleId && !/^\d{17,20}$/.test(roleId)) || (roleId && roleIds.has(roleId)) || !/^#[0-9A-F]{6}$/.test(hex)) {
        sendJson(res, 400, { detail: "Uma das cores ou cargos selecionados é inválida. Confira a seleção e tente novamente." });
        return true;
      }
      keys.add(key);
      if (roleId) roleIds.add(roleId);
      if (selected.some(item => item.hex === hex)) { sendJson(res, 400, { detail: "Cada opção precisa ter uma tonalidade diferente." }); return true; }
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

    // A Yukina cria e reutiliza os cargos de cor. O nome determinístico + ID salvo impedem duplicatas ao salvar novamente.
    const previousConfig = (await collection.findOne({ guildId: targetGuildId }, { projection: { "settings.nickColors": 1 } }))?.settings?.nickColors || {};
    const roles = [];
    const usedRoleIds = new Set();
    for (const color of selected) {
      const oldColor = (previousConfig.colors || []).find(item => item.key === color.key);
      let role = oldColor?.roleId ? await guild.roles.fetch(String(oldColor.roleId)).catch(() => null) : null;
      const roleName = "Yukina • " + color.key;
      if (!role) role = guild.roles.cache.find(item => item.name === roleName && !item.managed) || null;
      if (!role) {
        role = await guild.roles.create({ name: roleName, color: color.hex, permissions: [], mentionable: false, hoist: false, reason: "Cargo de cor de nick criado pelo painel da Yukina" });
      }
      if (role.guild.id !== guild.id || role.id === guild.id || role.managed || usedRoleIds.has(role.id)) {
        sendJson(res, 400, { detail: "Não foi possível validar um cargo de cor exclusivo. Nenhuma opção duplicada foi aplicada." });
        return true;
      }
      usedRoleIds.add(role.id);
      roles.push({ ...color, name: color.name, role });
    }

    // Mantém os cargos criados pela Yukina agrupados logo abaixo do cargo mais alto do bot.
    const orderedPositions = roles.map((item, index) => ({
      role: item.role.id,
      position: Math.max(1, botMember.roles.highest.position - 1 - index)
    }));
    if (orderedPositions.some(item => item.position >= botMember.roles.highest.position)) {
      sendJson(res, 403, { detail: "Não há posições disponíveis abaixo do cargo mais alto da Yukina para organizar os cargos de cor." });
      return true;
    }
    if (orderedPositions.length) await guild.roles.setPositions(orderedPositions, { reason: "Organização automática dos cargos de cor da Yukina" });

    for (const item of roles) {
      const currentRole = await guild.roles.fetch(item.role.id);
      if (currentRole.hexColor.toUpperCase() !== item.hex) {
        await currentRole.edit({ color: item.hex }, "Cor definida pelo administrador no painel da Yukina");
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xc4b5fd)
      .setTitle("🎨 Escolha a cor do seu nick")
      .setDescription(roles.map(color => color.emoji + "  **" + color.name + "**").join("\n"))
      .setFooter({ text: "Yukina • Reaja para escolher. Uma cor por membro." });

    // Mantém uma única mensagem: edita a publicação anterior e sincroniza suas reações.
    let targetMessage = null;
    if (previousConfig.messageId && String(previousConfig.channelId) === channel.id) {
      targetMessage = await channel.messages.fetch(String(previousConfig.messageId)).catch(() => null);
    }
    if (targetMessage) {
      await targetMessage.edit({ content: messageText, embeds: [embed] });
      await targetMessage.reactions.removeAll().catch(() => {});
    } else {
      targetMessage = await channel.send({ content: messageText, embeds: [embed] });
    }
    try {
      for (const color of roles) await targetMessage.react(color.emoji);
    } catch (error) {
      throw new Error("Não consegui sincronizar todas as reações. Confira a permissão Adicionar reações.");
    }

    const saved = {
      enabled: true, channelId, channelName: channel.name, messageId: targetMessage.id,
      message: messageText, colors: roles.map(({ role, ...item }) => ({ ...item, roleId: role.id })),
      updatedAt: new Date().toISOString()
    };
    await collection.updateOne(
      { guildId: targetGuildId },
      { $set: { guildId: targetGuildId, guildName: guild.name, "settings.nickColors": saved, updatedAt: new Date() } },
      { upsert: true }
    );

    // Se o administrador mudou o canal, a mensagem antiga é removida após a nova publicação ficar pronta.
    if (previousConfig.messageId && previousConfig.messageId !== targetMessage.id) {
      const oldChannel = await guild.channels.fetch(String(previousConfig.channelId)).catch(() => null);
      const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(String(previousConfig.messageId)).catch(() => null) : null;
      if (oldMessage) await oldMessage.delete().catch(() => {});
    }
    sendJson(res, 200, { ok: true, config: saved, detail: "Configuração atualizada. Cargos de cor criados uma única vez e reutilizados nas próximas edições." });
    return true;
  } catch (error) {
    console.error("[Cores de Nick] Falha ao salvar:", error.stack || error.message || error);
    sendJson(res, error.status || 500, { detail: error.message || "Não foi possível salvar o sistema de cores." });
    return true;
  } finally {
    if (saveLockGuildId) activeGuildSaves.delete(saveLockGuildId);
  }
}

module.exports = { install, handleApi, COLORS };
