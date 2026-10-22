require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
  Colors,
  EmbedBuilder,
  REST,
  Routes,
} = require("discord.js");
const http = require("node:http");
const { MongoClient } = require("mongodb");
const fs = require("node:fs");
const path = require("node:path");
const memberData = require("./member-data");
const temporalStorage = require("./system-storage").forSystem("temporal-hierarchy");
const xpStorage = require("./system-storage").forSystem("xp-level-roles");
const xpMultiplierStorage = require("./system-storage").forSystem("xp-multipliers");
const { parseCountingValue } = require("./counting-number-parser");
const { getVipCollection } = require("./vip-store");

const TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const AI_API_URL = (process.env.AI_API_URL || "https://openrouter.ai/api/v1/chat/completions").trim();
const AI_MODEL = (process.env.AI_MODEL || "meta-llama/llama-3.3-70b-instruct:free").trim();

if (!TOKEN) {
  console.error("❌ [Yukina] Token do Discord ausente. Configure DISCORD_TOKEN nas variáveis de ambiente do Render.");
  process.exit(1);
}

const SYSTEM_PROMPT = `Você é Yukina, uma guardiã de uma fantasia japonesa de neve, luar e constelações, com um toque acolhedor de anime e magia serena. Sua identidade visual usa azul-gelo, azul-noite, branco perolado, prata, sakura e brilho de estrelas. Ao planejar canais, preserve a personalidade do universo Yukina: nomes elegantes, acolhedores e temáticos sem exagerar em emojis ou deixar os nomes difíceis de entender.
Converta o pedido em JSON válido, sem Markdown, usando EXATAMENTE esta estrutura:
{
 "style_tips": ["dica de estilo"],
 "roles": [{"name":"Nome","color":"#5865F2","hoist":false,"mentionable":false}],
 "categories": [{"name":"Nome"}],
 "channels": [{"name":"nome-do-canal","type":"text|voice|forum|stage","category":"Nome exato da categoria ou null","topic":"descrição curta","suggestion":"mensagem curta, temática e prática para orientar como usar este canal"}],
 "delete_roles": ["nome exato do cargo a excluir"],
 "delete_categories": ["nome exato da categoria a excluir"],
 "delete_channels": ["nome exato do canal a excluir"]
}
ESTILO YUKINA PARA CANAIS:
- Para cada canal criado, escreva uma sugestão específica e útil em "suggestion": o que publicar/fazer nele, como manter a organização e qual clima/comportamento combina com ele.
- Escreva como a Yukina, gentil e levemente mística, usando referências sutis a neve, lua, sakura, estrelas ou santuário apenas quando combinarem com o propósito. Evite repetir a mesma frase e não force fantasia em canais sérios, regras ou suporte.
- O texto deve ter 1 a 3 frases, em português, sem mencionar IA. Não invente regras oficiais; apresente como sugestão.
- "topic" deve ser uma descrição clara e curta, adequada à finalidade do canal.
REGRAS CRÍTICAS DE EXCLUSÃO:
- Só preencha os arrays delete_* se o usuário pedir claramente para excluir, apagar, deletar ou remover.
- Liste SOMENTE nomes exatos explicitamente indicados pelo usuário; nunca invente nomes, nunca interprete "limpar tudo" como autorização para apagar tudo.
- Se o alvo for ambíguo ou o usuário não especificar o nome exato, deixe os arrays delete_* vazios e peça esclarecimento em style_tips.
- Excluir uma categoria NÃO significa excluir os canais dentro dela.
- Não coloque itens para exclusão nos arrays de criação.
Para criação: crie apenas o que foi pedido e complemente com sugestões úteis. Nomes de canais em minúsculas com hífens são preferíveis. Cores devem ser HEX. Não inclua permissões administrativas nos cargos; a aplicação usará permissões seguras padrão. Limites: até 12 cargos, 12 categorias, 30 canais e 10 exclusões por tipo. Responda SOMENTE com JSON válido.`;

function cleanJson(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*|\s*```$/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA não retornou um JSON válido.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function createPlan(prompt) {
  const apiKey = (process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Chave da API ausente. No Render, configure AI_API_KEY com sua chave do provedor de IA.");
  }
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.35,
      max_tokens: 3000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: String(prompt).slice(0, 2500) },
      ],
    }),
    signal: AbortSignal.timeout(50000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`Erro na API de IA (${response.status}): ${detail}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("A API de IA não retornou conteúdo.");
  const plan = cleanJson(content);
  for (const key of ["roles", "categories", "channels", "style_tips", "delete_roles", "delete_categories", "delete_channels"]) {
    if (!Array.isArray(plan[key])) plan[key] = [];
  }
  plan.roles = plan.roles.slice(0, 12);
  plan.categories = plan.categories.slice(0, 12);
  plan.channels = plan.channels.slice(0, 30);
  plan.style_tips = plan.style_tips.slice(0, 6).map((x) => String(x).slice(0, 250));
  for (const key of ["delete_roles", "delete_categories", "delete_channels"]) {
    plan[key] = plan[key].slice(0, 10).map((x) => String(x || "").trim().slice(0, 100)).filter(Boolean);
  }
  return plan;
}

function makeChannelNameOptions(name) {
  const base = String(name || "chat-geral").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 70) || "chat-geral";
  const pretty = base.replace(/-/g, "・");
  return [
    { label: `❄️・${base}`, name: `❄️・${base}` },
    { label: `🌙・${pretty}`, name: `🌙・${pretty}` },
    { label: `✧・${base}・✧`, name: `✧・${base}・✧` },
    { label: `୨୧・${base}`, name: `୨୧・${base}` },
    { label: `☾・${pretty}`, name: `☾・${pretty}` },
    { label: `❅・${base}・❅`, name: `❅・${base}・❅` },
    { label: `✦・${pretty}`, name: `✦・${pretty}` },
    { label: `🌸・${base}`, name: `🌸・${base}` },
    { label: `「${base}」`, name: `「${base}」` },
    { label: `꒰ა・${pretty}・໒꒱`, name: `꒰ა・${pretty}・໒꒱` },
  ];
}

function makeCategoryNameOptions(name) {
  const base = String(name || "categoria").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 80) || "categoria";
  const pretty = base.replace(/-/g, "・");
  return [
    { label: `❄️・${pretty}`, name: `❄️・${pretty}` },
    { label: `🌙・${base}`, name: `🌙・${base}` },
    { label: `✧・${pretty}・✧`, name: `✧・${pretty}・✧` },
    { label: `୨୧・${base}`, name: `୨୧・${base}` },
    { label: `☾・${pretty}`, name: `☾・${pretty}` },
    { label: `❅・${base}・❅`, name: `❅・${base}・❅` },
    { label: `✦・${pretty}`, name: `✦・${pretty}` },
    { label: `🌸・${base}`, name: `🌸・${base}` },
    { label: `「${pretty}」`, name: `「${pretty}」` },
    { label: `꒰ა・${base}・໒꒱`, name: `꒰ა・${base}・໒꒱` },
  ];
}

function makeRoleNameOptions(name) {
  const base = String(name || "membro").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 80) || "membro";
  const pretty = base.replace(/-/g, "・");
  return [
    { label: `❄️・${base}`, name: `❄️・${base}` },
    { label: `🌙・${pretty}`, name: `🌙・${pretty}` },
    { label: `✧・${base}・✧`, name: `✧・${base}・✧` },
    { label: `୨୧・${pretty}`, name: `୨୧・${pretty}` },
    { label: `☾・${base}`, name: `☾・${base}` },
    { label: `❅・${pretty}・❅`, name: `❅・${pretty}・❅` },
    { label: `✦・${base}`, name: `✦・${base}` },
    { label: `🌸・${pretty}`, name: `🌸・${pretty}` },
    { label: `「${base}」`, name: `「${base}」` },
    { label: `꒰ა・${pretty}・໒꒱`, name: `꒰ა・${pretty}・໒꒱` },
  ];
}

function makeRoleColorOptions() {
  return [
    { name: "Azul-gelo", hex: "#A7D8F0", swatch: "🩵" },
    { name: "Prata lunar", hex: "#DCE6F2", swatch: "🤍" },
    { name: "Azul-noite", hex: "#29345C", swatch: "🌌" },
    { name: "Rosa sakura", hex: "#F2A7C6", swatch: "🌸" },
    { name: "Lavanda mágica", hex: "#B9A7E8", swatch: "💜" },
    { name: "Verde aurora", hex: "#83D6C5", swatch: "🩵" },
    { name: "Pérola", hex: "#F5F1E8", swatch: "🫧" },
    { name: "Dourado estelar", hex: "#F4D58D", swatch: "✨" },
    { name: "Azul cristal", hex: "#C7E7FF", swatch: "❄️" },
    { name: "Violeta noturno", hex: "#8E7CC3", swatch: "🌙" },
  ];
}

async function waitForExactReply(channel, userId, guildId, accepted) {
  const collected = await channel.awaitMessages({
    filter: (reply) => reply.author.id === userId &&
      reply.guild?.id === guildId &&
      accepted.includes(reply.content.trim().toUpperCase()),
    max: 1,
    time: 60000,
    errors: [],
  });
  return collected.first() || null;
}


async function moveMentionedChannel(message, request) {
  const marker = "<" + "#";
  const tagPattern = new RegExp(marker + "([0-9]{15,22})>");
  const match = String(request).match(tagPattern);
  if (!match) return null;
  const channel = await message.guild.channels.fetch(match[1]).catch(() => null);
  if (!channel || channel.type === ChannelType.GuildCategory) return "Não encontrei um canal válido nessa menção.";
  const targetName = String(request).replace(tagPattern, " ")
    .replace(/^\s*(?:mover|mude|mudar|transferir|colocar)\s*/i, "")
    .replace(/\b(?:para\s+)?(?:a\s+)?categoria\s*[:：-]?\s*/i, "").trim();
  if (!targetName) return "Marque o canal e escreva o nome da categoria de destino.";
  const category = message.guild.channels.cache.find((item) =>
    item.type === ChannelType.GuildCategory && item.name.toLowerCase() === targetName.toLowerCase()
  );
  if (!category) {
    const available = message.guild.channels.cache.filter((item) => item.type === ChannelType.GuildCategory).map((item) => item.name);
    return available.length ? `Não encontrei **${targetName}**. Categorias disponíveis: ${available.join(", ")}.` : "Não há categorias neste servidor.";
  }
  try {
    await channel.setParent(category.id, { lockPermissions: false, reason: "Canal movido a pedido via Yukina" });
    return "Canal " + marker + channel.id + "> movido para a categoria **" + category.name + "**.";
  } catch (error) {
    return `Não consegui mover o canal: ${String(error.message || error).slice(0, 200)}`;
  }
}

function formatPlan(plan) {
  const lines = ["**Sugestões de estilo da Yukina**"];
  lines.push(...plan.style_tips.slice(0, 5).map((tip) => `• ${tip}`));
  lines.push(`\n**Plano:** ${plan.categories.length} categorias · ${plan.roles.length} cargos · ${plan.channels.length} canais`);
  if (plan.categories.length) lines.push("Categorias: " + plan.categories.map((x) => x.name).filter(Boolean).join(", "));
  if (plan.roles.length) lines.push("Cargos: " + plan.roles.map((x) => x.name).filter(Boolean).join(", "));
  return lines.join("\n").slice(0, 3800);
}

async function buildServer(guild, plan) {
  const results = [];
  const categoryMap = new Map(guild.channels.cache
    .filter((channel) => channel.type === ChannelType.GuildCategory)
    .map((category) => [category.name.toLocaleLowerCase(), category]));

  for (const item of plan.categories) {
    const name = String(item?.name || "").trim().slice(0, 100);
    if (!name || categoryMap.has(name.toLocaleLowerCase())) continue;
    const category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      reason: "Estrutura solicitada à Yukina por administrador",
    });
    categoryMap.set(name.toLocaleLowerCase(), category);
    results.push(`Categoria criada: ${name}`);
  }

  for (const item of plan.roles) {
    const name = String(item?.name || "").trim().slice(0, 100);
    if (!name || guild.roles.cache.some((role) => role.name.toLocaleLowerCase() === name.toLocaleLowerCase())) continue;
    let color = String(item?.color || "#5865F2");
    if (!/^#[0-9a-f]{6}$/i.test(color)) color = "#5865F2";
    await guild.roles.create({
      name,
      color,
      hoist: Boolean(item?.hoist),
      mentionable: Boolean(item?.mentionable),
      permissions: [],
      reason: "Cargo sugerido pela Yukina com IA",
    });
    results.push(`Cargo criado: ${name}`);
  }

  const typeMap = {
    text: ChannelType.GuildText,
    voice: ChannelType.GuildVoice,
    forum: ChannelType.GuildForum,
    stage: ChannelType.GuildStageVoice,
  };

  for (const item of plan.channels) {
    const name = String(item?.name || "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 100);
    const kind = String(item?.type || "text").toLowerCase();
    if (!name || !typeMap[kind]) continue;
    const categoryName = String(item?.category || "").toLocaleLowerCase();
    const parent = categoryMap.get(categoryName) || null;
    const exists = guild.channels.cache.some((channel) =>
      channel.name.toLocaleLowerCase() === name && (channel.parentId || null) === (parent?.id || null)
    );
    if (exists) continue;

    const options = {
      name,
      type: typeMap[kind],
      parent: parent?.id || undefined,
      reason: "Canal criado pela Yukina a pedido de administrador",
    };
    const topic = String(item?.topic || "").slice(0, 1024);
    if ([ChannelType.GuildText, ChannelType.GuildForum].includes(typeMap[kind]) && topic) {
      options.topic = topic;
    }
    let createdChannel;
    try {
      createdChannel = await guild.channels.create(options);
      results.push(`Canal ${kind} criado: ${name}${parent ? ` na categoria ${parent.name}` : " sem categoria"}`);
    } catch (error) {
      results.push(`FALHA ao criar canal ${name}${parent ? ` na categoria ${parent.name}` : ""}: ${String(error.message || error).slice(0, 180)}`);
      console.error("Falha ao criar canal no Discord:", { name, kind, category: parent?.name || null, code: error.code, message: error.message });
      continue;
    }

    const suggestion = String(item?.suggestion || "").trim().slice(0, 1400);
    if (suggestion && typeMap[kind] === ChannelType.GuildText) {
      try {
        const embed = new EmbedBuilder()
          .setColor(0xA7D8F0)
          .setAuthor({ name: "Yukina · Guia do canal", iconURL: guild.client.user.displayAvatarURL() })
          .setTitle("❄️ Um pequeno conselho para este espaço")
          .setDescription(suggestion)
          .setFooter({ text: "Sob o luar de Yukina · Sugestão de uso, ajustável pela comunidade" });
        await createdChannel.send({ embeds: [embed], allowedMentions: { parse: [] } });
        results.push(`Sugestão temática enviada em #${name}`);
      } catch (error) {
        results.push(`Canal criado, mas não consegui enviar a sugestão em #${name}`);
      }
    } else if (suggestion) {
      results.push(`Sugestão para ${name}: ${suggestion.slice(0, 220)}`);
    }
  }
  return results;
}

async function applyDeletions(guild, plan) {
  const results = [];
  const me = guild.members.me;
  const botTopRole = me?.roles?.highest;

  // Delete only exact name matches. Managed roles and roles at/above the bot's
  // highest role are never deletable by this routine.
  for (const target of plan.delete_channels || []) {
    const name = String(target).trim();
    const channel = guild.channels.cache.find((item) => item.name === name);
    if (!channel) {
      results.push(`Canal não encontrado (não excluído): ${name}`);
      continue;
    }
    try {
      await channel.delete("Exclusão explicitamente confirmada por administrador via Yukina");
      results.push(`Canal excluído: ${name}`);
    } catch (error) {
      results.push(`Falha ao excluir canal ${name}: ${String(error.message || error).slice(0, 100)}`);
    }
  }

  // Removing a category does not delete its child channels.
  for (const target of plan.delete_categories || []) {
    const name = String(target).trim();
    const category = guild.channels.cache.find((item) =>
      item.type === ChannelType.GuildCategory && item.name === name
    );
    if (!category) {
      results.push(`Categoria não encontrada (não excluída): ${name}`);
      continue;
    }
    try {
      await category.delete("Exclusão explicitamente confirmada por administrador via Yukina");
      results.push(`Categoria excluída (canais mantidos): ${name}`);
    } catch (error) {
      results.push(`Falha ao excluir categoria ${name}: ${String(error.message || error).slice(0, 100)}`);
    }
  }

  for (const target of plan.delete_roles || []) {
    const name = String(target).trim();
    const role = guild.roles.cache.find((item) => item.name === name);
    if (!role) {
      results.push(`Cargo não encontrado (não excluído): ${name}`);
      continue;
    }
    if (role.id === guild.id || role.managed || !botTopRole || role.position >= botTopRole.position) {
      results.push(`Cargo protegido ou acima da Yukina (não excluído): ${name}`);
      continue;
    }
    try {
      await role.delete("Exclusão explicitamente confirmada por administrador via Yukina");
      results.push(`Cargo excluído: ${name}`);
    } catch (error) {
      results.push(`Falha ao excluir cargo ${name}: ${String(error.message || error).slice(0, 100)}`);
    }
  }
  return results;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration],
  // Deixe o discord.js gerenciar descoberta do Gateway, handshake,
  // heartbeat, reconexão e limites de API com as opções padrão da biblioteca.
  // Não sobrescreva fetchGatewayInformation: a implementação precisa seguir
  // a versão real do discord.js instalada pelo Render.
});

// Os sistemas são carregados somente depois que o Gateway confirmar que a Yukina está online.
let systemsLoaded = false;
function loadYukinaSystems() {
  if (systemsLoaded) return;
  systemsLoaded = true;
  console.log("[Yukina] Conexão estabelecida; iniciando os sistemas em seguida...");
  require("./command-engine")(client);
  require("./rank-system")(client);
  require("./xp-level-system")(client);
  require("./time-role-system")(client);
  require("./staff-promotion-announcements")(client);
  require("./interaction")(client);
}


// Diagnóstico do processo de descoberta e conexão do Gateway.
client.on("error", (error) => {
  console.error("[Discord Client error]", error?.stack || error?.message || error);
});
client.on("shardError", (error, shardId) => {
  console.error("[Discord Gateway] Erro no shard " + shardId + ":", error?.stack || error?.message || error);
});
client.on("shardDisconnect", (event, shardId) => {
  console.error("[Discord Gateway] Desconectado. Shard:", shardId, "Código:", event?.code, "Motivo:", event?.reason || "não informado");
});
client.on("shardReconnecting", (shardId) => {
  console.warn("[Discord Gateway] Reconectando shard:", shardId);
});
// Diagnóstico do Gateway com eventos únicos; a reconexão automática fica a cargo do discord.js.
client.on("debug", (message) => {
  if (/provided token/i.test(message)) return;
  if (/heartbeat acknowledged/i.test(message)) return;
  console.log("[Discord debug]", message);
});

client.on("error", (error) => {
  console.error("[Discord] Erro do cliente:", error?.stack || error?.message || error);
});
client.on("shardError", (error, shardId) => {
  console.error("[Discord Gateway] Erro no shard " + shardId + ":", error?.stack || error?.message || error);
});
client.on("shardDisconnect", (event, shardId) => {
  console.warn("[Discord Gateway] Shard " + shardId + " desconectado:", {
    code: event?.code,
    reason: event?.reason || "não informado",
    closeCode: event?.code === 1000 ? "normal" : "verificar causa",
  });
});
client.on("shardReconnecting", (shardId) => {
  console.warn("[Discord Gateway] Reconectando shard " + shardId + "...");
});
client.on("shardResume", (shardId, replayedEvents) => {
  console.log("[Discord Gateway] Sessão retomada:", { shardId, replayedEvents });
});
client.on("invalidated", () => {
  console.error("[Discord Gateway] Sessão invalidada pelo Discord; encerrando para reinicialização limpa.");
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1000).unref();
});

process.on("unhandledRejection", (reason) => {
  console.error("[Node.js] Promise rejeitada sem tratamento:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Node.js] Exceção não capturada; encerrando para permitir reinício limpo:", error);
  process.exit(1);
});

const removedModerationCommands = new Set(["cargo", "clear", "deletar", "limpar", "lock", "log", "moderar", "promover", "unlock"]);

async function registerSlashCommands() {
  const commandsDir = path.join(__dirname, "commands");
  const commands = [];

  function collect(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.startsWith("_")) {
        try {
          delete require.cache[require.resolve(file)];
          const command = require(file);
          if (command?.data?.toJSON && typeof command.execute === "function") {
            commands.push(command.data.toJSON());
          }
        } catch (error) {
          console.error("[Slash] Não consegui carregar " + path.relative(__dirname, file) + ":", error.message);
        }
      }
    }
  }

  collect(commandsDir);
  if (!commands.length) {
    // Sem comandos locais, não há nada para sincronizar.
    return;
  }

  // O ID da aplicação pode ser obtido do próprio cliente já conectado.
  // Assim, a ausência opcional de DISCORD_CLIENT_ID não impede o registro dos slash commands.
  const clientId = (process.env.DISCORD_CLIENT_ID || client.user?.id || "").trim();
  if (!clientId) {
    console.error("[Slash] Não foi possível identificar o ID da aplicação; comandos slash não registrados.");
    return;
  }
  const guildId = (process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "").trim();
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    const existing = await rest.get(route);
    const merged = new Map((Array.isArray(existing) ? existing : []).filter((command) => command.name !== "boasvindas" && !removedModerationCommands.has(command.name)).map((command) => [command.name, command]));
    for (const command of commands) merged.set(command.name, command);
    const result = await rest.put(route, { body: [...merged.values()] });
    console.log(`[Slash] ${commands.length} comando(s) local(is) sincronizado(s); ${result.length} comando(s) disponíveis ${guildId ? "no servidor " + guildId : "globalmente"}.`);
    console.log(`[Slash] Comando /painel ${commands.some(command => command.name === "painel") ? "incluído na sincronização" : "NÃO encontrado na pasta commands"}.`);
  } catch (error) {
    console.error("[Slash] Falha no registro automático dos comandos:", {
      code: error?.code,
      status: error?.status,
      message: error?.message,
    });
  }
}

async function ensurePromotionNotifyRole() {
  const roleName = (process.env.PROMOTION_NOTIFY_ROLE_NAME || "📣・Avisos de promoção").trim();
  const configuredId = (process.env.PROMOTION_NOTIFY_ROLE_ID || "").trim();

  for (const guild of client.guilds.cache.values()) {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      console.warn("[Promoções] Sem Gerenciar cargos em " + guild.name + "; não foi possível conferir/criar o cargo de avisos.");
      continue;
    }

    let role = configuredId ? await guild.roles.fetch(configuredId).catch(() => null) : null;
    if (!role) role = guild.roles.cache.find((item) => item.name === roleName) || null;

    if (!role) {
      try {
        role = await guild.roles.create({
          name: roleName,
          color: "#C7E7FF",
          hoist: false,
          mentionable: true,
          permissions: [],
          reason: "Cargo de notificação dos anúncios de promoção da Yukina",
        });
        console.log("[Promoções] Cargo criado: " + role.name + " (" + role.id + ") no servidor " + guild.name);
      } catch (error) {
        console.error("[Promoções] Não consegui criar o cargo de avisos em " + guild.name + ":", error.message);
        continue;
      }
    }

    console.log("[Promoções] Cargo de notificação disponível em " + guild.name + ": " + role.name + " (" + role.id + ")");
  }
}

function startupLog(message = "") {
  const time = new Date().toLocaleTimeString("pt-BR", { hour12: false, timeZone: "UTC" });
  console.log(`❄️ [${time} UTC] ${message}`);
}

client.once("clientReady", async () => {
  discordReady = true;
  clearTimeout(loginWatchdog);
  console.log("[Discord] Evento clientReady recebido; cliente autenticado e pronto.");
  console.log("");
  console.log("╭──────────────────────────────────────────────╮");
  console.log("│          ❄️  Y U K I N A  🌙                 │");
  console.log("│       ✦ Sob o luar, entre estrelas ✦         │");
  console.log("╰──────────────────────────────────────────────╯");
  console.log("");
  startupLog("🩵 Conexão com o Discord estabelecida!");
  loadYukinaSystems();
  require("./vip-reminders")(client);
  require("./daily-reminders")(client);
  startupLog(`🌸 Identidade: ${client.user.tag}`);
  startupLog(`🏠 Servidores conectados: ${client.guilds.cache.size}`);
  startupLog("⚙️ Preparando os sistemas da Yukina...");
  const systems = [
    ["🧩 Construtor de servidores", "menção à Yukina + permissões de servidor"],
    ["🌙 Comandos Slash", "carregamento e sincronização automática"],
    ["🪄 Interações", "botões, menus e modais"],
    ["📣 Avisos de promoção", "cargo de notificação e canal de promoções"],
    ["❄️ Hierarquia de membros", "cargos automáticos por XP e tempo de permanência"],
    ["✨ Níveis de XP", "12 cargos automáticos do nível 1 ao 100"],
    ["💓 Monitor de serviço", "endpoint HTTP para health check"],
    ["🤖 Assistente de organização", (process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY) ? "API configurada" : "aguardando AI_API_KEY/OPENROUTER_API_KEY"],
  ];
  console.log("");
  console.log("╭────────────── ❄️ SISTEMAS YUKINA ❄️ ──────────────╮");
  for (const [name, detail] of systems) {
    startupLog(`${name} — ${detail}`);
  }
  console.log("╰──────────────────────────────────────────────────╯");
  console.log("");

  await registerSlashCommands();
  await ensurePromotionNotifyRole();

  console.log("");
  startupLog("✨ Inicialização concluída. Yukina está pronta para ajudar!");
  console.log("❄️──────────────────────────────────────────────🌙");
  console.log("");
});

const countingQueues = new Map();
async function handleCountingMessage(message) {
  if (message.author.bot || !message.guild || !message.channel?.isTextBased()) return;
  const task = async () => {
    try {
      const collection = await getSettingsCollection();
      const doc = await collection.findOne(
        { guildId: message.guild.id },
        { projection: { "settings.countingSystem": 1 } }
      );
      const config = doc?.settings?.countingSystem;
      if (!config?.enabled || !config.channelId || config.channelId !== message.channel.id) return;

      const raw = String(message.content || "").trim();
      // Reconhece algarismos, números por extenso, romanos, numerais CJK e expressões matemáticas.
      // Mensagens com emojis são ignoradas pelo parser, sem alterar a sequência.
      const numeric = parseCountingValue(raw);
      if (numeric === null) return;
      const expected = Math.max(0, Number(config.currentNumber) || 0) + 1;
      const repeatedUser = String(message.author.id) === String(config.lastUserId || "");

      if (repeatedUser || !Number.isSafeInteger(numeric) || numeric !== expected) {
        await message.react("❌").catch(() => {});
        await collection.updateOne(
          { guildId: message.guild.id },
          { $set: { "settings.countingSystem.currentNumber": 0, "settings.countingSystem.lastUserId": "" } }
        );
        await message.channel.send({
          content: repeatedUser
            ? "❌ Você não pode contar duas vezes seguidas! A sequência voltou ao início. O próximo número é **1**."
            : "❌ Contagem incorreta! A sequência voltou ao início. O próximo número é **1**.",
          allowedMentions: { parse: [] }
        }).catch(() => {});
        return;
      }

      await collection.updateOne(
        { guildId: message.guild.id },
        { $set: { "settings.countingSystem.currentNumber": numeric, "settings.countingSystem.lastUserId": message.author.id } }
      );
      await message.react("✅").catch(() => {});
    } catch (error) {
      console.error("[Contagem] Não foi possível processar a mensagem:", error.message || error);
    }
  };
  const previous = countingQueues.get(message.guild.id) || Promise.resolve();
  const next = previous.then(task, task);
  countingQueues.set(message.guild.id, next);
  try { await next; } finally { if (countingQueues.get(message.guild.id) === next) countingQueues.delete(message.guild.id); }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  await handleCountingMessage(message);
  if (!client.user || !message.mentions.has(client.user)) return;

  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
      !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.channel.send({ content: "Para montar canais, categorias e cargos, você precisa ter **Gerenciar servidor** ou **Administrador**.", allowedMentions: { repliedUser: false } });
    return;
  }

  const me = message.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await message.channel.send({ content: "Preciso das permissões **Gerenciar canais** e **Gerenciar cargos**. Confira também se meu cargo está acima dos cargos que devo criar.", allowedMentions: { repliedUser: false } });
    return;
  }

  const request = message.content
    .replace(new RegExp(`<@!?\${client.user.id}>`, "g"), "")
    .trim();
  if (request.includes("<" + "#") && /(?:mover|mude|mudar|transferir|colocar|categoria)/i.test(request)) {
    const moveResult = await moveMentionedChannel(message, request);
    if (moveResult) await message.channel.send({ content: moveResult, allowedMentions: { parse: [] } });
    return;
  }

  if (!request) {
    await message.channel.send({ content: "Oi! Como posso ajudar?", allowedMentions: { repliedUser: false } });
    return;
  }

  // Construtor de servidores com IA temporariamente desativado.
  // A movimentação de canais por menção continua funcionando acima.
  await message.channel.send({
    content: "❄️ O construtor de servidores da Yukina está temporariamente desativado. Os demais sistemas continuam funcionando normalmente.",
    allowedMentions: { repliedUser: false }
  });
  return;

  try {
    await message.channel.sendTyping();
    const plan = await createPlan(request);
    const hasDeletes = plan.delete_roles.length || plan.delete_categories.length || plan.delete_channels.length;
    const hasCreates = plan.roles.length || plan.categories.length || plan.channels.length;
    let deleted = [];

    if (hasCreates && plan.roles.length) {
      const colorOptions = makeRoleColorOptions();
      for (let index = 0; index < plan.roles.length; index++) {
        const roleItem = plan.roles[index];
        const nameOptions = makeRoleNameOptions(roleItem.name);
        const roleNamePreview = [
          `**❄️ Yukina · estilos para o cargo ${index + 1}/${plan.roles.length}**`,
          `Nome sugerido: **${String(roleItem.name || "membro")}**`,
          "Escolha um nome de **1 a 10**:",
          ...nameOptions.map((option, optionIndex) => `${optionIndex + 1}. ${option.label}`),
          "",
          "Responda **CANCELAR** para desistir. Você tem 60 segundos.",
        ].join("\\n");
        await message.channel.send({ content: roleNamePreview.slice(0, 1700), allowedMentions: { parse: [] } });
        const roleNameChoice = await waitForExactReply(message.channel, message.author.id, message.guild.id, [...Array(10)].map((_, i) => String(i + 1)).concat("CANCELAR"));
        if (!roleNameChoice || roleNameChoice.content.trim().toUpperCase() === "CANCELAR") {
          await message.channel.send("⏱️ Criação cancelada. Nenhum cargo, canal ou categoria foi criado.");
          return;
        }
        roleItem.name = nameOptions[Number(roleNameChoice.content.trim()) - 1].name;

        const colorPreview = [
          `**🌙 Yukina · escolha a cor do cargo ${index + 1}/${plan.roles.length}**`,
          "Escolha uma cor de **1 a 10**, envie um código HEX (ex.: **#FF69B4**) ou responda **11** para uma cor aleatória.",
          ...colorOptions.map((option, optionIndex) => `${optionIndex + 1}. ${option.swatch} **${option.name}** — \`${option.hex}\``),
          "11. 🎲 **Cor aleatória da paleta Yukina**",
          "",
          "Você também pode enviar qualquer cor no formato #RRGGBB. Responda **CANCELAR** para desistir.",
        ].join("\\n");
        await message.channel.send({ content: colorPreview.slice(0, 1800), allowedMentions: { parse: [] } });
        const colorChoice = await waitForExactReply(message.channel, message.author.id, message.guild.id,
          [...Array(11)].map((_, i) => String(i + 1)).concat("CANCELAR"));
        if (!colorChoice || colorChoice.content.trim().toUpperCase() === "CANCELAR") {
          await message.channel.send("⏱️ Criação cancelada. Nenhum cargo, canal ou categoria foi criado.");
          return;
        }
        const colorAnswer = colorChoice.content.trim();
        if (/^#[0-9a-f]{6}$/i.test(colorAnswer)) {
          roleItem.color = colorAnswer.toUpperCase();
        } else if (colorAnswer === "11") {
          const randomColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];
          roleItem.color = randomColor.hex;
          await message.channel.send(`🎲 A Yukina escolheu **${randomColor.name}** (${randomColor.hex}) para este cargo.`);
        } else {
          roleItem.color = colorOptions[Number(colorAnswer) - 1].hex;
        }
      }
    }

    if (hasCreates && plan.categories.length) {
      for (let index = 0; index < plan.categories.length; index++) {
        const categoryItem = plan.categories[index];
        const options = makeCategoryNameOptions(categoryItem.name);
        const categoryPreview = [
          `**❄️ Yukina · sugestões para a categoria ${index + 1}/${plan.categories.length}**`,
          `Nome original sugerido: **${String(categoryItem.name || "categoria")}**`,
          "Escolha o estilo respondendo com um número de **1 a 10**:",
          ...options.map((option, optionIndex) => `${optionIndex + 1}. ${option.label}`),
          "",
          "Responda **CANCELAR** para desistir. Você tem 60 segundos.",
        ].join("\n");
        await message.channel.send({ content: categoryPreview.slice(0, 1700), allowedMentions: { parse: [] } });
        const categoryChoice = await waitForExactReply(message.channel, message.author.id, message.guild.id, [...Array(10)].map((_, optionIndex) => String(optionIndex + 1)).concat("CANCELAR"));
        if (!categoryChoice || categoryChoice.content.trim().toUpperCase() === "CANCELAR") {
          await message.channel.send("⏱️ Criação cancelada. Nenhuma categoria, canal ou cargo foi criado.");
          return;
        }
        const originalCategoryName = String(categoryItem.name || "").toLowerCase();
        categoryItem.name = options[Number(categoryChoice.content.trim()) - 1].name;
        for (const channelItem of plan.channels) {
          if (String(channelItem?.category || "").toLowerCase() === originalCategoryName) {
            channelItem.category = categoryItem.name;
          }
        }
      }
    }

    if (hasCreates && plan.channels.length) {
      const options = makeChannelNameOptions(plan.channels[0].name);
      const choiceText = [
        "**❄️ Yukina · escolha o nome do canal**",
        "Escolha uma opção respondendo com um número de **1 a 10**. Ainda não vou criar nada.",
        ...options.map((option, index) => `${index + 1}. ${option.label}`),
        "",
        "Você tem 60 segundos. Responda **CANCELAR** para desistir.",
      ].join("\n");
      await message.channel.send({ content: choiceText, allowedMentions: { repliedUser: false } });
      const choice = await waitForExactReply(message.channel, message.author.id, message.guild.id, [...Array(10)].map((_, optionIndex) => String(optionIndex + 1)).concat("CANCELAR"));
      if (!choice || choice.content.trim().toUpperCase() === "CANCELAR") {
        await message.channel.send("⏱️ Criação cancelada. Nenhum canal, cargo ou categoria foi criado.");
        return;
      }
      plan.channels[0].name = options[Number(choice.content.trim()) - 1].name;

      const categories = message.guild.channels.cache
        .filter((item) => item.type === ChannelType.GuildCategory)
        .map((item) => item.name);
      const planned = plan.categories.map((item) => String(item?.name || "").trim()).filter(Boolean);
      const names = [...new Set([...planned, ...categories])].slice(0, 20);
      const prompt = ["**Em qual categoria ficará o canal?**", "Responda com o número ou **0** para deixar sem categoria.",
        ...names.map((name, index) => `${index + 1}. ${name}`), "", "Responda **CANCELAR** para desistir."].join("\n");
      await message.channel.send({ content: prompt.slice(0, 1800), allowedMentions: { parse: [] } });
      const answer = await waitForExactReply(message.channel, message.author.id, message.guild.id,
        ["0", "CANCELAR", ...names.map((_, index) => String(index + 1))]);
      if (!answer || answer.content.trim().toUpperCase() === "CANCELAR") {
        await message.channel.send("Criação cancelada. Nenhum item foi criado.");
        return;
      }
      const number = Number(answer.content.trim());
      if (number === 0) {
        plan.channels[0].category = null;
      } else {
        const selected = names[number - 1];
        plan.channels[0].category = selected;
        if (!categories.some((name) => name.toLowerCase() === selected.toLowerCase()) &&
            !plan.categories.some((item) => String(item?.name || "").toLowerCase() === selected.toLowerCase())) {
          plan.categories.push({ name: selected });
        }
      }
    }

    if (hasDeletes) {
      const preview = [
        "**⚠️ Prévia das exclusões solicitadas**",
        ...(plan.delete_channels.length ? [`Canais: ${plan.delete_channels.join(", ")}`] : []),
        ...(plan.delete_categories.length ? [`Categorias (os canais serão mantidos): ${plan.delete_categories.join(", ")}`] : []),
        ...(plan.delete_roles.length ? [`Cargos: ${plan.delete_roles.join(", ")}`] : []),
        "",
        "Responda **CONFIRMAR** para executar as exclusões, ou **CANCELAR**. Expira em 60 segundos.",
      ].join("\n");
      await message.channel.send({ content: preview.slice(0, 1800), allowedMentions: { repliedUser: false } });
      const deletionConfirmation = await waitForExactReply(message.channel, message.author.id, message.guild.id, ["CONFIRMAR", "CANCELAR"]);
      if (!deletionConfirmation || deletionConfirmation.content.trim().toUpperCase() !== "CONFIRMAR") {
        await message.channel.send("⏱️ Exclusões canceladas. Nenhuma exclusão foi executada.");
        if (!hasCreates) return;
      } else {
        deleted = await applyDeletions(message.guild, plan);
      }
    }

    if (hasCreates) {
      const preview = [
        "**🌙 Yukina · prévia final da criação**",
        ...(plan.categories.length ? [`Categorias: ${plan.categories.map((x) => x.name).join(", ")}`] : []),
        ...(plan.roles.length ? [`Cargos: ${plan.roles.map((x) => x.name).join(", ")}`] : []),
        ...(plan.channels.length ? [`Canais: ${plan.channels.map((x) => `${x.name} (${x.type || "text"})`).join(", ")}`] : []),
        "",
        "Nada foi criado ainda. Responda **CONFIRMAR** para criar esta estrutura ou **CANCELAR** para desistir. Expira em 60 segundos.",
      ].join("\n");
      await message.channel.send({ content: preview.slice(0, 1800), allowedMentions: { repliedUser: false } });
      const confirmation = await waitForExactReply(message.channel, message.author.id, message.guild.id, ["CONFIRMAR", "CANCELAR"]);
      if (!confirmation || confirmation.content.trim().toUpperCase() !== "CONFIRMAR") {
        await message.channel.send("⏱️ Criação cancelada. Nenhum item da prévia foi criado.");
        return;
      }
    }

    const created = hasCreates ? await buildServer(message.guild, plan) : [];
    const summary = [...deleted, ...created];
    if (!summary.length) {
      await message.channel.send("A Yukina não fez alterações: nenhum item novo foi necessário ou nenhum alvo válido foi encontrado. Confira os nomes exatos.");
    } else {
      await message.channel.send({ content: `**Yukina concluiu!**\n${summary.slice(0, 35).map((line) => `• ${line}`).join("\n")}`.slice(0, 1900) });
    }
  } catch (error) {
    console.error("Erro no construtor de servidor IA:", error);
    await message.channel.send({ content: `Não consegui concluir a montagem: ${String(error.message || error).slice(0, 700)}`, allowedMentions: { repliedUser: false } });
  }
});

// API do painel: OAuth do Discord + permissões do servidor + persistência no MongoDB.
const PANEL_ORIGINS = (process.env.PANEL_ORIGINS || "https://yukina-6uo.pages.dev").split(",").map(v => v.trim()).filter(Boolean);
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let settingsMongoClient = null;
let settingsCollection = null;

async function getSettingsCollection() {
  if (settingsCollection) return settingsCollection;
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada no Render.");
  settingsMongoClient = settingsMongoClient || new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await settingsMongoClient.connect();
  settingsCollection = settingsMongoClient.db(MONGODB_DB).collection("guild_settings");
  await settingsCollection.createIndex({ guildId: 1 }, { unique: true });
  return settingsCollection;
}
function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 100000) reject(new Error("Corpo da requisição muito grande.")); });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("JSON inválido.")); } });
    req.on("error", reject);
  });
}
const oauthGuildCache = new Map();
const OAUTH_GUILD_CACHE_TTL_MS = 60 * 1000;
const OAUTH_GUILD_CACHE_STALE_MS = 5 * 60 * 1000;

async function authorizePanel(req, guildId) {
  const auth = String(req.headers.authorization || "");
  const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!accessToken) throw Object.assign(new Error("Entre com o Discord novamente."), { status: 401 });

  const now = Date.now();
  let cachedGuilds = oauthGuildCache.get(accessToken);
  if (cachedGuilds && cachedGuilds.staleUntil <= now) {
    oauthGuildCache.delete(accessToken);
    cachedGuilds = null;
  }

  // O endpoint de servidores tem limite próprio. Reutilizamos a resposta válida
  // por 60 s para evitar uma chamada ao Discord em cada requisição do painel.
  const userPromise = fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: "Bearer " + accessToken }
  });
  let guildsPromise = null;
  if (!cachedGuilds || cachedGuilds.freshUntil <= now) {
    guildsPromise = fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: "Bearer " + accessToken }
    });
  }

  const userRes = await userPromise;
  if (!userRes.ok) {
    console.warn("[API painel] Discord recusou a validação do usuário OAuth:", JSON.stringify({ userStatus: userRes.status }));
    const status = userRes.status === 401 ? 401 : userRes.status === 403 ? 403 : 502;
    const message = status === 401
      ? "Sua sessão do Discord expirou. Entre novamente."
      : status === 403
        ? "O Discord recusou as permissões OAuth da sessão. Entre novamente."
        : "O Discord está temporariamente indisponível para validar a sessão. Tente novamente.";
    throw Object.assign(new Error(message), { status });
  }
  const user = await userRes.json();

  let guilds;
  if (!guildsPromise) {
    guilds = cachedGuilds.guilds;
  } else {
    const guildsRes = await guildsPromise;
    if (guildsRes.ok) {
      guilds = await guildsRes.json();
      const entry = {
        guilds: Array.isArray(guilds) ? guilds : [],
        freshUntil: Date.now() + OAUTH_GUILD_CACHE_TTL_MS,
        staleUntil: Date.now() + OAUTH_GUILD_CACHE_STALE_MS
      };
      oauthGuildCache.set(accessToken, entry);
      // Evita crescimento ilimitado do cache em processos de longa duração.
      if (oauthGuildCache.size > 500) {
        const oldestKey = oauthGuildCache.keys().next().value;
        if (oldestKey !== undefined) oauthGuildCache.delete(oldestKey);
      }
    } else {
      console.warn("[API painel] Discord recusou a validação OAuth:", JSON.stringify({
        userStatus: userRes.status,
        guildsStatus: guildsRes.status
      }));
      // Se o Discord limitar temporariamente a rota, usa apenas uma resposta
      // previamente autenticada e ainda recente; nunca ignora 401/403.
      if (guildsRes.status === 429 && cachedGuilds && cachedGuilds.staleUntil > Date.now()) {
        guilds = cachedGuilds.guilds;
        console.warn("[API painel] Usando cache recente de servidores devido ao limite 429 do Discord.");
      } else {
        const status = guildsRes.status === 401 ? 401 : guildsRes.status === 403 ? 403 : 502;
        const message = status === 401
          ? "Sua sessão do Discord expirou. Entre novamente."
          : status === 403
            ? "O Discord recusou as permissões OAuth da sessão. Entre novamente e autorize identify e guilds."
            : "O Discord está temporariamente indisponível para validar a sessão. Tente novamente.";
        throw Object.assign(new Error(message), { status });
      }
    }
  }

  const guild = Array.isArray(guilds) ? guilds.find(g => g.id === guildId) : null;
  if (!guild) throw Object.assign(new Error("Você não tem acesso a este servidor."), { status: 403 });
  const permissions = BigInt(guild.permissions || "0");
  if ((permissions & 8n) === 0n && (permissions & 32n) === 0n && guild.owner !== true) {
    throw Object.assign(new Error("É necessário ter Administrador ou Gerenciar servidor."), { status: 403 });
  }
  const botGuild = client.guilds.cache.get(guildId);
  if (!botGuild) throw Object.assign(new Error("A Yukina ainda não está neste servidor. Adicione o bot e tente novamente."), { status: 409 });
  return { user, guild: botGuild };
}
async function panelApi(req, res, url) {
  const origin = String(req.headers.origin || "");
  if (origin && PANEL_ORIGINS.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (url.pathname === "/api/health" || url.pathname === "/") return sendJson(res, 200, { ok: true, service: "Yukina Bot", api: true });
  if (url.pathname === "/api/daily/status" || url.pathname === "/api/daily/claim") {
    const isClaim = url.pathname === "/api/daily/claim";
    if (req.method !== (isClaim ? "POST" : "GET")) return sendJson(res, 405, { ok: false, detail: isClaim ? "Use POST." : "Use GET." });
    try {
      const auth = String(req.headers.authorization || "");
      const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!accessToken) return sendJson(res, 401, { ok: false, detail: "Entre com o Discord para coletar o Daily." });
      const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(10000) });
      const user = userResponse.ok ? await userResponse.json() : null;
      if (!user || !/^\\d{17,20}$/.test(String(user.id || ""))) return sendJson(res, 401, { ok: false, detail: "Sua sessão do Discord expirou. Entre novamente." });
      const guildId = (process.env.VIP_GUILD_ID || "").trim();
      if (!/^\\d{17,20}$/.test(guildId)) return sendJson(res, 503, { ok: false, detail: "O servidor Daily ainda não está configurado." });
      if (!MONGODB_URI) return sendJson(res, 503, { ok: false, detail: "O banco de dados do Daily não está configurado." });
      if (!settingsMongoClient) settingsMongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      await settingsMongoClient.connect();
      const daily = settingsMongoClient.db(MONGODB_DB).collection("daily_claims");
      await daily.createIndex({ guildId: 1, userId: 1, day: 1 }, { unique: true });
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      const previous = await daily.findOne({ guildId, userId: String(user.id), day });
      if (!isClaim) return sendJson(res, 200, { ok: true, claimed: Boolean(previous), nextReset: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString() });
      if (previous) return sendJson(res, 409, { ok: false, claimed: true, detail: "Você já coletou seu Daily hoje! Volte amanhã para coletar novamente." });
      const body = await readBody(req);
      const captchaToken = String(body.token || "").trim();
      if (!captchaToken) return sendJson(res, 400, { ok: false, detail: "Conclua a verificação de segurança primeiro." });
      const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
      if (!secret) return sendJson(res, 503, { ok: false, detail: "A verificação de segurança não está configurada no servidor." });
      const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret, response: captchaToken }), signal: AbortSignal.timeout(10000) });
      const verification = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || verification.success !== true) return sendJson(res, 403, { ok: false, detail: "A verificação falhou. Tente novamente." });
      const subscriptions = await getVipCollection();
      const subscription = await subscriptions.findOne({ guildId, userId: String(user.id), status: "active", expiresAt: { $gt: now } });
      const multipliers = { starter: 1.25, plus: 1.5, premium: 2, ultra: 2.5, infinity: 3 };
      const planKey = String(subscription?.planKey || "").toLowerCase();
      const multiplier = subscription && multipliers[planKey] ? multipliers[planKey] : 1;
      const planName = subscription && multipliers[planKey] ? planKey[0].toUpperCase() + planKey.slice(1) : "Sem VIP";
      const ranges = [{ min: 5000, max: 10000 }, { min: 10000, max: 15000 }, { min: 10000, max: 20000 }, { min: 20000, max: 25000 }];
      const baseReward = Math.floor(Math.random() * (ranges[0].max - ranges[0].min + 1)) + ranges[0].min;
      const reward = Math.floor(baseReward * multiplier);
      try {
        await daily.insertOne({ guildId, userId: String(user.id), day, plan: planKey || null, multiplier, baseReward, reward, claimedAt: now });
      } catch (err) {
        if (err && err.code === 11000) return sendJson(res, 409, { ok: false, claimed: true, detail: "Você já coletou seu Daily hoje! Volte amanhã para coletar novamente." });
        throw err;
      }
      return sendJson(res, 200, { ok: true, claimed: true, day, plan: planName, multiplier, baseReward, reward, nextReset: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString() });
    } catch (error) {
      console.error("[Daily] Falha na coleta:", error.message || error);
      return sendJson(res, 500, { ok: false, detail: "Não foi possível verificar a coleta do Daily. Tente novamente." });
    }
  }
  if (url.pathname === "/api/vip/daily") {
    if (req.method !== "GET") return sendJson(res, 405, { ok: false, detail: "Use GET para consultar o multiplicador VIP." });
    try {
      const auth = String(req.headers.authorization || "");
      const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!accessToken) return sendJson(res, 401, { ok: false, detail: "Entre com o Discord para consultar seu plano VIP." });
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(10000)
      });
      const user = userResponse.ok ? await userResponse.json() : null;
      if (!user || !/^\\d{17,20}$/.test(String(user.id || ""))) {
        return sendJson(res, 401, { ok: false, detail: "Sua sessão do Discord expirou. Entre novamente." });
      }
      const guildId = (process.env.VIP_GUILD_ID || "").trim();
      if (!/^\\d{17,20}$/.test(guildId)) {
        return sendJson(res, 503, { ok: false, detail: "O servidor VIP ainda não está configurado na API." });
      }
      const subscriptions = await getVipCollection();
      const subscription = await subscriptions.findOne({
        guildId, userId: String(user.id), status: "active", expiresAt: { $gt: new Date() }
      });
      const planMultipliers = {
        starter: { name: "Starter", multiplier: 1.25 },
        plus: { name: "Plus", multiplier: 1.5 },
        premium: { name: "Premium", multiplier: 2 },
        ultra: { name: "Ultra", multiplier: 2.5 },
        infinity: { name: "Infinity", multiplier: 3 }
      };
      const plan = subscription ? planMultipliers[String(subscription.planKey || "").toLowerCase()] : null;
      return sendJson(res, 200, {
        ok: true,
        hasVip: Boolean(plan),
        plan: plan ? plan.name : "Sem VIP",
        multiplier: plan ? plan.multiplier : 1,
        expiresAt: plan ? subscription.expiresAt : null
      });
    } catch (error) {
      console.error("[Daily VIP] Falha ao consultar assinatura:", error.message || error);
      return sendJson(res, 500, { ok: false, detail: "Não foi possível consultar seu plano VIP agora." });
    }
  }
  if (url.pathname === "/api/turnstile/verify") {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, detail: "Use POST para validar o Turnstile." });
    const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
    if (!secret) return sendJson(res, 503, { ok: false, detail: "Configure TURNSTILE_SECRET_KEY nas variáveis de ambiente do Render." });
    try {
      const body = await readBody(req);
      const token = String(body.token || "").trim();
      if (!token) return sendJson(res, 400, { ok: false, detail: "Token Turnstile ausente." });
      const params = new URLSearchParams({ secret, response: token });
      const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
      if (forwardedFor) params.set("remoteip", forwardedFor);
      const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
        signal: AbortSignal.timeout(10000)
      });
      const verification = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) return sendJson(res, 502, { ok: false, detail: "Não foi possível consultar o Cloudflare Turnstile." });
      if (verification.success !== true) {
        return sendJson(res, 403, { ok: false, detail: "O Cloudflare não confirmou a verificação. Tente novamente.", errors: verification["error-codes"] || [] });
      }
      return sendJson(res, 200, { ok: true, verified: true });
    } catch (error) {
      console.error("[Turnstile] Falha na validação:", error.message || error);
      return sendJson(res, 502, { ok: false, detail: "Erro ao validar a verificação de segurança." });
    }
  }
  if (url.pathname === "/api/oauth/token") {
    if (req.method !== "POST") return sendJson(res, 405, { detail: "Use POST para concluir o login." });
    try {
      const body = await readBody(req);
      const code = String(body.code || "").trim();
      const codeVerifier = String(body.code_verifier || "").trim();
      const redirectUri = String(body.redirect_uri || "").trim();
      const clientId = (process.env.DISCORD_CLIENT_ID || "1561485997277970514").trim();
      const clientSecret = (process.env.DISCORD_CLIENT_SECRET || "").trim();
      const expectedRedirect = "https://yukina-6uo.pages.dev/login.html";
      if (!clientSecret) return sendJson(res, 503, { detail: "Falta configurar DISCORD_CLIENT_SECRET nas variáveis do Render." });
      if (!code || !codeVerifier) return sendJson(res, 400, { detail: "O Discord não enviou o código/verificador de login. Tente entrar novamente." });
      if (redirectUri !== expectedRedirect) return sendJson(res, 400, { detail: "URL de retorno inválida. Confira OAuth2 → Redirects no Discord Developer Portal." });
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: expectedRedirect,
          code_verifier: codeVerifier
        }),
        signal: AbortSignal.timeout(15000)
      });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error("[OAuth painel] Discord recusou a troca do código:", tokenResponse.status, tokenData.error || "unknown_error", tokenData.error_description || "");
        return sendJson(res, tokenResponse.status === 400 ? 400 : 502, {
          detail: tokenData.error === "invalid_grant"
            ? "O código de login expirou ou não corresponde a esta sessão. Volte ao login e tente novamente."
            : tokenData.error === "invalid_client"
              ? "O Discord recusou as credenciais OAuth. Confira DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET no Render."
              : "O Discord recusou a autenticação (" + String(tokenData.error || tokenResponse.status) + "). Confira Client ID, Client Secret e Redirect URI."
        });
      }
      return sendJson(res, 200, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope
      });
    } catch (error) {
      console.error("[OAuth painel] Falha na troca do código:", error.message || error);
      return sendJson(res, 502, { detail: "A API do Render não conseguiu concluir o login com o Discord. Tente novamente." });
    }
  }

  if (url.pathname === "/api/oauth/refresh") {
    if (req.method !== "POST") return sendJson(res, 405, { detail: "Use POST para renovar a sessão." });
    try {
      const body = await readBody(req);
      const refreshToken = String(body.refresh_token || "").trim();
      const clientId = (process.env.DISCORD_CLIENT_ID || "1561485997277970514").trim();
      const clientSecret = (process.env.DISCORD_CLIENT_SECRET || "").trim();
      if (!clientSecret) return sendJson(res, 503, { detail: "A renovação OAuth não está configurada no Render." });
      if (!refreshToken) return sendJson(res, 400, { detail: "Não há token de renovação. Entre novamente com o Discord." });
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
        signal: AbortSignal.timeout(15000)
      });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenData.access_token) {
        console.warn("[OAuth painel] Renovação recusada pelo Discord:", tokenResponse.status, tokenData.error || "unknown_error");
        return sendJson(res, 401, { detail: "Sua sessão expirou. Entre novamente com o Discord." });
      }
      return sendJson(res, 200, { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token || refreshToken, token_type: tokenData.token_type, expires_in: tokenData.expires_in, scope: tokenData.scope });
    } catch (error) {
      console.error("[OAuth painel] Falha ao renovar sessão:", error.message || error);
      return sendJson(res, 502, { detail: "Não foi possível renovar a sessão do Discord. Tente entrar novamente." });
    }
  }


  if (url.pathname === "/api/vip/ticket" && req.method === "POST") {
    try {
      const auth = String(req.headers.authorization || "");
      const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!accessToken) return sendJson(res, 401, { detail: "Entre com o Discord antes de confirmar a compra." });
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(10000)
      });
      const user = userResponse.ok ? await userResponse.json() : null;
      if (!user || !/^\d{17,20}$/.test(String(user.id || ""))) {
        return sendJson(res, 401, { detail: "Sua sessão do Discord expirou. Entre novamente para continuar." });
      }
      const body = await readBody(req);
      const planKey = String(body.plan || "").trim().toLowerCase();
      const period = String(body.period || "").trim().toLowerCase();
      const plans = {
        starter: { name: "Starter", monthly: 790, annual: 7990 },
        plus: { name: "Plus", monthly: 990, annual: 9990 },
        premium: { name: "Premium", monthly: 1490, annual: 14990 },
        ultra: { name: "Ultra", monthly: 1990, annual: 19990 },
        infinity: { name: "Infinity", monthly: 2990, annual: 29990 }
      };
      if (!plans[planKey] || !["monthly", "annual"].includes(period)) {
        return sendJson(res, 400, { detail: "Plano ou período inválido. Volte à página VIP e selecione novamente." });
      }
      const guildId = (process.env.VIP_GUILD_ID || "").trim();
      const adminId = (process.env.VIP_ADMIN_ID || "").trim();
      const pixKey = (process.env.VIP_PIX_KEY || "").trim();
      if (!guildId || !/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(adminId) || !pixKey) {
        return sendJson(res, 503, { detail: "A equipe ainda não configurou o atendimento VIP. Tente novamente mais tarde." });
      }
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return sendJson(res, 503, { detail: "A Yukina não está conectada ao servidor oficial. Avise a equipe." });
      const buyer = await guild.members.fetch(user.id).catch(() => null);
      if (!buyer) return sendJson(res, 409, {
        code: "JOIN_SERVER_FIRST",
        detail: "Entre no servidor oficial do Discord e depois volte ao painel para confirmar a compra.",
        inviteUrl: "https://discord.gg/NJR3YNd2G"
      });
      const admin = await guild.members.fetch(adminId).catch(() => null);
      if (!admin) return sendJson(res, 503, { detail: "O administrador VIP não foi encontrado no servidor." });
      const topic = "yukina-vip:" + user.id + ":" + planKey + ":" + period;
      const channels = await guild.channels.fetch();
      const existing = channels.find(channel => channel.type === ChannelType.GuildText && channel.topic === topic);
      if (existing) return sendJson(res, 200, {
        ok: true, existing: true,
        channelUrl: "https://discord.com/channels/" + guild.id + "/" + existing.id,
        message: "Você já tem um atendimento aberto para este plano."
      });
      const safeName = String(user.global_name || user.username || "membro").toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
        .replace(/^-|-$/g, "").slice(0, 35) || "membro";
      const channel = await guild.channels.create({
        name: ("compra-vip-" + safeName).slice(0, 90),
        type: ChannelType.GuildText,
        topic: topic,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
          { id: admin.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] }
        ],
        reason: "Compra VIP iniciada pelo painel por " + user.id
      });
      const cents = plans[planKey][period];
      const money = value => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const embed = new EmbedBuilder()
        .setColor(0xA855F7)
        .setTitle("❄️ Compra de plano VIP — Yukina")
        .setDescription([
          "Olá <@" + user.id + ">, este é seu atendimento privado.",
          "",
          "**Plano:** " + plans[planKey].name,
          "**Período:** " + (period === "annual" ? "Anual" : "Mensal"),
          "**Valor:** " + money(cents),
          "",
          "**Pix (chave):**",
          "```" + pixKey + "```",
          "",
          "Depois de pagar, envie aqui o comprovante ou o identificador da transação. A equipe vai conferir o pagamento manualmente. Enviar comprovante não significa aprovação automática.",
          "Somente o administrador autorizado pode aprovar ou cancelar esta compra."
        ].join("\n"))
        .setFooter({ text: "Pedido de " + user.username + " · ID " + user.id })
        .setTimestamp();
      const mentions = [...new Set([user.id, admin.id])];
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("vip:approve:" + user.id + ":" + planKey + ":" + period).setLabel("Compra feita com sucesso").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("vip:cancel:" + user.id + ":" + planKey + ":" + period).setLabel("Compra cancelada").setStyle(ButtonStyle.Danger)
      );
      await channel.send({
        content: mentions.map(id => "<@" + id + ">").join(" "),
        embeds: [embed], components: [row], allowedMentions: { users: mentions }
      });
      return sendJson(res, 201, {
        ok: true,
        channelUrl: "https://discord.com/channels/" + guild.id + "/" + channel.id,
        message: "Atendimento privado criado. Abrindo o Discord."
      });
    } catch (error) {
      console.error("[VIP painel] Não foi possível criar atendimento:", error.message || error);
      return sendJson(res, 500, { detail: "Não consegui criar seu atendimento VIP. Tente novamente em instantes." });
    }
  }

  const match = url.pathname.match(/^\/api\/guilds\/([0-9]{17,20})(?:\/(resources|settings))?$/);
  if (!match) return sendJson(res, 404, { detail: "Rota não encontrada." });
  const guildId = match[1], section = match[2] || "resources";
  try {
    const { guild } = await authorizePanel(req, guildId);
    if (section === "resources" && req.method === "GET") {
      // Buscar cargos e canais separadamente: uma falha ao listar canais não deve
      // impedir o painel de receber os cargos do servidor.
      let rolesFetchError = null;
      let channelsFetchError = null;
      try {
        await guild.roles.fetch();
      } catch (error) {
        rolesFetchError = error;
        console.error("[API painel] Falha ao buscar cargos do Discord:", { guildId, code: error.code, message: error.message });
      }
      try {
        await guild.channels.fetch();
      } catch (error) {
        channelsFetchError = error;
        console.error("[API painel] Falha ao buscar canais do Discord:", { guildId, code: error.code, message: error.message });
      }
      const roles = [...guild.roles.cache.values()]
        .filter(role => role.id !== guild.id && !role.managed)
        .sort((a, b) => b.position - a.position)
        .map(role => ({ id: role.id, name: role.name, color: role.hexColor, position: role.position }));
      const channels = [...guild.channels.cache.values()]
        .filter(channel => channel.type !== ChannelType.GuildCategory)
        .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
        .map(channel => ({ id: channel.id, name: channel.name, type: channel.type, parentId: channel.parentId, parentName: channel.parent?.name || null }));
      const categories = [...guild.channels.cache.values()]
        .filter(channel => channel.type === ChannelType.GuildCategory)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(channel => ({ id: channel.id, name: channel.name }));
      return sendJson(res, 200, {
        guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 128 }) },
        roles,
        channels,
        categories,
        diagnostics: {
          rolesFetchFailed: Boolean(rolesFetchError),
          channelsFetchFailed: Boolean(channelsFetchError),
          roleCount: roles.length,
          channelCount: channels.length
        }
      });
    }
    if (section !== "settings") return sendJson(res, 404, { detail: "Rota não encontrada." });
    const collection = await getSettingsCollection();
    if (req.method === "GET") {
      const doc = await collection.findOne({ guildId });
      const settings = { ...(doc?.settings || {}) };
      let temporalConfig = await temporalStorage.get(guildId, "config", null);
      // Migra a hierarquia temporal existente sem perder as regras salvas anteriormente no painel.
      if (!temporalConfig && (Array.isArray(settings.timeRules) || Array.isArray(settings.timeManagedRoleIds))) {
        temporalConfig = {
          timeRules: Array.isArray(settings.timeRules) ? settings.timeRules : [],
          timeManagedRoleIds: Array.isArray(settings.timeManagedRoleIds) ? settings.timeManagedRoleIds : [],
        };
        await temporalStorage.set(guildId, "config", temporalConfig);
        console.log("[Armazenamento] Hierarquia temporal migrada para system-storage no servidor " + guildId + ".");
      }
      if (temporalConfig && typeof temporalConfig === "object") {
        if (Array.isArray(temporalConfig.timeRules)) settings.timeRules = temporalConfig.timeRules;
        if (Array.isArray(temporalConfig.timeManagedRoleIds)) settings.timeManagedRoleIds = temporalConfig.timeManagedRoleIds;
      }
      let xpConfig = await xpStorage.get(guildId, "config", null);
      // Migra as regras de XP antigas uma única vez para o armazenamento compartilhado.
      if (!xpConfig && (Array.isArray(settings.xpRules) || Array.isArray(settings.xpManagedRoleIds))) {
        xpConfig = {
          xpRules: Array.isArray(settings.xpRules) ? settings.xpRules : [],
          xpManagedRoleIds: Array.isArray(settings.xpManagedRoleIds) ? settings.xpManagedRoleIds : [],
        };
        await xpStorage.set(guildId, "config", xpConfig);
        console.log("[Armazenamento] Cargos por XP migrados para system-storage no servidor " + guildId + ".");
      }
      if (xpConfig && typeof xpConfig === "object") {
        if (Array.isArray(xpConfig.xpRules)) settings.xpRules = xpConfig.xpRules;
        if (Array.isArray(xpConfig.xpManagedRoleIds)) settings.xpManagedRoleIds = xpConfig.xpManagedRoleIds;
      }
      let multiplierConfig = await xpMultiplierStorage.get(guildId, "config", null);
      if (!multiplierConfig && Array.isArray(settings.multiplierRules)) {
        multiplierConfig = { multiplierRules: settings.multiplierRules };
        await xpMultiplierStorage.set(guildId, "config", multiplierConfig);
        console.log("[Armazenamento] Multiplicadores de XP migrados para system-storage no servidor " + guildId + ".");
      }
      if (multiplierConfig && typeof multiplierConfig === "object" && Array.isArray(multiplierConfig.multiplierRules)) {
        settings.multiplierRules = multiplierConfig.multiplierRules;
      }
      return sendJson(res, 200, { settings, updatedAt: doc?.updatedAt || null });
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const settings = body && body.settings && typeof body.settings === "object" && !Array.isArray(body.settings) ? body.settings : body;
      const clean = {};
      for (const [key, value] of Object.entries(settings)) {
        if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key)) continue;
        if (typeof value === "string") clean[key] = value.slice(0, 2000);
        else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
        else if (typeof value === "boolean" || value === null) clean[key] = value;
        else if (Array.isArray(value)) clean[key] = value.slice(0, 100);
        else if (value && typeof value === "object") clean[key] = value;
      }
      const updatedAt = new Date();
      const patch = { guildId, guildName: guild.name, updatedAt };
      for (const [key, value] of Object.entries(clean)) patch["settings." + key] = value;
      await collection.updateOne({ guildId }, { $set: patch }, { upsert: true });
      // Mantém o endpoint antigo do painel compatível e grava a hierarquia temporal no armazenamento universal.
      if (Object.prototype.hasOwnProperty.call(clean, "timeRules") ||
          Object.prototype.hasOwnProperty.call(clean, "timeManagedRoleIds")) {
        const existingTemporal = await temporalStorage.get(guildId, "config", {});
        await temporalStorage.set(guildId, "config", {
          ...(existingTemporal && typeof existingTemporal === "object" ? existingTemporal : {}),
          ...(Array.isArray(clean.timeRules) ? { timeRules: clean.timeRules } : {}),
          ...(Array.isArray(clean.timeManagedRoleIds) ? { timeManagedRoleIds: clean.timeManagedRoleIds } : {}),
        });
      }
      if (Object.prototype.hasOwnProperty.call(clean, "xpRules") ||
          Object.prototype.hasOwnProperty.call(clean, "xpManagedRoleIds")) {
        const existingXp = await xpStorage.get(guildId, "config", {});
        await xpStorage.set(guildId, "config", {
          ...(existingXp && typeof existingXp === "object" ? existingXp : {}),
          ...(Array.isArray(clean.xpRules) ? { xpRules: clean.xpRules } : {}),
          ...(Array.isArray(clean.xpManagedRoleIds) ? { xpManagedRoleIds: clean.xpManagedRoleIds } : {}),
        });
      }
      if (Object.prototype.hasOwnProperty.call(clean, "multiplierRules")) {
        const existingMultipliers = await xpMultiplierStorage.get(guildId, "config", {});
        await xpMultiplierStorage.set(guildId, "config", {
          ...(existingMultipliers && typeof existingMultipliers === "object" ? existingMultipliers : {}),
          multiplierRules: Array.isArray(clean.multiplierRules) ? clean.multiplierRules : [],
        });
      }
      return sendJson(res, 200, { ok: true, guildId, settings: clean, updatedAt });
    }
    if (req.method === "DELETE") {
      await collection.deleteOne({ guildId });
      return sendJson(res, 200, { ok: true, reset: true });
    }
    return sendJson(res, 405, { detail: "Método não permitido." });
  } catch (error) {
    console.error("[API painel]", error.message || error);
    return sendJson(res, error.status || (String(error.message).includes("MONGODB_URI") ? 503 : 500), { detail: error.message || "Erro interno da API." });
  }
}
const port = Number(process.env.PORT || 10000);
const server = http.createServer((req, res) => panelApi(req, res, new URL(req.url, "http://localhost")).catch(error => {
  console.error("[API painel]", error);
  if (!res.headersSent) sendJson(res, 500, { detail: "Erro interno da API." }); else res.end();
}));
server.listen(port, "0.0.0.0", () => console.log(`API do painel e health endpoint ativos na porta ${port}`));

// Inicialização centralizada, seguindo o fluxo simples do Aeternus:
// validar configuração, preparar armazenamento, registrar diagnóstico e fazer login.
// Os sistemas da Yukina continuam sendo carregados no evento clientReady.
let discordReady = false;
let loginWatchdog;

async function initializeDiscord() {
  console.log("[Inicialização] Yukina iniciando...");
  if (!TOKEN) throw new Error("DISCORD_TOKEN não está configurado.");

  console.log("[Inicialização] Validando armazenamento...");
  await memberData.initialize();
  console.log("[Inicialização] Armazenamento validado.");

  console.log("[Inicialização] Listeners preparados.");
  console.log("[Inicialização] Autenticando e conectando ao Discord pelo discord.js...");

  loginWatchdog = setTimeout(() => {
    if (discordReady) return;
    console.error("[Discord Gateway] O cliente ainda não ficou pronto após 120 segundos.", {
      wsStatus: client.ws.status,
      destroyed: client.ws.destroyed,
      readyAt: client.readyAt,
      user: client.user?.tag || null,
    });
  }, 120000);
  loginWatchdog.unref();

  try {
    // O login usa o fluxo oficial da biblioteca, sem chamadas de pré-verificação
    // e sem substituir manualmente a descoberta do Gateway.
    await client.login(TOKEN);
    console.log("[Inicialização] Login aceito pelo discord.js; aguardando clientReady.");
  } catch (error) {
    clearTimeout(loginWatchdog);
    console.error("[Inicialização] Não foi possível iniciar a sessão Discord:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      wsStatus: client.ws.status,
    });
    throw error;
  }
}

initializeDiscord().catch((error) => {
  console.error("[Inicialização] Falha fatal ao iniciar a Yukina:", error);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1500).unref();
});

// Encerramento limpo quando o Render reinicia ou interrompe o serviço.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Yukina] Recebido ${signal}; encerrando conexão e servidor HTTP...`);
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();
  try {
    client.destroy();
    await new Promise((resolve) => server.close(() => resolve()));
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error("[Yukina] Erro durante o encerramento:", error);
    process.exit(1);
  }
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
