require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
  Colors,
} = require("discord.js");
const http = require("node:http");

const TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const AI_API_URL = (process.env.AI_API_URL || "https://openrouter.ai/api/v1/chat/completions").trim();
const AI_MODEL = (process.env.AI_MODEL || "meta-llama/llama-3.3-70b-instruct:free").trim();

if (!TOKEN) {
  console.error("Erro: defina DISCORD_TOKEN nas variáveis de ambiente.");
  process.exit(1);
}

const SYSTEM_PROMPT = `Você é a planejadora de servidores Discord da Yukina. Converta o pedido em um plano JSON válido, sem Markdown, com esta estrutura:
{
 "style_tips": ["dica de estilo"],
 "roles": [{"name":"Nome","color":"#5865F2","hoist":false,"mentionable":false}],
 "categories": [{"name":"Nome"}],
 "channels": [{"name":"nome-do-canal","type":"text|voice|forum|stage","category":"Nome exato da categoria ou null","topic":"descrição curta"}]
}
Crie apenas o que foi pedido e complemente com sugestões úteis. Nomes de canais em minúsculas com hífens são preferíveis. Cores devem ser HEX. Não inclua permissões administrativas nos cargos; a aplicação usará permissões seguras padrão. Limites: até 12 cargos, 12 categorias e 30 canais. Para categorias/canais, mantenha nomes únicos e coerentes. Responda SOMENTE com JSON válido.`;

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
    throw new Error("Chave da API ausente. No Render, configure AI_API_KEY ou OPENROUTER_API_KEY com sua chave real do OpenRouter.");
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
  for (const key of ["roles", "categories", "channels", "style_tips"]) {
    if (!Array.isArray(plan[key])) plan[key] = [];
  }
  plan.roles = plan.roles.slice(0, 12);
  plan.categories = plan.categories.slice(0, 12);
  plan.channels = plan.channels.slice(0, 30);
  plan.style_tips = plan.style_tips.slice(0, 6).map((x) => String(x).slice(0, 250));
  return plan;
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
    await guild.channels.create(options);
    results.push(`Canal ${kind} criado: ${name}`);
  }
  return results;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log(`Yukina conectada como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild || !client.user || !message.mentions.has(client.user)) return;

  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
      !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply({ content: "Para montar canais, categorias e cargos, você precisa ter **Gerenciar servidor** ou **Administrador**.", allowedMentions: { repliedUser: false } });
    return;
  }

  const me = message.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await message.reply({ content: "Preciso das permissões **Gerenciar canais** e **Gerenciar cargos**. Confira também se meu cargo está acima dos cargos que devo criar.", allowedMentions: { repliedUser: false } });
    return;
  }

  const request = message.content
    .replace(new RegExp(`<@!?\${client.user.id}>`, "g"), "")
    .trim();
  if (!request) {
    await message.reply({ content: "Oi! Me marque e diga o que você quer montar. Exemplo: @Yukina crie um servidor gamer com categorias, canais de texto/voz e cargos coloridos.", allowedMentions: { repliedUser: false } });
    return;
  }

  try {
    await message.channel.sendTyping();
    const plan = await createPlan(request);
    await message.reply({ content: formatPlan(plan) + "\n\nVou criar essa estrutura agora. Não vou apagar nem alterar canais ou cargos existentes.", allowedMentions: { repliedUser: false } });
    const created = await buildServer(message.guild, plan);
    const summary = created.length ? created.slice(0, 35).map((line) => `• ${line}`).join("\n") : "Nenhum item novo foi necessário; os itens já existiam ou o plano veio vazio.";
    await message.channel.send({ content: `**Yukina concluiu!**\n${summary}`.slice(0, 1900) });
  } catch (error) {
    console.error("Erro no construtor de servidor IA:", error);
    await message.reply({ content: `Não consegui concluir a montagem: ${String(error.message || error).slice(0, 700)}`, allowedMentions: { repliedUser: false } });
  }
});

const port = Number(process.env.PORT || 10000);
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/api/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, service: "Yukina Bot" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(port, "0.0.0.0", () => console.log(`Health endpoint ativo na porta ${port}`));

client.login(TOKEN).catch((error) => {
  console.error("Falha ao conectar a Yukina:", error);
  process.exit(1);
});
