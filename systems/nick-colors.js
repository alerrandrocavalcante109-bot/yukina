"use strict";

const { AttachmentBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, PermissionsBitField, TextDisplayBuilder } = require("discord.js");
const { createCanvas } = require("@napi-rs/canvas");

const activeGuildSaves = new Set();

function createColorGrid(colors) {
  const columns = 2;
  const rows = Math.ceil(colors.length / columns);
  const width = 1000;
  const cellWidth = 480;
  const cellHeight = 92;
  const gap = 16;
  const padding = 18;
  const height = padding * 2 + rows * cellHeight + Math.max(0, rows - 1) * gap;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#23202b";
  ctx.fillRect(0, 0, width, height);

  colors.forEach((color, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + column * (cellWidth + gap);
    const y = padding + row * (cellHeight + gap);

    ctx.fillStyle = "#302b3a";
    ctx.beginPath();
    ctx.roundRect(x, y, cellWidth, cellHeight, 18);
    ctx.fill();

    ctx.fillStyle = "#f4efff";
    ctx.font = "bold 30px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(color.emoji, x + 24, y + cellHeight / 2);

    ctx.fillStyle = /^#[0-9A-Fa-f]{6}$/.test(color.hex) ? color.hex : "#c4b5fd";
    ctx.beginPath();
    ctx.arc(x + cellWidth - 48, y + cellHeight / 2, 27, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  return canvas.toBuffer("image/png");
}

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
      const guild = resolved.guild;
      // Atualiza os dois membros antes de comparar: GuildMember.manageable pode usar
      // a referência guild.members.me em cache, que pode estar desatualizada após mover cargos.
      const [member, botMember] = await Promise.all([
        guild.members.fetch({ user: user.id, force: true }).catch(() => null),
        guild.members.fetchMe({ force: true })
      ]);
      if (!member) return;
      const memberHighest = member.roles.highest;
      const botHighest = botMember.roles.highest;
      const hierarchyComparison = memberHighest.comparePositionTo(botHighest);
      if (hierarchyComparison >= 0) {
        console.warn("[Cores de Nick] Hierarquia impede alterar o membro após atualizar os dados do Discord.", {
          guildId: guild.id,
          userId: user.id,
          memberHighestRole: memberHighest.name,
          memberHighestRoleId: memberHighest.id,
          memberHighestPosition: memberHighest.position,
          botHighestRole: botHighest.name,
          botHighestRoleId: botHighest.id,
          botHighestPosition: botHighest.position,
          comparison: hierarchyComparison
        });
        return;
      }
      const selectedId = String(resolved.color.roleId);
      const selectedRole = await guild.roles.fetch(selectedId).catch(() => null);
      if (!selectedRole || !selectedRole.editable || selectedRole.position >= botMember.roles.highest.position) {
        console.warn("[Cores de Nick] Cargo de cor inexistente ou fora da hierarquia do bot.", { guildId: guild.id, roleId: selectedId });
        return;
      }
      const roleIds = (resolved.config.colors || []).map(item => String(item.roleId || "")).filter(Boolean);
      if (adding) {
        // Adiciona a nova cor antes de remover a anterior para não deixar o membro sem cor se o Discord recusar a operação.
        if (!member.roles.cache.has(selectedId)) await member.roles.add(selectedRole, "Cor de nick escolhida pelo membro");
        const remove = roleIds.filter(id => id !== selectedId && member.roles.cache.has(id));
        if (remove.length) await member.roles.remove(remove, "Troca de cor do nick pela Yukina");
        console.log("[Cores de Nick] Cor aplicada.", { guildId: guild.id, userId: user.id, roleId: selectedId });
      } else if (member.roles.cache.has(selectedId)) {
        await member.roles.remove(selectedRole, "Reação de cor removida");
        console.log("[Cores de Nick] Cor removida.", { guildId: guild.id, userId: user.id, roleId: selectedId });
      }
    } catch (error) {
      console.error("[Cores de Nick] Falha ao atualizar a cor:", { code: error.code, message: error.message, stack: error.stack });
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
    const channelRequired = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AddReactions, PermissionsBitField.Flags.ManageMessages];
    if (!channelPermissions || !channelRequired.every(flag => channelPermissions.has(flag))) {
      sendJson(res, 403, { detail: "No canal escolhido, dê à Yukina: Ver canal, Ler histórico de mensagens, Enviar mensagens, Incorporar links, Adicionar reações e Gerenciar mensagens. Gerenciar mensagens é necessário para limpar as reações antigas e atualizar o painel existente." });
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

    // Cargos de cor precisam ficar acima dos cargos comuns para que sua cor apareça no nick,
    // mas sempre abaixo do cargo mais alto da Yukina. Movemos um por vez para evitar setPositions em lote.
    for (const item of roles) {
      let freshRole = await guild.roles.fetch(item.role.id);
      let refreshedBotMember = await guild.members.fetchMe();
      if (!freshRole || freshRole.managed || freshRole.position >= refreshedBotMember.roles.highest.position || !freshRole.editable) {
        sendJson(res, 403, { detail: "O cargo " + item.role.name + " não pode ser gerenciado pela Yukina. Coloque o cargo mais alto da Yukina acima dele e tente novamente." });
        return true;
      }
      const targetPosition = Math.max(1, refreshedBotMember.roles.highest.position - 1);
      if (freshRole.position !== targetPosition) {
        freshRole = await freshRole.setPosition(targetPosition, { reason: "Priorizar a cor de nick sem ultrapassar a hierarquia da Yukina" });
      }
      item.role = freshRole;
    }

    for (const item of roles) {
      const currentRole = await guild.roles.fetch(item.role.id);
      if (currentRole.hexColor.toUpperCase() !== item.hex) {
        await currentRole.edit({ color: item.hex }, "Cor definida pelo administrador no painel da Yukina");
      }
    }

    const colorImage = new AttachmentBuilder(createColorGrid(roles), { name: "nick-colors.png" });
    const container = new ContainerBuilder()
      .setAccentColor(0xc4b5fd)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## 🎨 Escolha a cor do seu nick\n" + messageText)
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL("attachment://nick-colors.png")
        )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("*Yukina • Reaja com o número ou letra da cor desejada. Uma cor por membro.*")
      );

    // Mantém uma única mensagem V2: um contêiner com as cores reais em duas colunas.
    let targetMessage = null;
    if (previousConfig.messageId && String(previousConfig.channelId) === channel.id) {
      targetMessage = await channel.messages.fetch(String(previousConfig.messageId)).catch(() => null);
    }
    if (targetMessage) {
      await targetMessage.edit({ content: null, embeds: [], components: [container], files: [colorImage], attachments: [], flags: MessageFlags.IsComponentsV2 });
      await targetMessage.reactions.removeAll().catch(() => {});
    } else {
      targetMessage = await channel.send({ components: [container], files: [colorImage], flags: MessageFlags.IsComponentsV2 });
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
    console.error("[Cores de Nick] Falha ao salvar:", { code: error.code, message: error.message, stack: error.stack });
    const missingPermissions = Number(error.code) === 50013;
    sendJson(res, missingPermissions ? 403 : (error.status || 500), { detail: missingPermissions ? "O Discord bloqueou uma ação da Yukina (Missing Permissions). Confira se ela tem Gerenciar cargos no servidor e, no canal escolhido, Ver canal, Ler histórico, Enviar mensagens, Incorporar links, Adicionar reações e Gerenciar mensagens. O cargo mais alto da Yukina também precisa ficar acima dos cargos de cor." : (error.message || "Não foi possível salvar o sistema de cores.") });
    return true;
  } finally {
    if (saveLockGuildId) activeGuildSaves.delete(saveLockGuildId);
  }
}

module.exports = { install, handleApi, COLORS };
