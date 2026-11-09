"use strict";

const memory = require("./memory");
const { buildSystemPrompt } = require("./personality");
const relationships = require("./relationships");
const journal = require("./journal");
const autobiography = require("./autobiography");
const letters = require("./letters");
const stories = require("./stories");
const world = require("./world");
const residents = require("./residents");
const life = require("./life");
const moderation = require("./moderation");

const COOLDOWN_MS = 5000;
const MAX_INPUT_LENGTH = 2500;
const MAX_OUTPUT_LENGTH = 1900;
const cooldowns = new Map();

function sanitizeInput(value) {
  return String(value || "")
    .replace(/@everyone|@here/g, match => "@\u200b" + match.slice(1))
    .replace(/<@&?\d+>/g, "[menção]")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, MAX_INPUT_LENGTH);
}

function sanitizeOutput(value) {
  return String(value || "")
    .replace(/@everyone|@here/g, match => "@\u200b" + match.slice(1))
    .replace(/<@&?\d+>/g, "")
    .trim()
    .slice(0, MAX_OUTPUT_LENGTH);
}

function isForgetRequest(text) {
  return /\b(esquece|esqueça|esqueca|apague|apagar|não lembre|nao lembre)\b/i.test(text);
}

function isGreetingOnly(text) {
  const normalized = String(text || "").toLocaleLowerCase("pt-BR")
    .replace(/[\p{P}\p{S}\s🌸❄️🌙]+/gu, " ").trim();
  return new Set(["", "oi", "oie", "oii", "olá", "ola", "bom dia", "boa tarde", "boa noite", "hey", "hello", "e aí", "eai", "tudo bem", "yukina"]).has(normalized);
}

function checkCooldown(userId) {
  const now = Date.now();
  const last = cooldowns.get(String(userId)) || 0;
  const remaining = COOLDOWN_MS - (now - last);
  if (remaining > 0) return Math.ceil(remaining / 1000);
  cooldowns.set(String(userId), now);
  if (cooldowns.size > 5000) {
    for (const [id, time] of cooldowns) if (now - time > 60000) cooldowns.delete(id);
  }
  return 0;
}

async function requestOpenRouter(messages) {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("OPENROUTER_API_KEY não configurada.");
    error.code = "MISSING_API_KEY";
    throw error;
  }

  const model = String(process.env.YUKINA_OPENROUTER_MODEL || "openrouter/free").trim();
  let lastEmptyResponse = null;

  // Alguns modelos gratuitos podem aceitar a requisição e, ocasionalmente,
  // devolver uma escolha sem conteúdo. Fazemos uma única nova tentativa.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.YUKINA_SITE_URL || "https://yukina.onrender.com",
        "X-Title": "Yukina IA"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: attempt === 1 ? 0.85 : 0.7,
        max_tokens: 900
      }),
      signal: AbortSignal.timeout(45000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data.error?.message || data.message || "").slice(0, 300);
      const error = new Error("OpenRouter HTTP " + response.status + (detail ? ": " + detail : ""));
      error.code = "OPENROUTER_ERROR";
      error.status = response.status;
      error.requestId = response.headers.get("x-request-id") || data.id || null;
      throw error;
    }

    const choice = data.choices?.[0];
    const message = choice?.message || {};
    const result = message.content;
    const text = Array.isArray(result)
      ? result.map(part => typeof part === "string" ? part : part?.text || "").join("")
      : typeof result === "string" ? result : "";

    const cleaned = sanitizeOutput(text);
    if (cleaned) return cleaned;

    lastEmptyResponse = {
      requestId: response.headers.get("x-request-id") || data.id || null,
      finishReason: choice?.finish_reason || "unknown",
      model: data.model || model,
      hasRefusal: Boolean(message.refusal)
    };
    console.warn("[Yukina IA] OpenRouter retornou conteúdo vazio (tentativa " + attempt + "/2):", JSON.stringify(lastEmptyResponse));
  }

  const error = new Error("OpenRouter retornou resposta vazia após duas tentativas.");
  error.code = "EMPTY_RESPONSE";
  error.details = lastEmptyResponse;
  throw error;
}

function createEngine(getSettingsCollection) {
  let indexesReady = false;
  let indexPromise = null;

  async function getBaseCollection() {
    const collection = await getSettingsCollection();
    if (!indexesReady) {
      if (!indexPromise) indexPromise = Promise.all([memory.ensureIndexes(collection), relationships.ensureRelationshipIndexes(collection), journal.ensureIndexes(collection), autobiography.ensureIndexes(collection), letters.ensureIndexes(collection), stories.ensureIndexes(collection), world.ensureIndexes(collection), residents.ensureIndexes(collection), life.ensureIndexes(collection)]);
      await indexPromise;
      await autobiography.ensureOriginChapter(collection);
      await world.ensureWorld(collection);
      await residents.seedResidents(collection);
      const initialResidents = await collection.db.collection("yukina_ai_residents").find({ status: { $ne: "archived" } }).toArray();
      const initialWorld = await world.getWorldSnapshot(collection);
      await life.initialize(collection, initialWorld, initialResidents);
      indexesReady = true;
    }
    return collection;
  }

  async function answer({ userId, channelId, guildId, prompt, displayName = "membro", discordContext = null }) {
    const rawPrompt = String(prompt || "").trim();
    const safePrompt = sanitizeInput(rawPrompt);
    if (!String(userId || "").trim() || !String(channelId || "").trim()) {
      return { ok: false, text: "🌸 Não consegui identificar esta conversa. Tente novamente em um canal do servidor." };
    }
    if (!safePrompt) return { ok: false, text: "「えへへ」 Pode me contar o que você gostaria de conversar?" };

    const wait = checkCooldown(userId);
    if (wait) return { ok: false, cooldown: true, text: "🌸 Só um instantinho! Tente novamente em " + wait + " segundo(s)." };

    try {
      const moderationResult = await moderation.handleRequest({ prompt: rawPrompt, context: discordContext });
      if (moderationResult.handled) return { ok: true, text: moderationResult.text };

      const collection = await getBaseCollection();

      if (isForgetRequest(safePrompt)) {
        const result = await memory.forgetMemories(collection, userId, safePrompt);
        return {
          ok: true,
          forgotten: true,
          text: result.all
            ? "🌸 Tudo bem. Apaguei as memórias pessoais que estavam guardadas sobre você e o histórico das nossas conversas. Podemos começar de novo. 「ふふっ」"
            : "🌸 Tudo bem. Fiz o possível para remover da minha memória aquilo que você pediu. Se quiser, pode me explicar qual lembrança específica deseja que eu esqueça."
        };
      }

      await memory.captureSafeMemory(collection, userId, safePrompt);
      const worldSnapshot = await world.getWorldSnapshot(collection);
      await residents.simulateResidentNeeds(collection, worldSnapshot);
      await residents.simulateCurrentSlot(collection, worldSnapshot);
      await life.updateAges(collection, worldSnapshot);
      const [memories, history, relationship, chapters, dueLetters, worldEvents, residentsContext, residentEvents, lifeContext] = await Promise.all([
        memory.getMemories(collection, userId),
        memory.getThread(collection, userId, channelId),
        relationships.registerInteraction(collection, userId, safePrompt),
        autobiography.getChapters(collection),
        letters.getDueFutureLetters(collection),
        world.listWorldEvents(collection, { limit: 5 }),
        residents.getResidentsContext(collection),
        residents.getRecentResidentEvents(collection, { limit: 8 }),
        life.buildLifeContext(collection, worldSnapshot)
      ]);

      const messages = [
        { role: "system", content: buildSystemPrompt({ memories, userId, displayName }) + "\n\n" + relationships.buildRelationshipContext(relationship) + "\n\n" + autobiography.buildAutobiographyContext(chapters) + "\n\n" + letters.buildFutureLettersContext(dueLetters) + "\n\n" + world.buildWorldContext(worldSnapshot, worldEvents) + "\n\n" + residentsContext + "\n\n" + residents.buildResidentEventsContext(residentEvents) + "\n\n" + lifeContext },
        ...history.map(item => ({ role: item.role, content: item.content })),
        { role: "user", content: safePrompt }
      ];
      const reply = await requestOpenRouter(messages);
      for (const letter of dueLetters) await letters.markFutureLetterOpened(collection, letter.letterId);

      await journal.recordConversation(collection, { guildId, userId, displayName }).catch(error => {
        console.error("[Yukina IA] Não foi possível registrar o diário:", error.message || error);
      });
      await memory.appendThread(collection, userId, channelId, [
        { role: "user", content: safePrompt, displayName: String(displayName).slice(0, 80), createdAt: new Date() },
        { role: "assistant", content: reply, createdAt: new Date() }
      ]);

      return { ok: true, text: reply };
    } catch (error) {
      console.error("[Yukina IA] Falha ao responder:", error.code || error.message, error.details ? JSON.stringify(error.details) : "");
      if (error.code === "MISSING_API_KEY") {
        return { ok: false, text: "🌙 Ainda estou sendo preparada. A chave OPENROUTER_API_KEY precisa ser configurada no ambiente do bot." };
      }
      return { ok: false, text: "🌸 Tive um probleminha ao organizar meus pensamentos. Tente novamente daqui a pouquinho." };
    }
  }

  const features = {
    async createFutureLetter(data) { return letters.createFutureLetter(await getBaseCollection(), data); },
    async createPrivateLetter(data) { return letters.createPrivateLetter(await getBaseCollection(), data); },
    async getPrivateLetters(userId, options) { return letters.getPrivateLettersForRecipient(await getBaseCollection(), userId, options); },
    async listStories(options) { return stories.listStories(await getBaseCollection(), options); },
    async getStory(storyId) { return stories.getStory(await getBaseCollection(), storyId); },
    async createStory(data) { return stories.createStory(await getBaseCollection(), data); },
    async publishStory(storyId, channelId) { return stories.setStoryStatus(await getBaseCollection(), storyId, "published", { channelId }); },
    async castStoryVote(data) { return stories.castVote(await getBaseCollection(), data); },
    async getStoryResults(storyId) { return stories.getVoteResults(await getBaseCollection(), storyId); },
    async getChapters(options) { return autobiography.getChapters(await getBaseCollection(), options); },
    async getDiary(scope, ownerId, limit = 14) {
      const collection = await getBaseCollection();
      return collection.db.collection("yukina_ai_diary").find(
        { scope, ownerId: String(ownerId) }, { projection: { _id: 0 } }
      ).sort({ day: -1 }).limit(Math.max(1, Math.min(Number(limit) || 14, 60))).toArray();
    },
    async getWorld() {
      const collection = await getBaseCollection();
      const snapshot = await world.getWorldSnapshot(collection);
      const residentsList = await residents.listResidents(collection, { limit: 20 });
      const events = await residents.getRecentResidentEvents(collection, { limit: 12 });
      const buildings = await collection.db.collection("yukina_ai_buildings").find({}, { projection: { _id: 0 } }).toArray();
      const quests = await collection.db.collection("yukina_ai_quests").find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(10).toArray();
      const festivals = await collection.db.collection("yukina_ai_festivals").find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(5).toArray();
      const magic = await collection.db.collection("yukina_ai_magic").find({}, { projection: { _id: 0 } }).limit(10).toArray();
      return { snapshot, residents: residentsList, events, buildings, quests, festivals, magic };
    },
    async getWeeklyReport(guildId) {
      const collection = await getBaseCollection();
      const since = new Date(Date.now() - 7 * 86400000);
      const diary = await collection.db.collection("yukina_ai_diary").findOne(
        { scope: "server", ownerId: String(guildId), day: { $gte: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(since) } }
      );
      const entries = await collection.db.collection("yukina_ai_diary").find(
        { scope: "server", ownerId: String(guildId), createdAt: { $gte: since } },
        { projection: { _id: 0, day: 1, conversations: 1, participants: 1 } }
      ).sort({ day: -1 }).limit(7).toArray();
      return {
        days: entries.length,
        conversations: entries.reduce((sum, item) => sum + (Number(item.conversations) || 0), 0),
        participants: new Set(entries.flatMap(item => item.participants || [])).size,
        since
      };
    },
    async processWorldCycle() {
      const collection = await getBaseCollection();
      const snapshot = await world.advanceWorld(collection);
      await residents.simulateResidentNeeds(collection, snapshot);
      await residents.simulateCurrentSlot(collection, snapshot);
      await life.updateAges(collection, snapshot);
      const due = await letters.getDueFutureLetters(collection, { limit: 20 });
      if (due.length) {
        const events = collection.db.collection("yukina_ai_life_events");
        for (const letter of due) {
          await events.updateOne(
            { eventId: "future-letter-opened:" + letter.letterId },
            { $setOnInsert: {
              eventId: "future-letter-opened:" + letter.letterId,
              kind: "letter",
              summary: "Uma carta para o eu do futuro chegou à data de releitura: " + letter.letterId + ".",
              createdAt: new Date()
            } },
            { upsert: true }
          );
        }
      }
      return { snapshot, dueLetters: due.length };
    }
  };

  return { answer, features };
}

module.exports = { createEngine, isGreetingOnly, sanitizeInput };
