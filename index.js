require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
  Colors,
  EmbedBuilder,
} = require("discord.js");
const http = require("node:http");

const TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const AI_API_URL = (process.env.AI_API_URL || "https://openrouter.ai/api/v1/chat/completions").trim();
const AI_MODEL = (process.env.AI_MODEL || "meta-llama/llama-3.3-70b-instruct:free").trim();

if (!TOKEN) {
  console.error("Erro: defina DISCORD_TOKEN nas variáveis de ambiente.");
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
    .replace(/[^\\p{L}\\p{N}\\s-]/gu, "")
    .replace(/\\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "chat-geral";
  const pretty = base.replace(/-/g, "・");
  return [
    { label: `❄️・${base}`, name: `❄️・${base}` },
    { label: `🌙・${pretty}`, name: `🌙・${pretty}` },
    { label: `✧・${base}・✧`, name: `✧・${base}・✧` },
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
    const createdChannel = await guild.channels.create(options);
    results.push(`Canal ${kind} criado: ${name}`);

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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on("error", (error) => {
  console.error("Erro do cliente Discord:", error);
});

client.once("ready", () => {
  console.log(`Yukina conectada como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild || !client.user || !message.mentions.has(client.user)) return;

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
  if (!request) {
    await message.channel.send({ content: "Oi! Me marque e diga o que você quer montar. Exemplo: @Yukina crie um servidor gamer com categorias, canais de texto/voz e cargos coloridos.", allowedMentions: { repliedUser: false } });
    return;
  }

  try {
    await message.channel.sendTyping();
    const plan = await createPlan(request);
    const hasDeletes = plan.delete_roles.length || plan.delete_categories.length || plan.delete_channels.length;
    const hasCreates = plan.roles.length || plan.categories.length || plan.channels.length;
    let deleted = [];

    if (hasCreates && plan.channels.length) {
      const options = makeChannelNameOptions(plan.channels[0].name);
      const choiceText = [
        "**❄️ Yukina · escolha o nome do canal**",
        "Escolha uma opção respondendo apenas com **1**, **2** ou **3**. Ainda não vou criar nada.",
        ...options.map((option, index) => `${index + 1}. ${option.label}`),
        "",
        "Você tem 60 segundos. Responda **CANCELAR** para desistir.",
      ].join("\n");
      await message.channel.send({ content: choiceText, allowedMentions: { repliedUser: false } });
      const choice = await waitForExactReply(message.channel, message.author.id, message.guild.id, ["1", "2", "3", "CANCELAR"]);
      if (!choice || choice.content.trim().toUpperCase() === "CANCELAR") {
        await message.channel.send("⏱️ Criação cancelada. Nenhum canal, cargo ou categoria foi criado.");
        return;
      }
      plan.channels[0].name = options[Number(choice.content.trim()) - 1].name;
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
