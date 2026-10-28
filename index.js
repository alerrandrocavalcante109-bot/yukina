require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
const { applyDailyInactivityFee } = require("./systems/bank-inactivity-fee");

const TOKEN = (process.env.TOKEN || "").trim();

const DAILY_TIME_ZONE = "America/Sao_Paulo";

function getDailyDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
}

function getDailyDayKey(date = new Date()) {
  const parts = getDailyDateParts(date);
  return String(parts.year).padStart(4, "0") + "-" + String(parts.month).padStart(2, "0") + "-" + String(parts.day).padStart(2, "0");
}

function saoPauloMidnightUtc(year, month, day) {
  const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = targetUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = getDailyDateParts(new Date(guess));
    const representedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const adjustment = targetUtc - representedUtc;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(guess);
}

function getNextDailyReset(date = new Date()) {
  const parts = getDailyDateParts(date);
  return saoPauloMidnightUtc(parts.year, parts.month, parts.day + 1).toISOString();
}

if (!TOKEN) {
  console.error("❌ [Yukina] Token do Discord ausente. Configure TOKEN nas variáveis de ambiente do Render.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration],
  // Evita depender da descoberta automática do Gateway se o endpoint padrão estiver bloqueado.
  ws: { handshakeTimeout: 30000 },
  rest: { timeout: 15000 },
});

// Os sistemas são carregados somente depois que o Gateway confirmar que a Yukina está online.
let systemsLoaded = false;
function loadYukinaSystems() {
  if (systemsLoaded) return;
  systemsLoaded = true;
  console.log("[Yukina] Conexão estabelecida; iniciando os sistemas em seguida...");
  require("./command-engine")(client, getSettingsCollection);
  require("./custom-command-engine")(client, getSettingsCollection);
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
client.on("shardError", (error, shardId) => {
  console.error("[Discord Gateway] Erro no shard " + shardId + ":", error?.message || error);
});

client.on("shardDisconnect", (event, shardId) => {
  console.error("[Discord Gateway] Desconectado. Shard:", shardId, "Código:", event?.code, "Motivo:", event?.reason || "não informado");
});

client.on("shardReconnecting", (shardId) => {
  console.warn("[Discord Gateway] Reconectando shard:", shardId);
});

// Mantém apenas erros reais do cliente, sem despejar diagnósticos de heartbeat/Gateway.
client.on("error", (error) => {
  console.error("[Discord] Erro do cliente:", error);
});

client.on("shardError", (error, shardId) => {
  console.error(`[Discord] Erro no Gateway (shard ${shardId}):`, error);
});

client.on("shardDisconnect", (event, shardId) => {
  console.warn(`[Discord] Gateway desconectado (shard ${shardId}). Código: ${event?.code ?? "desconhecido"}; motivo: ${event?.reason || "não informado"}; reconexão automática será tentada pelo discord.js.`);
});

client.on("shardReconnecting", (shardId) => {
  console.warn(`[Discord] Tentando reconectar ao Gateway (shard ${shardId})...`);
});

client.on("shardResume", (shardId, replayedEvents) => {
  console.log(`[Discord] Conexão retomada (shard ${shardId}); eventos recuperados: ${replayedEvents}.`);
});

client.on("invalidated", () => {
  console.error("[Discord] A sessão foi invalidada. O processo será encerrado para o Render reiniciar o serviço.");
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
  // Nunca cria cargos automaticamente. O cargo de avisos deve ser escolhido/criado
  // manualmente no Discord e configurado pelo ID nas variáveis ou no painel.
  const roleName = (process.env.PROMOTION_NOTIFY_ROLE_NAME || "📣・Avisos de promoção").trim();
  const configuredId = (process.env.PROMOTION_NOTIFY_ROLE_ID || "").trim();

  for (const guild of client.guilds.cache.values()) {
    const role = configuredId
      ? await guild.roles.fetch(configuredId).catch(() => null)
      : guild.roles.cache.find((item) => item.name === roleName) || null;

    if (!role) {
      console.warn("[Promoções] O cargo de avisos não existe ou não foi encontrado em " + guild.name + "; nenhum cargo será criado.");
      continue;
    }
    console.log("[Promoções] Usando cargo de avisos existente em " + guild.name + ": " + role.name + " (" + role.id + ")");
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
    ["🌙 Comandos Slash", "carregamento e sincronização automática"],
    ["🪄 Interações", "botões, menus e modais"],
    ["📣 Avisos de promoção", "cargo de notificação e canal de promoções"],
    ["❄️ Hierarquia de membros", "cargos automáticos por XP e tempo de permanência"],
    ["✨ Níveis de XP", "12 cargos automáticos do nível 1 ao 100"],
    ["💓 Monitor de serviço", "endpoint HTTP para health check"],
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
  await handleCountingMessage(message);
});

// API do painel: OAuth do Discord + permissões do servidor + persistência no MongoDB.
const PANEL_ORIGINS = [...new Set(["https://yukina-6uo.pages.dev", ...(process.env.PANEL_ORIGINS || "").split(",")].map(v => v.trim().replace(/\/$/, "")).filter(Boolean))];
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
const GUILD_RESOURCES_CACHE_TTL_MS = 30 * 1000;
const guildResourcesCache = new Map();

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
    headers: { Authorization: "Bearer " + accessToken },
    signal: AbortSignal.timeout(10000)
  });
  let guildsPromise = null;
  if (!cachedGuilds || cachedGuilds.freshUntil <= now) {
    guildsPromise = fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: "Bearer " + accessToken },
      signal: AbortSignal.timeout(10000)
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
        // Um cache antigo não prova que o usuário perdeu acesso ao servidor.
        // Se o servidor solicitado não aparece nele, responde com erro temporário
        // em vez de afirmar incorretamente que a Yukina não está no servidor.
        if (!Array.isArray(guilds) || !guilds.some(g => g.id === guildId)) {
          throw Object.assign(new Error("O Discord limitou a consulta aos seus servidores e o cache disponível não confirma seu acesso. Aguarde um minuto e tente novamente; não é necessário remover ou adicionar a Yukina por causa deste aviso."), { status: 503 });
        }
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
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton() || !String(interaction.customId || "").startsWith("ykticket:")) return;
  const [, panelMessageId, buttonIndexRaw] = interaction.customId.split(":");
  try {
    if (!interaction.guild || !interaction.member) return interaction.reply({ content: "Este botão só funciona dentro do servidor.", ephemeral: true });
    if (panelMessageId === "close") {
      const channelId = buttonIndexRaw;
      const channel = interaction.guild.channels.cache.get(channelId);
      const isOwner = channel?.topic?.includes("usuário " + interaction.user.id + " ");
      const canManage = interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels);
      if (!channel || (!isOwner && !canManage)) return interaction.reply({ content: "Somente quem abriu o ticket ou a equipe pode fechá-lo.", ephemeral: true });
      await interaction.reply({ content: "🔒 Este atendimento será fechado em alguns segundos." });
      await channel.delete("Atendimento fechado por " + interaction.user.tag).catch(() => {});
      return;
    }
    const collection = await getSettingsCollection();
    const doc = await collection.findOne({ guildId: interaction.guild.id });
    const panels = Array.isArray(doc?.settings?.ticketPanels) ? doc.settings.ticketPanels : [];
    const panel = panels.find(item => String(item.messageId || item.id) === panelMessageId);
    const button = panel?.buttons?.[Number(buttonIndexRaw)];
    if (!panel || !button) return interaction.reply({ content: "Este painel não está mais configurado. Avise a equipe do servidor.", ephemeral: true });
    if (button.type === "custom") return interaction.reply({ content: button.customReply || "🌙 A Yukina recebeu sua escolha. Em breve alguém da equipe poderá ajudar você.", ephemeral: true });
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const safeName = String(button.label || "atendimento").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 35) || "atendimento";
    const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 12);
    const channel = await interaction.guild.channels.create({
      name: (safeName + "-" + username).slice(0, 90), type: ChannelType.GuildText,
      parent: panel.categoryId && interaction.guild.channels.cache.has(panel.categoryId) ? panel.categoryId : undefined,
      topic: "Ticket da Yukina • usuário " + interaction.user.id + " • painel " + panelMessageId,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.EmbedLinks] }
      ]
    });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ykticket:close:" + channel.id).setLabel("Fechar atendimento").setStyle(ButtonStyle.Danger).setEmoji("🔒"));
    await channel.send({ content: "<@" + member.id + "> " + (button.emoji || "🎫") + " **" + button.label + "**\nExplique sua solicitação aqui. A equipe poderá continuar o atendimento neste canal.", components: [row] });
    await interaction.reply({ content: "🌙 Seu atendimento foi criado: " + channel, ephemeral: true });
  } catch (error) {
    console.error("[Tickets] Erro ao abrir atendimento:", error.stack || error.message || error);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: "Não consegui abrir o atendimento. Verifique as permissões da Yukina.", ephemeral: true }).catch(() => {});
  }
});

async function publishTicketPanel(req, res) {
  console.info("[Tickets] Requisição recebida:", req.method, req.url, "origin:", req.headers.origin || "sem origin");
  const auth = String(req.headers.authorization || "");
  const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!accessToken) return sendJson(res, 401, { detail: "Entre com o Discord antes de publicar o painel." });
  const meResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(10000) });
  const me = meResponse.ok ? await meResponse.json().catch(() => null) : null;
  if (!me?.id) return sendJson(res, 401, { detail: "Sua sessão do Discord expirou. Entre novamente." });
  const body = await readBody(req);
  const guildId = String(body.guildId || "");
  const channelId = String(body.channelId || "");
  console.info("[Tickets] Validando publicação:", { guildId, channelId, hasTitle: Boolean(body.title) });
  if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(channelId)) return sendJson(res, 400, { detail: "Selecione um servidor e um canal válidos." });
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return sendJson(res, 404, { detail: "A Yukina não está conectada a esse servidor." });
  const requester = await guild.members.fetch(me.id).catch(() => null);
  if (!requester || !requester.permissions.has(PermissionsBitField.Flags.ManageGuild) && !requester.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return sendJson(res, 403, { detail: "Sua conta precisa da permissão Gerenciar servidor ou Administrador nesse servidor." });
  }
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.send) return sendJson(res, 400, { detail: "O canal escolhido não aceita mensagens." });
  const meMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  const perms = meMember && channel.permissionsFor(meMember);
  if (!perms?.has(PermissionsBitField.Flags.ViewChannel) || !perms?.has(PermissionsBitField.Flags.SendMessages) || !perms?.has(PermissionsBitField.Flags.EmbedLinks)) {
    return sendJson(res, 403, { detail: "A Yukina precisa de Ver canal, Enviar mensagens e Incorporar links no canal escolhido." });
  }
  const hex = String(body.embedColor || "#c4b5fd");
  const color = /^#[0-9a-fA-F]{6}$/.test(hex) ? parseInt(hex.slice(1), 16) : 0xc4b5fd;
  const title = String(body.title || "🎫 Central de Atendimento").slice(0, 256);
  const message = String(body.message || "Olá! Sou a Yukina. Escolha abaixo o tipo de atendimento que você precisa.").slice(0, 4000);
  const images = body.images && typeof body.images === "object" ? body.images : {};
  const validUrl = value => { try { const u = new URL(String(value || "")); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch (_) { return ""; } };
  const imageTop = validUrl(images.top), imageMiddle = validUrl(images.middle), imageFooter = validUrl(images.footer), imageRight = validUrl(images.right);
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(message);
  const rawButtons = Array.isArray(body.buttons) ? body.buttons.slice(0, 5) : [
    { label: "Suporte", emoji: "🎫", style: "Primary", type: "ticket" },
    { label: "Falar com a equipe", emoji: "🌙", style: "Secondary", type: "ticket" }
  ];
  const buttonStyleMap = { Primary: ButtonStyle.Primary, Secondary: ButtonStyle.Secondary, Success: ButtonStyle.Success, Danger: ButtonStyle.Danger };
  const ticketButtons = rawButtons.map((item, index) => ({
    label: String(item?.label || (index ? "Atendimento" : "Suporte")).slice(0, 80),
    emoji: String(item?.emoji || "").slice(0, 32),
    style: ["Primary", "Secondary", "Success", "Danger"].includes(item?.style) ? item.style : "Primary",
    type: item?.type === "custom" ? "custom" : "ticket",
    customReply: String(item?.customReply || "").slice(0, 1000)
  }));
  if (imageTop || imageMiddle || imageFooter) embed.setImage(imageTop || imageMiddle || imageFooter);
  if (imageRight) embed.setThumbnail(imageRight);
  embed.setFooter({ text: "Yukina • Atendimento" });
  try {
    console.info("[Tickets] Enviando embed para o canal:", channel.id);
    const sent = await channel.send({ embeds: [embed] });
    const buttonRows = [];
    for (let offset = 0; offset < ticketButtons.length; offset += 5) {
      buttonRows.push(new ActionRowBuilder().addComponents(ticketButtons.slice(offset, offset + 5).map((item, localIndex) => {
        const index = offset + localIndex;
        const button = new ButtonBuilder().setCustomId("ykticket:" + sent.id + ":" + index).setLabel(item.label).setStyle(buttonStyleMap[item.style]);
        if (item.emoji) { try { button.setEmoji(item.emoji); } catch (_) {} }
        return button;
      })));
    }
    if (buttonRows.length) await sent.edit({ components: buttonRows });
    const settingsCollection = await getSettingsCollection();
    const saved = { id: sent.id, messageId: sent.id, guildId, guildName: guild.name, channelId: channel.id, channelName: channel.name, title, message, embedColor: hex, images: { top: imageTop, middle: imageMiddle, right: imageRight, footer: imageFooter }, buttons: ticketButtons, createChannel: Boolean(body.createChannel), useThreads: Boolean(body.useThreads), channelAtTop: Boolean(body.channelAtTop), categoryId: String(body.categoryId || ""), publishedAt: new Date().toISOString() };
    await settingsCollection.updateOne({ guildId }, { $set: { guildName: guild.name, updatedAt: new Date() }, $push: { "settings.ticketPanels": saved } }, { upsert: true });
    console.info("[Tickets] Painel publicado e salvo:", { guildId, channelId: channel.id, messageId: sent.id });
    return sendJson(res, 200, { ok: true, ...saved });
  } catch (error) {
    console.error("[Painel atendimento] Falha ao publicar:", error.message || error);
    return sendJson(res, 500, { detail: "Não consegui publicar o painel. Confira as permissões da Yukina e tente novamente." });
  }
}

async function panelApi(req, res, url) {
  // Configure CORS antes de qualquer rota, inclusive /api/oauth/guilds.
  const origin = String(req.headers.origin || "");
  if (origin && PANEL_ORIGINS.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }


  if (url.pathname === "/api/tickets/manage") {
    if (req.method !== "POST") return sendJson(res, 405, { detail: "Use POST para gerenciar painéis." });
    try {
      const auth = String(req.headers.authorization || "");
      const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!accessToken) return sendJson(res, 401, { detail: "Entre com o Discord para gerenciar painéis." });
      const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(10000) });
      const user = userResponse.ok ? await userResponse.json().catch(() => null) : null;
      if (!user?.id) return sendJson(res, 401, { detail: "Sua sessão do Discord expirou. Entre novamente." });
      const body = await readBody(req);
      const guildId = String(body.guildId || ""), messageId = String(body.messageId || ""), action = String(body.action || "");
      if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(messageId) || !["edit","delete"].includes(action)) return sendJson(res, 400, { detail: "Dados do painel inválidos." });
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return sendJson(res, 404, { detail: "A Yukina não está conectada a esse servidor." });
      const requester = await guild.members.fetch(user.id).catch(() => null);
      if (!requester || (!requester.permissions.has(PermissionsBitField.Flags.ManageGuild) && !requester.permissions.has(PermissionsBitField.Flags.Administrator))) return sendJson(res, 403, { detail: "Você precisa de Gerenciar servidor ou Administrador." });
      const settingsCollection = await getSettingsCollection();
      const doc = await settingsCollection.findOne({ guildId });
      const panels = Array.isArray(doc?.settings?.ticketPanels) ? doc.settings.ticketPanels : [];
      const panel = panels.find(item => String(item.messageId || item.id) === messageId);
      if (!panel) return sendJson(res, 404, { detail: "Painel salvo não encontrado." });
      if (action === "delete") {
        const channel = await guild.channels.fetch(String(panel.channelId)).catch(() => null);
        if (channel?.messages?.fetch) {
          const message = await channel.messages.fetch(messageId).catch(() => null);
          if (message) await message.delete();
        }
        await settingsCollection.updateOne({ guildId }, { $pull: { "settings.ticketPanels": { messageId } }, $set: { updatedAt: new Date() } });
        return sendJson(res, 200, { ok: true, action, messageId });
      }
      const channel = await guild.channels.fetch(String(panel.channelId)).catch(() => null);
      const message = channel?.messages?.fetch ? await channel.messages.fetch(messageId).catch(() => null) : null;
      if (!message) return sendJson(res, 404, { detail: "A mensagem publicada não foi encontrada no Discord." });
      const title = String(body.title || panel.title || "🎫 Central de Atendimento").slice(0,256);
      const description = String(body.message || panel.message || "").slice(0,4000);
      const hex = String(body.embedColor || panel.embedColor || "#c4b5fd");
      const color = /^#[0-9a-fA-F]{6}$/.test(hex) ? parseInt(hex.slice(1),16) : 0xc4b5fd;
      const images = body.images && typeof body.images === "object" ? body.images : (panel.images || {});
      const validUrl = value => { try { const u = new URL(String(value || "")); return ["http:","https:"].includes(u.protocol) ? u.href : ""; } catch (_) { return ""; } };
      const top=validUrl(images.top), middle=validUrl(images.middle), footer=validUrl(images.footer), right=validUrl(images.right);
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setFooter({text:"Yukina • Atendimento"});
      if (top || middle || footer) embed.setImage(top || middle || footer);
      if (right) embed.setThumbnail(right);
      await message.edit({ embeds: [embed] });
      const updated = { ...panel, title, message: description, embedColor: hex, images: {top,middle,right,footer}, updatedAt: new Date().toISOString() };
      await settingsCollection.updateOne({ guildId, "settings.ticketPanels.messageId": messageId }, { $set: { "settings.ticketPanels.$": updated, updatedAt: new Date() } });
      return sendJson(res, 200, { ok: true, panel: updated });
    } catch (error) {
      console.error("[Tickets] Falha ao gerenciar painel:", error.stack || error.message || error);
      return sendJson(res, 500, { detail: "Não foi possível gerenciar o painel: " + String(error.message || "erro interno").slice(0,150) });
    }
  }
  if (url.pathname === "/api/tickets/publish") {
    if (req.method !== "POST") return sendJson(res, 405, { detail: "Use POST para publicar o painel." });
    console.info("[Tickets] Rota /api/tickets/publish acionada.");
    try { return await publishTicketPanel(req, res); } catch (error) { console.error("[Tickets] Erro na rota de publicação:", error.stack || error.message || error); return sendJson(res, 500, { detail: "Falha ao publicar o painel de atendimento: " + String(error.message || "erro interno").slice(0, 180) }); }
  }
  if (url.pathname === "/api/oauth/me") {
    if (req.method !== "GET") return sendJson(res, 405, { detail: "Use GET para consultar o perfil." });
    const auth = String(req.headers.authorization || "");
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!accessToken) return sendJson(res, 401, { detail: "Entre com o Discord para consultar o perfil." });
    try {
      const response = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status === 401 ? 401 : response.status === 403 ? 403 : 502;
        return sendJson(res, status, { detail: status === 401 ? "Sua sessão do Discord expirou. Entre novamente." : "Não foi possível consultar o perfil do Discord." });
      }
      return sendJson(res, 200, {
        id: String(data.id || ""),
        username: String(data.username || ""),
        global_name: data.global_name || null,
        avatar: data.avatar || null,
        discriminator: String(data.discriminator || "0")
      });
    } catch (error) {
      console.error("[API painel] Erro ao consultar perfil OAuth:", error.message || error);
      return sendJson(res, 502, { detail: "A API não conseguiu consultar o perfil do Discord." });
    }
  }

  if (url.pathname === "/api/oauth/guilds") {
    if (req.method !== "GET") return sendJson(res, 405, { detail: "Use GET para listar servidores." });
    const auth = String(req.headers.authorization || "");
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!accessToken) return sendJson(res, 401, { detail: "Entre com o Discord para listar os servidores." });
    try {
      const response = await fetch("https://discord.com/api/users/@me/guilds?limit=200", {
        headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status === 401 ? 401 : response.status === 403 ? 403 : response.status === 429 ? 429 : 502;
        console.warn("[API painel] Falha ao listar servidores OAuth:", JSON.stringify({ status: response.status, detail: data.message || data.error || "" }));
        return sendJson(res, status, {
          detail: status === 401 ? "Sua sessão do Discord expirou. Entre novamente."
            : status === 403 ? "A sessão não tem permissão para listar servidores. Entre novamente e autorize a permissão de servidores."
            : status === 429 ? "O Discord limitou temporariamente a lista de servidores. Aguarde um minuto e tente novamente."
            : "O Discord está temporariamente indisponível para listar servidores."
        });
      }
      const userGuilds = Array.isArray(data) ? data : [];
      // Retorna somente servidores onde a Yukina está presente e o usuário pode gerenciar.
      const manageableGuilds = userGuilds.filter(g => {
        try {
          const permissions = BigInt(g.permissions || "0");
          const canManage = (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n;
          return canManage && client.guilds.cache.has(String(g.id));
        } catch (_) { return false; }
      }).map(g => {
        const botGuild = client.guilds.cache.get(String(g.id));
        return { id: String(g.id), name: String(g.name || botGuild.name), icon: g.icon || null, permissions: String(g.permissions || "0") };
      });
      return sendJson(res, 200, manageableGuilds);
    } catch (error) {
      console.error("[API painel] Erro ao consultar servidores OAuth:", error.message || error);
      return sendJson(res, 502, { detail: "A API não conseguiu consultar os servidores no Discord. Tente novamente." });
    }
  }
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
      if (!user || !/^\d{17,20}$/.test(String(user.id || ""))) return sendJson(res, 401, { ok: false, detail: "Sua sessão do Discord expirou. Entre novamente." });
      const guildId = (process.env.VIP_GUILD_ID || "").trim();
      if (!/^\d{17,20}$/.test(guildId)) return sendJson(res, 503, { ok: false, detail: "O servidor Daily ainda não está configurado." });
      if (!MONGODB_URI) return sendJson(res, 503, { ok: false, detail: "O banco de dados do Daily não está configurado." });
      if (!settingsMongoClient) settingsMongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      await settingsMongoClient.connect();
      const daily = settingsMongoClient.db(MONGODB_DB).collection("daily_claims");
      await daily.createIndex({ guildId: 1, userId: 1, day: 1 }, { unique: true });
      const now = new Date();
      const day = getDailyDayKey(now);
      const previous = await daily.findOne({ guildId, userId: String(user.id), day });
      if (!isClaim) return sendJson(res, 200, { ok: true, claimed: Boolean(previous), nextReset: getNextDailyReset(now) });
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
      const feeResult = await applyDailyInactivityFee({ db: settingsMongoClient.db(MONGODB_DB), guildId, userId: String(user.id), now });
      const session = settingsMongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          await daily.insertOne({ guildId, userId: String(user.id), day, plan: planKey || null, multiplier, baseReward, reward, claimedAt: now }, { session });
          await settingsMongoClient.db(MONGODB_DB).collection("economy_balances").updateOne(
            { guildId, userId: String(user.id) },
            { $inc: { balance: reward }, $set: { updatedAt: now }, $setOnInsert: { createdAt: now } },
            { upsert: true, session }
          );
        });
      } catch (err) {
        if (err && err.code === 11000) return sendJson(res, 409, { ok: false, claimed: true, detail: "Você já coletou seu Daily hoje! Volte amanhã para coletar novamente." });
        throw err;
      } finally {
        await session.endSession();
      }
      return sendJson(res, 200, { ok: true, claimed: true, day, plan: planName, multiplier, baseReward, reward, bankFee: feeResult.fee, bankFeeOverdueDays: feeResult.overdueDays, balanceUpdated: true, nextReset: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString() });
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
      if (!user || !/^\d{17,20}$/.test(String(user.id || ""))) {
        return sendJson(res, 401, { ok: false, detail: "Sua sessão do Discord expirou. Entre novamente." });
      }
      const guildId = (process.env.VIP_GUILD_ID || "").trim();
      if (!/^\d{17,20}$/.test(guildId)) {
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
      // Resposta curta em cache: os vários sistemas do painel compartilham os mesmos cargos/canais.
      const cached = guildResourcesCache.get(guildId);
      if (cached && cached.expiresAt > Date.now()) return sendJson(res, 200, cached.payload);

      let rolesFetchError = null;
      let channelsFetchError = null;
      // O cliente Discord normalmente já tem esses dados em cache após GUILD_CREATE.
      // Só consulta a API do Discord quando o cache local está vazio, em paralelo.
      const fetches = [];
      if (guild.roles.cache.size <= 1) fetches.push(guild.roles.fetch().catch(error => { rolesFetchError = error; }));
      if (guild.channels.cache.size === 0) fetches.push(guild.channels.fetch().catch(error => { channelsFetchError = error; }));
      await Promise.all(fetches);
      if (rolesFetchError) console.error("[API painel] Falha ao buscar cargos do Discord:", { guildId, code: rolesFetchError.code, message: rolesFetchError.message });
      if (channelsFetchError) console.error("[API painel] Falha ao buscar canais do Discord:", { guildId, code: channelsFetchError.code, message: channelsFetchError.message });

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
      const payload = {
        guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 128 }) },
        roles, channels, categories,
        diagnostics: {
          rolesFetchFailed: Boolean(rolesFetchError),
          channelsFetchFailed: Boolean(channelsFetchError),
          roleCount: roles.length,
          channelCount: channels.length
        }
      };
      guildResourcesCache.set(guildId, { payload, expiresAt: Date.now() + GUILD_RESOURCES_CACHE_TTL_MS });
      if (guildResourcesCache.size > 200) {
        for (const [key, value] of guildResourcesCache) if (value.expiresAt <= Date.now()) guildResourcesCache.delete(key);
        if (guildResourcesCache.size > 200) guildResourcesCache.delete(guildResourcesCache.keys().next().value);
      }
      return sendJson(res, 200, payload);
    }
    if (section !== "settings") return sendJson(res, 404, { detail: "Rota não encontrada." });
    const collection = await getSettingsCollection();
    if (req.method === "GET") {
      const doc = await collection.findOne({ guildId });
      const settings = { ...(doc?.settings || {}) };
      let temporalConfig = await temporalStorage.get(guildId, "config", null);
      // Reconcile o armazenamento do sistema com as configurações antigas do painel.
      // Se um armazenamento tiver uma lista vazia e o outro ainda tiver regras,
      // preserva as regras existentes em vez de mostrar uma configuração em branco.
      if (!temporalConfig && (Array.isArray(settings.timeRules) || Array.isArray(settings.timeManagedRoleIds))) {
        temporalConfig = {
          timeRules: Array.isArray(settings.timeRules) ? settings.timeRules : [],
          timeManagedRoleIds: Array.isArray(settings.timeManagedRoleIds) ? settings.timeManagedRoleIds : [],
        };
        await temporalStorage.set(guildId, "config", temporalConfig);
        console.log("[Armazenamento] Hierarquia temporal migrada para system-storage no servidor " + guildId + ".");
      }
      if (temporalConfig && typeof temporalConfig === "object") {
        const storedRules = Array.isArray(temporalConfig.timeRules) ? temporalConfig.timeRules : [];
        const legacyRules = Array.isArray(settings.timeRules) ? settings.timeRules : [];
        const storedManaged = Array.isArray(temporalConfig.timeManagedRoleIds) ? temporalConfig.timeManagedRoleIds : [];
        const legacyManaged = Array.isArray(settings.timeManagedRoleIds) ? settings.timeManagedRoleIds : [];
        if (!storedRules.length && legacyRules.length) temporalConfig.timeRules = legacyRules;
        if (!storedManaged.length && legacyManaged.length) temporalConfig.timeManagedRoleIds = legacyManaged;
        if (Array.isArray(temporalConfig.timeRules)) settings.timeRules = temporalConfig.timeRules;
        if (Array.isArray(temporalConfig.timeManagedRoleIds)) settings.timeManagedRoleIds = temporalConfig.timeManagedRoleIds;
        if ((!storedRules.length && legacyRules.length) || (!storedManaged.length && legacyManaged.length)) {
          await temporalStorage.set(guildId, "config", temporalConfig);
        }
      }
      let xpConfig = await xpStorage.get(guildId, "config", null);
      if (!xpConfig && (Array.isArray(settings.xpRules) || Array.isArray(settings.xpManagedRoleIds))) {
        xpConfig = {
          xpRules: Array.isArray(settings.xpRules) ? settings.xpRules : [],
          xpManagedRoleIds: Array.isArray(settings.xpManagedRoleIds) ? settings.xpManagedRoleIds : [],
        };
        await xpStorage.set(guildId, "config", xpConfig);
        console.log("[Armazenamento] Cargos por XP migrados para system-storage no servidor " + guildId + ".");
      }
      if (xpConfig && typeof xpConfig === "object") {
        const storedRules = Array.isArray(xpConfig.xpRules) ? xpConfig.xpRules : [];
        const legacyRules = Array.isArray(settings.xpRules) ? settings.xpRules : [];
        const storedManaged = Array.isArray(xpConfig.xpManagedRoleIds) ? xpConfig.xpManagedRoleIds : [];
        const legacyManaged = Array.isArray(settings.xpManagedRoleIds) ? settings.xpManagedRoleIds : [];
        if (!storedRules.length && legacyRules.length) xpConfig.xpRules = legacyRules;
        if (!storedManaged.length && legacyManaged.length) xpConfig.xpManagedRoleIds = legacyManaged;
        if (Array.isArray(xpConfig.xpRules)) settings.xpRules = xpConfig.xpRules;
        if (Array.isArray(xpConfig.xpManagedRoleIds)) settings.xpManagedRoleIds = xpConfig.xpManagedRoleIds;
        if ((!storedRules.length && legacyRules.length) || (!storedManaged.length && legacyManaged.length)) {
          await xpStorage.set(guildId, "config", xpConfig);
        }
      }
      let multiplierConfig = await xpMultiplierStorage.get(guildId, "config", null);
      if (!multiplierConfig && Array.isArray(settings.multiplierRules)) {
        multiplierConfig = { multiplierRules: settings.multiplierRules };
        await xpMultiplierStorage.set(guildId, "config", multiplierConfig);
        console.log("[Armazenamento] Multiplicadores de XP migrados para system-storage no servidor " + guildId + ".");
      }
      if (multiplierConfig && typeof multiplierConfig === "object" && Array.isArray(multiplierConfig.multiplierRules)) {
        const storedRules = multiplierConfig.multiplierRules;
        const legacyRules = Array.isArray(settings.multiplierRules) ? settings.multiplierRules : [];
        if (!storedRules.length && legacyRules.length) {
          multiplierConfig.multiplierRules = legacyRules;
          await xpMultiplierStorage.set(guildId, "config", multiplierConfig);
        }
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
        if (key === "prefix" && (typeof value !== "string" || value.length < 1 || value.length > 5 || /\s/.test(value))) {
          return sendJson(res, 400, { detail: "O prefixo deve ter de 1 a 5 caracteres e não pode conter espaços." });
        }
        if (typeof value === "string") clean[key] = value.slice(0, 2000);
        else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
        else if (typeof value === "boolean" || value === null) clean[key] = value;
        else if (Array.isArray(value)) clean[key] = value.slice(0, 100);
        else if (value && typeof value === "object") clean[key] = value;
      }
      // Hierarquia temporal: aceitar somente IDs de cargos que já existem no servidor.
      // Salvar configurações nunca deve criar cargos nem interpretar nomes como IDs.
      if (Object.prototype.hasOwnProperty.call(clean, "timeRules")) {
        if (!Array.isArray(clean.timeRules)) {
          return sendJson(res, 400, { detail: "A hierarquia temporal deve ser uma lista de regras." });
        }
        const existingRoleIds = new Set(guild.roles.cache.map(role => role.id));
        const invalidRule = clean.timeRules.find(rule => {
          const roleId = String(rule?.roleId || rule?.role_id || rule?.role || "");
          return !/^\d{17,20}$/.test(roleId) || !existingRoleIds.has(roleId) ||
            !Number.isInteger(Number(rule?.days)) || Number(rule.days) < 1 || Number(rule.days) > 3650;
        });
        if (invalidRule) {
          return sendJson(res, 400, { detail: "Use apenas cargos já existentes no servidor e prazos inteiros entre 1 e 3650 dias. Nenhum cargo foi criado." });
        }
      }
      if (Object.prototype.hasOwnProperty.call(clean, "timeManagedRoleIds")) {
        if (!Array.isArray(clean.timeManagedRoleIds)) {
          return sendJson(res, 400, { detail: "A lista de cargos gerenciados da hierarquia temporal é inválida." });
        }
        const existingRoleIds = new Set(guild.roles.cache.map(role => role.id));
        if (clean.timeManagedRoleIds.some(id => !existingRoleIds.has(String(id)))) {
          return sendJson(res, 400, { detail: "A hierarquia temporal aceita somente IDs de cargos existentes. Nenhum cargo foi criado." });
        }
      }
      const updatedAt = new Date();
      const patch = { guildId, guildName: guild.name, updatedAt };
      for (const [key, value] of Object.entries(clean)) patch["settings." + key] = value;
      await collection.updateOne({ guildId }, { $set: patch }, { upsert: true });
      if (Object.prototype.hasOwnProperty.call(clean, "prefix")) client.emit("yukinaPrefixUpdated", guildId, clean.prefix);
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

// Inicialização centralizada do cliente Discord.
let discordReady = false;
let loginWatchdog;

async function initializeDiscord() {
  console.log("[Inicialização] Etapa 1/4: validando configuração...");
  if (!TOKEN) {
    throw new Error("TOKEN não está configurado.");
  }

  console.log("[Inicialização] Verificando armazenamento de membros...");
  await memberData.initialize();
  console.log("[Inicialização] Banco de membros validado.");

  console.log("[Inicialização] Etapa 2/4: cliente e listeners preparados.");
  console.log("[Inicialização] Etapa 3/4: conectando ao Discord...");

  // O Gateway pode demorar para responder. Não derrube o processo inteiro
  // após 60 segundos: mantenha a API HTTP ativa e deixe o discord.js tentar
  // estabelecer/reestabelecer a conexão, registrando o estado para diagnóstico.
  loginWatchdog = setTimeout(() => {
    if (discordReady) return;
    console.error("[Yukina] Aviso: o Discord ainda não ficou pronto após 60 segundos; processo e API permanecem ativos enquanto a conexão é investigada.");
    console.error("[Yukina] Estado atual do Gateway:", client.ws.status);
  }, 60000);
  loginWatchdog.unref();

  try {
    // Desativa logs de diagnóstico do Discord.js (heartbeat, ACK e eventos internos do Gateway).
    client.removeAllListeners("debug");

    await client.login(TOKEN);
  
  } catch (error) {
    clearTimeout(loginWatchdog);
    console.error("[Inicialização] Falha ao autenticar/conectar ao Discord:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      wsStatus: client.ws.status
    });
    throw error;
  }
}

initializeDiscord().then(() => {

}).catch((error) => {
  console.error("[Inicialização] Inicialização do Discord falhou.", error);
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
