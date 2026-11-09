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

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.YUKINA_SITE_URL || "https://yukina.onrender.com",
      "X-Title": "Yukina IA"
    },
    body: JSON.stringify({
      model: process.env.YUKINA_OPENROUTER_MODEL || "openrouter/free",
      messages,
      temperature: 0.85,
      max_tokens: 700
    }),
    signal: AbortSignal.timeout(30000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("OpenRouter retornou HTTP " + response.status + ".");
    error.code = "OPENROUTER_ERROR";
    error.status = response.status;
    throw error;
  }

  const result = data.choices?.[0]?.message?.content;
  const text = Array.isArray(result)
    ? result.map(part => typeof part === "string" ? part : part?.text || "").join("")
    : result;
  if (typeof text !== "string" || !text.trim()) {
    const error = new Error("O modelo não retornou uma resposta.");
    error.code = "EMPTY_RESPONSE";
    throw error;
  }
  return sanitizeOutput(text);
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

      await journal.recordConversation(collection, { guildId, userId, displayName }).catch(error => {
        console.error("[Yukina IA] Não foi possível registrar o diário:", error.message || error);
      });
      await memory.appendThread(collection, userId, channelId, [
        { role: "user", content: safePrompt, displayName: String(displayName).slice(0, 80), createdAt: new Date() },
        { role: "assistant", content: reply, createdAt: new Date() }
      ]);

      return { ok: true, text: reply };
    } catch (error) {
      console.error("[Yukina IA] Falha ao responder:", error.code || error.message);
      if (error.code === "MISSING_API_KEY") {
        return { ok: false, text: "🌙 Ainda estou sendo preparada. A chave OPENROUTER_API_KEY precisa ser configurada no ambiente do bot." };
      }
      return { ok: false, text: "🌸 Tive um probleminha ao organizar meus pensamentos. Tente novamente daqui a pouquinho." };
    }
  }

  return { answer };
}

module.exports = { createEngine, isGreetingOnly, sanitizeInput };
