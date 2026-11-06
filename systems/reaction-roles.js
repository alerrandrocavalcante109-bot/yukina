"use strict";

const { EmbedBuilder, PermissionsBitField } = require("discord.js");

const EMOJIS = ["🎮","🎨","🎵","🎬","📚","⚽","🌸","🌙","⭐","🔥","💎","🦋","🐺","🐱","🐼","🍀","🌻","🍓","☕","🎧"];

function install(client, getSettingsCollection) {
  async function resolve(reaction) {
    if (reaction.partial) await reaction.fetch();
    let message = reaction.message;
    if (message.partial) message = await message.fetch();
    if (!message.guild) return null;
    const collection = await getSettingsCollection();
    const doc = await collection.findOne({ guildId: message.guild.id }, { projection: { "settings.reactionRoles": 1 } });
    const config = doc?.settings?.reactionRoles;
    const panels = Array.isArray(config?.panels) ? config.panels : (config?.messageId ? [config] : []);
    for (const panel of panels) {
      if (!panel?.enabled || String(panel.messageId) !== String(message.id)) continue;
      const item = (panel.items || []).find(entry => entry.emoji === reaction.emoji.name);
      if (item) return { guild: message.guild, item, messageId: message.id };
    }
    return null;
  }

  async function updateRole(reaction, user, add) {
    if (!user || user.bot) return;
    try {
      const found = await resolve(reaction);
      if (!found) return;
      const [member, botMember, role] = await Promise.all([
        found.guild.members.fetch({ user: user.id, force: true }).catch(() => null),
        found.guild.members.fetchMe().catch(() => null),
        found.guild.roles.fetch(String(found.item.roleId)).catch(() => null)
      ]);
      if (!member) {
        console.warn("[Cargos por reação] Membro não encontrado:", user.id);
        return;
      }
      if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        console.error("[Cargos por reação] A Yukina está sem a permissão Gerenciar cargos.");
        return;
      }
      if (!role || role.managed || role.id === found.guild.id) {
        console.warn("[Cargos por reação] Cargo configurado não existe ou não pode ser atribuído:", found.item.roleId);
        return;
      }
      if (role.comparePositionTo(botMember.roles.highest) >= 0) {
        console.warn("[Cargos por reação] Cargo acima ou no mesmo nível do cargo mais alto da Yukina:", role.name, role.id);
        return;
      }
      if (member.id === botMember.id) return;
      if (member.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
        console.warn("[Cargos por reação] Membro está acima ou no mesmo nível da Yukina:", member.user.tag, member.id);
        return;
      }
      if (add && !member.roles.cache.has(role.id)) {
        await member.roles.add(role, "Cargo obtido por reação configurada no painel da Yukina");
        console.log("[Cargos por reação] Cargo atribuído:", role.name, "->", member.user.tag);
      } else if (!add && member.roles.cache.has(role.id)) {
        await member.roles.remove(role, "Reação de cargo removida");
        console.log("[Cargos por reação] Cargo removido:", role.name, "->", member.user.tag);
      }
    } catch (error) {
      console.error("[Cargos por reação] Falha ao " + (add ? "atribuir" : "remover") + " cargo:", {
        code: error.code, message: error.message, userId: user.id, stack: error.stack
      });
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
      const panels = Array.isArray(previous?.panels) ? previous.panels : (previous?.messageId ? [previous] : []);
      sendJson(res, 200, { ok: true, config: panels[0] || null, panels, emojis: EMOJIS });
      return true;
    }

    const panelId = String(body.panelId || "").trim().slice(0, 80) || "default";
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
    const channelRequired = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AddReactions, PermissionsBitField.Flags.ManageMessages];
    if (!channelPerms || !channelRequired.every(flag => channelPerms.has(flag))) {
      sendJson(res, 403, { detail: "No canal escolhido, dê à Yukina: Ver canal, Ler histórico de mensagens, Enviar mensagens, Incorporar links, Adicionar reações e Gerenciar mensagens. Gerenciar mensagens é necessário para limpar as reações antigas e atualizar o painel existente." });
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
      .setDescription([messageText, "", ...items.map(item => item.emoji + "  **" + item.roleName.replace(/[*_~`|]/g, "") + "**")].join("\n"))
      .setFooter({ text: "Yukina • Reaja para receber ou remover o cargo." });

    const previousPanels = Array.isArray(previous?.panels) ? previous.panels : (previous?.messageId ? [{ ...previous, panelId: "default" }] : []);
    const previousPanel = previousPanels.find(panel => String(panel.panelId || "default") === panelId) || null;
    let message = null;
    if (previousPanel?.messageId && String(previousPanel.channelId) === channel.id) {
      message = await channel.messages.fetch(String(previousPanel.messageId)).catch(() => null);
    }
    if (message) {
      await message.edit({ content: null, embeds: [embed] });
      await message.reactions.removeAll();
    } else {
      message = await channel.send({ embeds: [embed] });
    }
    for (const item of items) await message.react(item.emoji);

    const saved = {
      panelId, enabled: true, channelId: channel.id, channelName: channel.name, messageId: message.id,
      message: messageText, items, updatedAt: new Date().toISOString()
    };
    const panels = previousPanels.filter(panel => String(panel.panelId || "default") !== panelId);
    panels.push(saved);
    const stored = { enabled: true, panels, updatedAt: new Date().toISOString() };
    await collection.updateOne(
      { guildId },
      { $set: { guildId, guildName: guild.name, "settings.reactionRoles": stored, updatedAt: new Date() } },
      { upsert: true }
    );

    if (previousPanel?.messageId && String(previousPanel.messageId) !== message.id) {
      const oldChannel = await guild.channels.fetch(String(previousPanel.channelId)).catch(() => null);
      const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(String(previousPanel.messageId)).catch(() => null) : null;
      if (oldMessage) await oldMessage.delete().catch(() => {});
    }
    sendJson(res, 200, { ok: true, config: saved, panels, detail: "Painel de cargos por reação salvo." });
    return true;
  } catch (error) {
    console.error("[Cargos por reação] Falha ao salvar:", { code: error.code, message: error.message, stack: error.stack });
    const missingPermissions = Number(error.code) === 50013;
    sendJson(res, missingPermissions ? 403 : (error.status || 500), { detail: missingPermissions ? "O Discord bloqueou uma ação da Yukina (Missing Permissions). Confira Gerenciar cargos no servidor e, no canal escolhido, Ver canal, Ler histórico, Enviar mensagens, Incorporar links, Adicionar reações e Gerenciar mensagens. Os cargos selecionados também precisam ficar abaixo do cargo mais alto da Yukina." : (error.message || "Não foi possível salvar os cargos por reação.") });
    return true;
  }
}

module.exports = { install, handleApi, EMOJIS };
