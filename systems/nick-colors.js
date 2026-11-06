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
    if (!message.guild || message.author?.id !== client.user.id) return;
    const collection = await getSettingsCollection();
    const doc = await collection.findOne(
      { guildId: message.guild.id },
      { projection: { "settings.nickColors": 1 } }
    );
    const config = doc?.settings?.nickColors;
    if (!config?.enabled || String(config.messageId) !== message.id) return;
    const color = (config.colors || []).find(item => item.emoji === reaction.emoji.name);
    if (!color?.roleId) return;
    return { config, color, guild: message.guild };
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

module.exports = { install, COLORS };
