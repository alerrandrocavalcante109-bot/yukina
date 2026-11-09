"use strict";
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const { getFeatures } = require("../systems/yukina-ai");
const CREATOR = "1533034328928555141";
const MOTHER = "353909640381333504";
const family = id => [CREATOR, MOTHER].includes(String(id));
const safe = value => String(value || "").replace(/@everyone|@here/g, "").trim();
const slug = value => safe(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 32);

function storyPayload(story) {
  const embed = new EmbedBuilder().setColor(0xD98AB5).setTitle("🌸 " + story.title)
    .setDescription((story.content || story.summary || "").slice(0, 4000))
    .setFooter({ text: "Yukina • Escolha um caminho para influenciar a história" });
  const rows = [];
  for (let i = 0; i < story.choices.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(story.choices.slice(i, i + 5).map(choice =>
      new ButtonBuilder().setCustomId("ykstory:vote:" + story.storyId + ":" + choice.id)
        .setLabel(choice.label.slice(0, 80)).setStyle(ButtonStyle.Secondary))));
  }
  return { embeds: [embed], components: rows };
}

async function run(action, ctx) {
  const f = getFeatures();
  const id = ctx.user.id;
  const reply = (content, ephemeral = true) => ctx.reply({ content, ephemeral });
  if (action === "status" || action === "mundo") {
    const data = await f.getWorld();
    const s = data.snapshot;
    if (!s) return reply("🌙 O mundo ainda está sendo inicializado.");
    const residents = data.residents.map(r => "• " + r.name + " — " + r.role).join("\n");
    const buildings = data.buildings.map(b => "• " + b.name + " (nível " + b.level + ")").join("\n") || "Nenhuma construção registrada.";
    const quests = data.quests.map(q => "• " + (q.title || q.name || q.questId) + " — " + (q.status || "disponível")).join("\n") || "Nenhuma missão registrada.";
    const festivals = data.festivals.map(x => "• " + (x.name || x.title || x.festivalId) + " — " + (x.status || "planejado")).join("\n") || "Nenhum festival registrado.";
    const magic = data.magic.map(x => "• " + (x.name || x.magicId || x.type) + " — " + (x.status || "registrado")).join("\n") || "Nenhum registro mágico.";
    return reply("🌸 **Santuário Mágico das Cerejeiras**\nDia " + s.dayNumber + " • " + s.timeOfDay + "\n" + s.season.name + " • " + s.weather.name + "\nLocal: " + s.currentLocation.name + "\n\n**Moradores**\n" + residents + "\n\n**Construções**\n" + buildings + "\n\n**Missões**\n" + quests + "\n\n**Festivais**\n" + festivals + "\n\n**Magia**\n" + magic);
  }
  if (action === "autobiografia") {
    const chapters = await f.getChapters({ limit: 10 });
    return reply(chapters.length ? chapters.map((c, i) => "**" + (c.number || i + 1) + ". " + c.title + "**\n" + c.content).join("\n\n").slice(0, 1900) : "Ainda não há capítulos registrados.");
  }
  if (action === "diario") {
    if (!family(id)) return reply("🔒 Os diários internos são reservados ao Criador e à mãe.");
    const personal = await f.getDiary("personal", "yukina", 7);
    const server = ctx.guildId ? await f.getDiary("server", ctx.guildId, 7) : [];
    const lines = ["📖 **Diário da Yukina**", ...personal.map(x => x.day + " • " + x.conversations + " conversas")];
    if (server.length) lines.push("", "**Diário desta comunidade**", ...server.map(x => x.day + " • " + x.conversations + " conversas • " + (x.participants || []).length + " participantes"));
    return reply(lines.join("\n").slice(0, 1900));
  }
  if (action === "relatorio") {
    if (!family(id) && !ctx.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return reply("Você precisa de Gerenciar Servidor para consultar o relatório.");
    const r = await f.getWeeklyReport(ctx.guildId);
    return reply("📊 **Relatório dos últimos sete dias**\nDias com registro: " + r.days + "\nConversas: " + r.conversations + "\nParticipantes únicos: " + r.participants + "\n\nSomente contagens agregadas; nenhum conteúdo de mensagem é incluído.");
  }
  if (action === "carta-futuro") {
    if (!family(id)) return reply("🌙 Recurso reservado ao Criador e à mãe.");
    const date = ctx.options.getString("data");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply("Use a data AAAA-MM-DD.");
    const openAt = new Date(date + "T12:00:00-03:00");
    await f.createFutureLetter({ letterId: "future-" + id + "-" + Date.now().toString(36), content: safe(ctx.options.getString("conteudo")), openAt, createdBy: id, source: "creator_authored" });
    return reply("💌 Carta guardada para releitura em " + date + " (horário de Brasília).");
  }
  if (action === "carta-privada") {
    if (!family(id)) return reply("🔒 Somente o Criador e a mãe podem escrever cartas privadas.");
    const recipient = ctx.options.getString("destinatario") === "mae" ? MOTHER : CREATOR;
    await f.createPrivateLetter({ letterId: "private-" + id + "-" + Date.now().toString(36), content: safe(ctx.options.getString("conteudo")), recipientId: recipient, createdBy: id, source: "creator_authored" });
    return reply("🔐 Carta guardada no cofre privado do destinatário.");
  }
  if (action === "cartas-inbox") {
    if (!family(id)) return reply("🔒 Você não tem acesso às cartas privadas.");
    const items = await f.getPrivateLetters(id, { limit: 10 });
    return reply(items.length ? items.map((x, i) => "**Carta " + (i + 1) + "**\n" + x.content).join("\n\n").slice(0, 1900) : "💌 Seu cofre está vazio.");
  }
  if (action === "historia-criar") {
    if (!family(id)) return reply("Somente o Criador e a mãe podem registrar histórias oficiais.");
    const title = safe(ctx.options.getString("titulo"));
    const content = safe(ctx.options.getString("texto"));
    const choices = safe(ctx.options.getString("escolhas")).split("|").map((x, i) => ({ id: "opcao-" + (i + 1), label: safe(x.split(":")[0]) })).filter(x => x.label);
    if (choices.length < 2 || choices.length > 5) return reply("Informe de 2 a 5 escolhas separadas por |. Exemplo: Investigar | Esperar.");
    const storyId = slug(title) + "-" + Date.now().toString(36);
    await f.createStory({ storyId, title, summary: content.slice(0, 400), content, choices, source: "creator_authored", createdBy: id, guildId: ctx.guildId });
    return reply("📚 História criada como rascunho. ID: " + storyId);
  }
  if (action === "historias") {
    const list = await f.listStories({ status: "published", limit: 10, guildId: ctx.guildId });
    return reply(list.length ? list.map(x => "• " + x.title + " — ID: " + x.storyId).join("\n") : "Ainda não há histórias publicadas.");
  }
  if (action === "historia-publicar") {
    if (!family(id) && !ctx.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return reply("Você precisa de Gerenciar Servidor para publicar.");
    const storyId = safe(ctx.options.getString("id"));
    const story = await f.getStory(storyId);
    if (!story) return reply("Não encontrei esse rascunho.");
    await f.publishStory(storyId, ctx.channelId);
    const updated = await f.getStory(storyId);
    const payload = storyPayload(updated);
    return ctx.reply({ content: "🌸 **Uma nova história da Yukina começou!**", embeds: payload.embeds, components: payload.components });
  }
  if (action === "historia-resultados") {
    const result = await f.getStoryResults(safe(ctx.options.getString("id")));
    return reply(result ? result.choices.map(x => "• " + x.label + ": " + x.votes + " voto(s)").join("\n") : "Não encontrei essa história.");
  }
  return reply("Comando desconhecido.");
}

const data = new SlashCommandBuilder().setName("yukina").setDescription("Acesse os sistemas narrativos da Yukina.")
  .addSubcommand(s => s.setName("status").setDescription("Veja o estado atual do santuário."))
  .addSubcommand(s => s.setName("mundo").setDescription("Consulte moradores e construções."))
  .addSubcommand(s => s.setName("autobiografia").setDescription("Leia os capítulos da Yukina."))
  .addSubcommand(s => s.setName("diario").setDescription("Consulte os diários privados da Yukina."))
  .addSubcommand(s => s.setName("relatorio").setDescription("Relatório agregado dos últimos sete dias."))
  .addSubcommand(s => s.setName("carta-futuro").setDescription("Guarde uma carta para o futuro.")
    .addStringOption(o => o.setName("data").setDescription("Data AAAA-MM-DD").setRequired(true))
    .addStringOption(o => o.setName("conteudo").setDescription("Texto da carta").setRequired(true).setMaxLength(1800)))
  .addSubcommand(s => s.setName("carta-privada").setDescription("Escreva uma carta privada.")
    .addStringOption(o => o.setName("destinatario").setDescription("Destinatário").setRequired(true).addChoices({ name: "Criador", value: "criador" }, { name: "Mamãe", value: "mae" }))
    .addStringOption(o => o.setName("conteudo").setDescription("Texto da carta").setRequired(true).setMaxLength(1800)))
  .addSubcommand(s => s.setName("cartas-inbox").setDescription("Abra seu cofre de cartas privadas."))
  .addSubcommand(s => s.setName("historia-criar").setDescription("Crie uma história interativa.")
    .addStringOption(o => o.setName("titulo").setDescription("Título").setRequired(true).setMaxLength(120))
    .addStringOption(o => o.setName("texto").setDescription("Texto da história").setRequired(true).setMaxLength(3500))
    .addStringOption(o => o.setName("escolhas").setDescription("Opções separadas por |").setRequired(true).setMaxLength(400)))
  .addSubcommand(s => s.setName("historias").setDescription("Liste histórias publicadas."))
  .addSubcommand(s => s.setName("historia-publicar").setDescription("Publique um rascunho.")
    .addStringOption(o => o.setName("id").setDescription("ID da história").setRequired(true)))
  .addSubcommand(s => s.setName("historia-resultados").setDescription("Veja os resultados de votação.")
    .addStringOption(o => o.setName("id").setDescription("ID da história").setRequired(true)));

module.exports = {
  data, aliases: ["yk", "mundo-yukina"],
  async execute(interaction) { return run(interaction.options.getSubcommand(), interaction); },
  async prefixExecute(message, args) {
    const action = String(args[0] || "status").toLowerCase();
    const rest = args.slice(1);
    const values = {};
    if (action === "carta-futuro") {
      values.data = rest.shift();
      values.conteudo = rest.join(" ");
    } else if (action === "carta-privada") {
      values.destinatario = rest.shift();
      values.conteudo = rest.join(" ");
    } else if (action === "historia-criar") {
      const raw = rest.join(" ").split("|");
      values.titulo = raw[0];
      values.texto = raw[1];
      values.escolhas = raw.slice(2).join("|");
    } else if (["historia-publicar", "historia-resultados"].includes(action)) {
      values.id = rest[0];
    }
    const supported = new Set(["status", "mundo", "autobiografia", "diario", "relatorio", "cartas-inbox", "historias", "carta-futuro", "carta-privada", "historia-criar", "historia-publicar", "historia-resultados"]);
    if (!supported.has(action)) return message.reply("Use Yyukina status, mundo, autobiografia, diario, relatorio, carta-futuro, carta-privada, cartas-inbox, historia-criar, historias, historia-publicar ou historia-resultados.");
    const ctx = {
      user: message.author, guildId: message.guild.id, channelId: message.channel.id,
      memberPermissions: message.member.permissions,
      options: { getString: name => values[name] || null },
      reply: payload => message.reply(payload)
    };
    return run(action, ctx);
  },
  async handleInteraction(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith("ykstory:vote:")) return;
    const [, , storyId, choiceId] = interaction.customId.split(":");
    const result = await getFeatures().castStoryVote({ storyId, choiceId, userId: interaction.user.id });
    if (result.alreadyVoted) return interaction.reply({ content: "🌸 Você já votou nesta história. Cada pessoa vota uma única vez.", ephemeral: true });
    return interaction.reply({ content: "🌸 Seu voto foi registrado! Obrigada por participar.", ephemeral: true });
  }
};
