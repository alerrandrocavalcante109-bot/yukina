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
  Partials,
} = require("discord.js");
const http = require("node:http");
const crypto = require("node:crypto");
const { MongoClient } = require("mongodb");
const fs = require("node:fs");
const path = require("node:path");
const memberData = require("./member-data");
const temporalStorage = require("./system-storage").forSystem("temporal-hierarchy");
const xpStorage = require("./system-storage").forSystem("xp-level-roles");
const xpMultiplierStorage = require("./system-storage").forSystem("xp-multipliers");
const { parseCountingValue } = require("./counting-number-parser");
const { getVipCollection, activateSubscription } = require("./vip-store");
const { applyDailyInactivityFee } = require("./systems/bank-inactivity-fee");
const { invalidateGuildSettings } = require("./guild-settings-store");
const nickColorsSystem = require("./systems/nick-colors");

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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
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
  nickColorsSystem.install(client, getSettingsCollection);
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
  const commandsByName = new Map();
  const invalidFiles = [];

  function collect(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        collect(file);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".js") || entry.name.startsWith("_")) continue;
      try {
        delete require.cache[require.resolve(file)];
        const command = require(file);
        // Somente módulos completos, com definição slash serializável e executor.
        if (!command?.data?.toJSON || typeof command.execute !== "function") continue;
        const payload = command.data.toJSON();
        if (!payload?.name || typeof payload.name !== "string") {
          throw new Error("Definição slash sem nome válido.");
        }
        if (commandsByName.has(payload.name)) {
          const previous = commandsByName.get(payload.name);
          throw new Error("Nome slash duplicado também declarado em " + previous.file);
        }
        commandsByName.set(payload.name, { payload, file: path.relative(__dirname, file) });
      } catch (error) {
        invalidFiles.push({ file: path.relative(__dirname, file), message: error.message });
      }
    }
  }

  collect(commandsDir);
  if (invalidFiles.length) {
    for (const item of invalidFiles) {
      console.error("[Slash] Módulo ignorado/duplicado: " + item.file + " — " + item.message);
    }
  }

  const commands = [...commandsByName.values()].map(item => item.payload);
  const clientId = (process.env.DISCORD_CLIENT_ID || client.user?.id || "").trim();
  if (!clientId) {
    console.error("[Slash] Não foi possível identificar o ID da aplicação; comandos não registrados.");
    return;
  }

  const guildId = (process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "").trim();
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    // PUT substitui a lista inteira: comandos antigos que não existem mais no código são apagados.
    const result = await rest.put(route, { body: commands });
    console.log("[Slash] Sincronização limpa concluída: " + commands.length +
      " comando(s) válido(s); " + result.length + " registrado(s) " +
      (guildId ? "no servidor " + guildId : "globalmente") + ".");
    console.log("[Slash] Comandos publicados: " + (commands.map(command => "/" + command.name).join(", ") || "nenhum"));
    if (invalidFiles.length) {
      console.warn("[Slash] " + invalidFiles.length + " arquivo(s) foram ignorados; revise os avisos acima.");
    }
  } catch (error) {
    console.error("[Slash] Falha na sincronização limpa:", {
      code: error?.code, status: error?.status, message: error?.message
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
  // Mantém o sistema de contagem e responde quando alguém chama a Yukina.
  await handleCountingMessage(message);

  if (message.author.bot || !message.guild || !client.user) return;
  const content = String(message.content || "").trim();
  const mentionPattern = new RegExp("<@!?" + client.user.id + ">", "g");
  if (!mentionPattern.test(content)) return;

  // Responde à menção sozinha ou acompanhada de uma saudação, sem reagir
  // a toda conversa em que a Yukina seja citada.
  const remainingText = content
    .replace(mentionPattern, "")
    .replace(/[\\s.,!?¿¡🌸❄️🌙]+/gu, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const greetings = new Set([
    "", "oi", "oie", "oii", "olá", "ola", "olá yukina", "ola yukina",
    "oi yukina", "oie yukina", "bom dia", "boa tarde", "boa noite",
    "hey", "hello", "e aí", "eai", "tudo bem", "yukina"
  ]);
  if (!greetings.has(remainingText)) return;

  try {
    let prefix = "Y";
    const collection = await getSettingsCollection();
    const doc = await collection.findOne(
      { guildId: message.guild.id },
      { projection: { "settings.prefix": 1 } }
    );
    const configured = String(doc?.settings?.prefix || "").trim();
    if (configured && configured.length <= 5 && !/\\s/.test(configured)) prefix = configured;

    const intro =
      "❄️ Oii! Eu sou a Yukina! 🌸\n\n" +
      "Sou a assistente deste servidor e estou aqui para trazer diversão, interação e um pouquinho da magia japonesa.\n\n" +
      "⌨️ Meu prefixo neste servidor é: `" + prefix + "`\n" +
      "📚 Para ver meus comandos, use `" + prefix + "ajuda` ou `/ajuda`.\n\n" +
      "Espero que a gente se divirta bastante juntinhos! 🌙";

    await message.reply({ content: intro, allowedMentions: { repliedUser: false, parse: [] } });
  } catch (error) {
    console.error("[Yukina] Falha ao responder à menção:", error?.message || error);
    await message.reply({
      content: "❄️ Oii! Eu sou a Yukina! 🌸\\n\\nMeu prefixo padrão é `Y`. Use `Yajuda` ou `/ajuda` para ver os comandos.",
      allowedMentions: { repliedUser: false, parse: [] }
    }).catch(() => {});
  }
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

// Assinaturas individuais: o plano pertence à conta Discord, não a um servidor.
// Se houver registros antigos por servidor, prevalece o plano ativo de maior nível.
async function getActiveUserSubscription(userId, now = new Date()) {
  const subscriptions = await getVipCollection();
  const active = await subscriptions.find({
    userId: String(userId),
    status: "active",
    expiresAt: { $gt: now }
  }).sort({ updatedAt: -1, createdAt: -1 }).toArray();

  const tier = { starter: 1, plus: 2, premium: 3, ultra: 4, infinity: 5 };
  return active.sort((a, b) =>
    (tier[String(b.planKey || "").toLowerCase()] || 0) -
    (tier[String(a.planKey || "").toLowerCase()] || 0)
  )[0] || null;
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
  if(url.pathname==="/wyvi/webhook"&&req.method==="POST"){
    try{
      const secret=String(process.env.WYVIPAY_WEBHOOK_SECRET||"").trim();if(!secret)return sendJson(res,503,{detail:"Segredo do webhook não configurado."});
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)return sendJson(res,413,{detail:"Webhook muito grande."});chunks.push(chunk);}
      const raw=Buffer.concat(chunks),stamp=String(req.headers["x-wyvi-carimbo"]||""),sig=String(req.headers["x-wyvi-assinatura"]||""),delivery=String(req.headers["x-wyvi-entrega"]||"");
      if(!/^\d{10}$/.test(stamp)||Math.abs(Math.floor(Date.now()/1000)-Number(stamp))>300||!/^v1=[a-f0-9]{64}$/i.test(sig)||!delivery)return sendJson(res,401,{detail:"Assinatura inválida ou expirada."});
      const expected=crypto.createHmac("sha256",secret).update(stamp+".").update(raw).digest(),given=Buffer.from(sig.slice(3),"hex");
      if(given.length!==expected.length||!crypto.timingSafeEqual(expected,given))return sendJson(res,401,{detail:"Assinatura inválida."});
      const ev=JSON.parse(raw.toString("utf8"));if(String(ev.id||"")!==delivery||String(ev.evento||"")!==String(req.headers["x-wyvi-evento"]||""))return sendJson(res,400,{detail:"Entrega inconsistente."});
      await getSettingsCollection();const db=settingsMongoClient.db(MONGODB_DB),deliveries=db.collection("wyvi_webhook_deliveries");
      try{await deliveries.insertOne({_id:delivery,evento:ev.evento,receivedAt:new Date(),processed:false});}catch(e){if(e?.code===11000)return sendJson(res,200,{ok:true,duplicate:true});throw e;}
      if(ev.evento==="cobranca.paga"){
        const d=ev.dados||{},ref=String(d.referencia||""),txid=String(d.txid||""),orders=db.collection("vip_orders"),order=ref?await orders.findOne({_id:ref,provider:"wyvipay"}):null;
        if(order&&txid&&Number(d.valor_centavos)===Number(order.amountCents)){
          const payments=db.collection("vip_payment_events");
          try{await payments.insertOne({_id:txid,orderId:ref,deliveryId:delivery,receivedAt:new Date()});}
          catch(e){if(e?.code===11000){await deliveries.updateOne({_id:delivery},{$set:{processed:true,duplicatePayment:true,orderId:ref}});return sendJson(res,200,{ok:true,duplicatePayment:true});}throw e;}
          try{
            await activateSubscription({guildId:String(process.env.VIP_GUILD_ID||"").trim(),userId:order.userId,planKey:order.planKey,period:order.period});
            await orders.updateOne({_id:ref},{$set:{status:"active",lastPaidAt:new Date(),lastTxid:txid,lastPaymentMethod:String(d.meio||""),updatedAt:new Date()}});
            await deliveries.updateOne({_id:delivery},{$set:{processed:true,orderId:ref}});
          }catch(processError){await payments.deleteOne({_id:txid});await deliveries.deleteOne({_id:delivery});throw processError;}
        }else await deliveries.updateOne({_id:delivery},{$set:{processed:true,ignored:true,reason:order?"missing_txid_or_amount_mismatch":"order_not_found"}});
      }else await deliveries.updateOne({_id:delivery},{$set:{processed:true,ignored:true}});
      return sendJson(res,200,{ok:true});
    }catch(e){console.error("[Wyvi webhook]",e.stack||e.message||e);return sendJson(res,500,{detail:"Falha ao processar webhook."});}
  }
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (await nickColorsSystem.handleApi(req, res, url, { sendJson, readBody, authorizePanel, getSettingsCollection })) return;


  if (url.pathname === "/api/tickets/manage") {
    if (req.method === "GET") {
      try {
        const auth = String(req.headers.authorization || "");
        const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!accessToken) return sendJson(res, 401, { detail: "Entre com o Discord para ver os painéis publicados." });
        const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(10000) });
        const user = userResponse.ok ? await userResponse.json().catch(() => null) : null;
        if (!user?.id) return sendJson(res, 401, { detail: "Sua sessão do Discord expirou. Entre novamente." });
        const guildId = String(url.searchParams.get("guildId") || "");
        if (!/^\d{17,20}$/.test(guildId)) return sendJson(res, 400, { detail: "Servidor inválido." });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return sendJson(res, 404, { detail: "A Yukina não está conectada a esse servidor." });
        const requester = await guild.members.fetch(user.id).catch(() => null);
        if (!requester || (!requester.permissions.has(PermissionsBitField.Flags.ManageGuild) && !requester.permissions.has(PermissionsBitField.Flags.Administrator))) return sendJson(res, 403, { detail: "Você precisa de Gerenciar servidor ou Administrador." });
        const settingsCollection = await getSettingsCollection();
        const doc = await settingsCollection.findOne({ guildId });
        const panels = Array.isArray(doc?.settings?.ticketPanels) ? doc.settings.ticketPanels : [];
        return sendJson(res, 200, { ok: true, panels });
      } catch (error) {
        console.error("[Tickets] Falha ao carregar painéis:", error.stack || error.message || error);
        return sendJson(res, 500, { detail: "Não foi possível carregar os painéis salvos." });
      }
    }
    if (req.method !== "POST") return sendJson(res, 405, { detail: "Use GET para listar e POST para gerenciar painéis." });
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
  if (url.pathname === "/api/drop/config") {
    if (!["GET", "PUT"].includes(req.method)) return sendJson(res, 405, { detail: "Use GET ou PUT." });
    try {
      const auth = String(req.headers.authorization || "");
      const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!accessToken) return sendJson(res, 401, { detail: "Entre com o Discord para configurar seu Drop." });
      const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + accessToken }, signal: AbortSignal.timeout(10000) });
      const user = userResponse.ok ? await userResponse.json().catch(() => null) : null;
      if (!user?.id || !/^\d{17,20}$/.test(String(user.id))) return sendJson(res, 401, { detail: "Sua sessão expirou. Entre novamente com o Discord." });
      const subscription = await getActiveUserSubscription(user.id);
      const planKey = String(subscription?.planKey || "").toLowerCase();
      const planLimits = { starter: 1, plus: 1, premium: 2, ultra: 3, infinity: 5 };
      if (!subscription || !planLimits[planKey]) return sendJson(res, 403, { detail: "Você precisa de uma assinatura ativa para configurar o Drop Automático." });
      if (!MONGODB_URI) return sendJson(res, 503, { detail: "O banco de dados não está configurado." });
      settingsMongoClient = settingsMongoClient || new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      await settingsMongoClient.connect();
      const collection = settingsMongoClient.db(MONGODB_DB).collection("drop_auto_configs");
      await collection.createIndex({ userId: 1 }, { unique: true });
      if (req.method === "GET") {
        const config = await collection.findOne({ userId: String(user.id) });
        return sendJson(res, 200, {
          ok: true, plan: planKey, planName: planKey[0].toUpperCase() + planKey.slice(1),
          channelLimit: planLimits[planKey], expiresAt: subscription.expiresAt || null,
          config: config ? { guildId: config.guildId || "", channelIds: Array.isArray(config.channelIds) ? config.channelIds : [], enabled: Boolean(config.enabled), status: config.status || "" } : null
        });
      }
      const body = await readBody(req);
      const guildId = String(body.guildId || "");
      const channelIds = Array.isArray(body.channelIds) ? [...new Set(body.channelIds.map(String))] : [];
      if (!/^\d{17,20}$/.test(guildId) || !channelIds.length || channelIds.length > planLimits[planKey] || channelIds.some(id => !/^\d{17,20}$/.test(id))) {
        return sendJson(res, 400, { detail: "Selecione um servidor e de 1 até " + planLimits[planKey] + " canal(is) válido(s)." });
      }
      const authorized = await authorizePanel(req, guildId);
      if (String(authorized.user.id) !== String(user.id)) return sendJson(res, 403, { detail: "A conta autenticada não corresponde à configuração." });
      const guild = authorized.guild;
      const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
      if (!botMember) return sendJson(res, 503, { detail: "Não consegui validar as permissões da Yukina neste servidor." });
      const channels = [];
      for (const channelId of channelIds) {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.type !== ChannelType.GuildText) return sendJson(res, 400, { detail: "Todos os canais devem ser canais de texto válidos do servidor selecionado." });
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(PermissionsBitField.Flags.ViewChannel) || !permissions?.has(PermissionsBitField.Flags.SendMessages) || !permissions?.has(PermissionsBitField.Flags.EmbedLinks)) {
          return sendJson(res, 403, { detail: "A Yukina precisa de Ver canal, Enviar mensagens e Incorporar links em #" + channel.name + "." });
        }
        channels.push(channel);
      }
      const now = new Date();
      await collection.updateOne({ userId: String(user.id) }, {
        $set: {
          userId: String(user.id), planKey, status: "active", enabled: true,
          guildId: guild.id, guildName: guild.name, channelIds: channels.map(channel => channel.id),
          activatedAt: now, updatedAt: now, surface: "web-panel", pausedChannelIds: [], nextRunAtByChannel: {}
        },
        $setOnInsert: { createdAt: now }
      }, { upsert: true });
      try {
        const dropAuto = require("./components/buttons/drop-auto");
        await dropAuto.activateConfig(client, String(user.id));
      } catch (error) {
        console.error("[Drop painel] Configuração salva, mas o agendador não iniciou:", error.message || error);
        return sendJson(res, 200, { ok: true, scheduled: false, detail: "Configuração salva. A equipe precisará verificar o agendador." });
      }
      return sendJson(res, 200, { ok: true, scheduled: true, guild: { id: guild.id, name: guild.name }, channels: channels.map(channel => ({ id: channel.id, name: channel.name })) });
    } catch (error) {
      console.error("[Drop painel] Falha ao consultar/salvar configuração:", error.stack || error.message || error);
      return sendJson(res, error.status || 500, { detail: error.message || "Não foi possível processar a configuração do Drop." });
    }
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
  if (url.pathname === "/api/config/turnstile") {
    if (req.method !== "GET") return sendJson(res, 405, { ok: false, detail: "Use GET." });
    res.setHeader("Cache-Control", "no-store");
    return sendJson(res, 200, { ok: true, siteKey: String(process.env.TURNSTILE_SITE_KEY || "").trim() });
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
      const subscription = await getActiveUserSubscription(user.id, now);
      const multipliers = { starter: 1.1, plus: 1.2, premium: 1.35, ultra: 1.5, infinity: 1.75 };
      const planKey = String(subscription?.planKey || "").toLowerCase();
      const multiplier = subscription && multipliers[planKey] ? multipliers[planKey] : 1;
      const planName = subscription && multipliers[planKey] ? planKey[0].toUpperCase() + planKey.slice(1) : "Sem VIP";
      const symbols = ["🌸", "❄️", "🎰", "⛩️"];
      const slots = Array.from({ length: 4 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
      const counts = Object.values(slots.reduce((acc, symbol) => {
        acc[symbol] = (acc[symbol] || 0) + 1;
        return acc;
      }, {}));
      const matchCount = Math.max(...counts);
      const rewardRange = matchCount === 4 ? { min: 10000, max: 20000 }
        : matchCount === 3 ? { min: 5000, max: 15000 }
        : matchCount === 2 ? { min: 5000, max: 10000 }
        : { min: 1000, max: 5000 };
      const baseReward = Math.floor(Math.random() * (rewardRange.max - rewardRange.min + 1)) + rewardRange.min;
      const reward = Math.round(baseReward * multiplier);
      const combination = matchCount === 4 ? "4 símbolos iguais"
        : matchCount === 3 ? "3 símbolos iguais"
        : matchCount === 2 ? "2 símbolos iguais"
        : "4 símbolos diferentes";
      const feeResult = await applyDailyInactivityFee({ db: settingsMongoClient.db(MONGODB_DB), guildId, userId: String(user.id), now });
      const session = settingsMongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          await daily.insertOne({ guildId, userId: String(user.id), day, plan: planKey || null, multiplier, slots, combination, baseReward, reward, claimedAt: now }, { session });
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
      return sendJson(res, 200, { ok: true, claimed: true, day, plan: planName, multiplier, slots, combination, baseReward, reward, bankFee: feeResult.fee, bankFeeOverdueDays: feeResult.overdueDays, balanceUpdated: true, nextReset: getNextDailyReset(now) });
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
      // A assinatura é individual e não depende de um servidor específico.
      const subscription = await getActiveUserSubscription(user.id);
      const planMultipliers = {
        starter: { name: "Starter", multiplier: 1.1 },
        plus: { name: "Plus", multiplier: 1.2 },
        premium: { name: "Premium", multiplier: 1.35 },
        ultra: { name: "Ultra", multiplier: 1.5 },
        infinity: { name: "Infinity", multiplier: 1.75 }
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
      const auth=String(req.headers.authorization||""), token=auth.startsWith("Bearer ")?auth.slice(7).trim():"";
      if(!token)return sendJson(res,401,{detail:"Entre com o Discord antes de continuar."});
      const ur=await fetch("https://discord.com/api/users/@me",{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)});
      const user=ur.ok?await ur.json().catch(()=>null):null;
      if(!user||!/^\d{17,20}$/.test(String(user.id||"")))return sendJson(res,401,{detail:"Sua sessão do Discord expirou. Entre novamente."});
      const body=await readBody(req), planKey=String(body.plan||"").toLowerCase(),period=String(body.period||"").toLowerCase();
      const plans={starter:{name:"Starter",monthly:690,annual:6990},plus:{name:"Plus",monthly:1190,annual:11990},premium:{name:"Premium",monthly:1790,annual:17990},ultra:{name:"Ultra",monthly:2490,annual:24990},infinity:{name:"Infinity",monthly:3490,annual:34990}};
      if(!plans[planKey]||!["monthly","annual"].includes(period))return sendJson(res,400,{detail:"Plano ou período inválido."});
      if(body.recurringConsent!==true)return sendJson(res,400,{detail:"Confirme a autorização para cobranças recorrentes."});
      const key=String(process.env.WYVIPAY_API_KEY||"").trim(),guildId=String(process.env.VIP_GUILD_ID||"").trim();
      if(!key)return sendJson(res,503,{detail:"WYVIPAY_API_KEY não configurada no Render."});
      if(!/^\d{17,20}$/.test(guildId))return sendJson(res,503,{detail:"Servidor oficial VIP não configurado."});
      await getSettingsCollection();
      const db=settingsMongoClient.db(MONGODB_DB),orders=db.collection("vip_orders"),orderId=crypto.randomUUID(),amount=plans[planKey][period],now=new Date();
      await orders.insertOne({_id:orderId,userId:String(user.id),planKey,period,amountCents:amount,status:"pending_authorization",provider:"wyvipay",recurringConsent:true,consentAt:now,createdAt:now,updatedAt:now});
      const mr=await fetch("https://api.wyvipay.com.br/api/v1/subscriptions/metodos",{headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(15000)});
      const md=await mr.json().catch(()=>({}));
      if(!mr.ok){await orders.updateOne({_id:orderId},{$set:{status:"provider_error",updatedAt:new Date()}});return sendJson(res,mr.status===403?503:502,{detail:md.detail||md.message||"A chave Wyvi não possui permissão para consultar recorrências."});}
      // A Wyvi não processa recorrência de cartão com chave de teste (wy_test_).
      // Mesmo que o catálogo informe o cartão como disponível na conta, incluí-lo
      // no link de teste provoca 422. Em produção, a habilitação e o escopo do cartão
      // continuam sendo validados pela própria Wyvi.
      const isTestKey=/^wy_test_/i.test(key);
      const methods=(Array.isArray(md.metodos)?md.metodos:[]).filter(m=>
        m?.disponivel===true&&["pix","pix_automatico","cartao"].includes(m.meio)&&
        !(isTestKey&&m.meio==="cartao")&&
        (m.meio!=="pix_automatico"||amount>=Number(m.minimoCentavos||650))&&
        (m.meio!=="cartao"||amount>=Number(m.minimoCentavos||260))
      ).map(m=>m.meio);
      if(!methods.length){await orders.updateOne({_id:orderId},{$set:{status:"unavailable",updatedAt:new Date()}});return sendJson(res,503,{detail:"Nenhum meio recorrente está habilitado para esta conta Wyvi Pay. Verifique permissões e habilitações."});}
      const pr=await fetch("https://api.wyvipay.com.br/api/v1/recorrencia-links",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"yukina-vip-"+orderId},body:JSON.stringify({titulo:"Yukina VIP "+plans[planKey].name+(period==="annual"?" anual":" mensal"),valor_centavos:amount,frequencia:period==="annual"?"anual":"mensal",max_ciclos:null,meios:methods,primeira_cobranca:{modo:"no_aceite"},rota:"white",referencia:orderId}),signal:AbortSignal.timeout(20000)});
      const pd=await pr.json().catch(()=>({})),checkout=pd.checkout_url||pd.url||pd.link;
      if(!pr.ok||!checkout||!/^https:\/\//i.test(checkout)){await orders.updateOne({_id:orderId},{$set:{status:"provider_error",updatedAt:new Date()}});console.error("[VIP Wyvi] Link recorrente:",pr.status,pd);return sendJson(res,502,{detail:pd.detail||pd.message||"Falha ao criar link recorrente. Confira os escopos da chave."});}
      await orders.updateOne({_id:orderId},{$set:{status:"awaiting_authorization",providerLinkId:pd.id||pd.link_id||null,checkoutUrl:checkout,availableMethods:methods,updatedAt:new Date()}});
      return sendJson(res,201,{ok:true,orderId,checkoutUrl:checkout,methods,plan:plans[planKey].name,period,amountCents:amount});
    }catch(error){console.error("[VIP Wyvi] Erro:",error.stack||error.message||error);return sendJson(res,500,{detail:"Não foi possível iniciar a assinatura. Tente novamente."});}
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
        .map(role => ({ id: role.id, name: role.name, color: role.color, hexColor: role.hexColor, primaryColor: role.colors?.primaryColor ?? null, secondaryColor: role.colors?.secondaryColor ?? null, tertiaryColor: role.colors?.tertiaryColor ?? null, position: role.position }));
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
      if (Object.prototype.hasOwnProperty.call(clean, "staffPromotion")) {
        const config = clean.staffPromotion;
        if (!config || typeof config !== "object" || Array.isArray(config)) {
          return sendJson(res, 400, { detail: "A configuração de avisos de promoção é inválida." });
        }
        const roleIds = Array.isArray(config.roleIds) ? [...new Set(config.roleIds.map(String))] : [];
        const existingRoles = new Set(guild.roles.cache.filter(role => !role.managed).map(role => role.id));
        if (!roleIds.length || roleIds.some(id => !/^\d{17,20}$/.test(id) || !existingRoles.has(id))) {
          return sendJson(res, 400, { detail: "Selecione ao menos um cargo de promoção existente neste servidor." });
        }
        const channelId = String(config.channelId || "");
        const notificationRoleId = String(config.notificationRoleId || "");
        if (!/^\d{17,20}$/.test(channelId) || !/^\d{17,20}$/.test(notificationRoleId) || !existingRoles.has(notificationRoleId)) {
          return sendJson(res, 400, { detail: "Selecione um canal e um cargo de notificação válidos." });
        }
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased() || !channel.send) {
          return sendJson(res, 400, { detail: "O canal escolhido não aceita mensagens." });
        }
        clean.staffPromotion = { enabled: true, roleIds, channelId, notificationRoleId };
      }
      const updatedAt = new Date();
      const patch = { guildId, guildName: guild.name, updatedAt };
      for (const [key, value] of Object.entries(clean)) patch["settings." + key] = value;
      await collection.updateOne({ guildId }, { $set: patch }, { upsert: true });
      if (Object.prototype.hasOwnProperty.call(clean, "staffPromotion")) invalidateGuildSettings(guildId);
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