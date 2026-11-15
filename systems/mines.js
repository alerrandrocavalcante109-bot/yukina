"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require("discord.js");
const { MongoClient } = require("mongodb");
const { randomUUID, randomInt } = require("node:crypto");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
const BOARD_SIZE = 20;
const MIN_BET = 100;
const MAX_BET = 10_000_000;
const MIN_BOMBS = 1;
const MAX_BOMBS = 16;
const EXPIRATION_MS = 5 * 60 * 1000;
const COLOR = 0xA7D8F0;

let mongoClient;
let dbPromise;
const expiryTimers = new Map();
const gameLocks = new Set();

async function getDb() {
  if (dbPromise) return dbPromise;
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  dbPromise = (async () => {
    mongoClient = mongoClient || new MongoClient(MONGODB_URI, {
      appName: "Yukina-Mines",
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DB);
    await Promise.all([
      db.collection("mines_games").createIndex(
        { userId: 1 },
        { unique: true, partialFilterExpression: { status: "active" }, name: "mines_one_active_game_per_user" }
      ),
      db.collection("mines_games").createIndex({ status: 1, expiresAt: 1 }, { name: "mines_active_expiration" }),
      db.collection("mines_games").createIndex({ gameNumber: 1 }, { unique: true, name: "mines_unique_game_number" }),
      db.collection("mines_counters").createIndex({ _id: 1 }, { unique: true }),
      db.collection("mines_ledger").createIndex({ gameId: 1, type: 1 }, { unique: true, name: "mines_unique_game_transaction" }),
      db.collection("mines_ledger").createIndex({ userId: 1, createdAt: -1 }),
    ]);
    return db;
  })().catch(error => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function parseBet(input) {
  let raw = String(input ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return null;

  const suffix = raw.match(/^(\d+(?:[.,]\d+)?)([km])$/);
  let amount;
  if (suffix) {
    const base = Number(suffix[1].replace(",", "."));
    amount = base * (suffix[2] === "k" ? 1_000 : 1_000_000);
  } else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) {
    amount = Number(raw.replace(/[.,]/g, ""));
  } else if (/^\d+(?:[.,]\d+)?$/.test(raw)) {
    amount = Number(raw.replace(",", "."));
  } else {
    return null;
  }

  if (!Number.isSafeInteger(amount) || amount < MIN_BET || amount > MAX_BET) return null;
  return amount;
}

function format(value) {
  return Math.floor(Number(value) || 0).toLocaleString("pt-BR");
}

function multiplierFor(bombs, safeOpened) {
  if (safeOpened <= 0) return 1;
  let result = 1;
  for (let i = 0; i < safeOpened; i++) {
    result *= (BOARD_SIZE - i) / (BOARD_SIZE - bombs - i);
  }
  return result;
}

function payoutFor(bet, multiplier) {
  return Math.floor(Number(bet) * Number(multiplier));
}

function makeBombPositions(bombs) {
  const cells = Array.from({ length: BOARD_SIZE }, (_, index) => index);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, bombs).sort((a, b) => a - b);
}

function buildCellRows(game, disabled = false) {
  const opened = new Set(game.openedCells || []);
  const bombs = new Set(game.bombPositions || []);
  const rows = [];
  for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
    const row = new ActionRowBuilder();
    for (let column = 0; column < 5; column++) {
      const cell = rowIndex * 5 + column;
      const isOpen = opened.has(cell);
      const isBomb = bombs.has(cell);
      const button = new ButtonBuilder()
        .setCustomId("mines:cell:" + game._id + ":" + cell)
        .setLabel(String(cell + 1))
        .setDisabled(disabled || isOpen || (game.status === "lost" && !isBomb && !isOpen))
        .setStyle(isOpen ? ButtonStyle.Success : (game.status === "lost" && isBomb ? ButtonStyle.Danger : ButtonStyle.Secondary))
        .setEmoji(isOpen ? "💎" : (game.status === "lost" && isBomb ? "💣" : "🔹"));
      row.addComponents(button);
    }
    rows.push(row);
  }
  return rows;
}

function buildGameContainer(game) {
  const safeTotal = BOARD_SIZE - game.bombs;
  const openedCount = (game.openedCells || []).length;
  const currentMultiplier = openedCount ? Number(game.currentMultiplier) : 1;
  const currentPayout = openedCount ? Number(game.currentPayout) : game.bet;
  const nextMultiplier = openedCount < safeTotal ? multiplierFor(game.bombs, openedCount + 1) : null;
  const nextPayout = nextMultiplier === null ? null : payoutFor(game.bet, nextMultiplier);
  const nextText = nextMultiplier === null
    ? "Próximo multiplicador: **não há mais casas seguras**"
    : "Próximo multiplicador: **" + nextMultiplier.toFixed(2) + "x** (+" + format(Math.max(0, nextPayout - currentPayout)) + " KZ)";
  const body = [
    "# 💎 MINAS",
    "💣 Bombas: **" + game.bombs + "** / **" + safeTotal + " casas seguras**",
    "",
    "Multiplicador atual: **" + currentMultiplier.toFixed(2) + "x**",
    nextText,
    "Aposta: **" + format(game.bet) + " KZ**",
    openedCount ? "Valor disponível para saque: **" + format(currentPayout) + " KZ**" : "",
    "",
    "Você está indo bem, continue para ganhar um valor mais alto. Mas lembre-se, não seja ganancioso, senão você vai perder tudo.",
    "",
    "**Partida #" + game.gameNumber + "**",
  ].filter(Boolean).join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(COLOR)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

  for (const row of buildCellRows(game)) container.addActionRowComponents(row);

  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mines:random:" + game._id)
      .setLabel("Aleatório")
      .setEmoji("🎲")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(game.status !== "active" || openedCount >= safeTotal),
    new ButtonBuilder()
      .setCustomId("mines:refresh:" + game._id)
      .setLabel("Atualizar")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(game.status !== "active"),
    ...(openedCount > 0 ? [
      new ButtonBuilder()
        .setCustomId("mines:cashout:" + game._id)
        .setLabel("Sacar " + format(currentPayout) + " KZ")
        .setEmoji("💰")
        .setStyle(ButtonStyle.Success)
        .setDisabled(game.status !== "active")
    ] : [])
  );
  container.addActionRowComponents(actions);
  return container;
}

function buildFinalContainer(game, kind) {
  let text;
  if (kind === "lost") {
    text = "## 💥 Você perdeu!\nVocê perdeu, o universo não quis te ajudar em sua jornada nas cavernas de Kizunas, sendo assim, você perdeu **" + format(game.bet) + " KZ**.";
  } else if (kind === "expired") {
    text = "## ⏳ Partida expirada\nA partida de número **#" + game.gameNumber + "** acabou ou expirou, mas não se preocupe, você irá receber o seu ganho de **" + format(game.currentPayout) + " KZ**.";
  } else if (kind === "cancelled") {
    text = "## ⚠️ Partida cancelada\nNão foi possível abrir o tabuleiro. Sua aposta de **" + format(game.bet) + " KZ** foi devolvida.";
  } else {
    const profit = Math.max(0, Number(game.currentPayout) - Number(game.bet));
    text = "## 🏆 Você venceu!\nVocê acaba de sair das cavernas de Kizunas sem encontrar uma bomba, que feito emocionante, e você sai com (**" + format(game.currentPayout) + " KZ** com um lucro de **" + format(profit) + " KZ**).";
  }
  return new ContainerBuilder()
    .setAccentColor(kind === "lost" ? 0xE8A0A0 : 0xA7D8F0)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text + "\n\n**Partida #" + game.gameNumber + "**"));
}

async function editGameMessage(client, game, container) {
  if (!game.channelId || !game.messageId) return false;
  try {
    const channel = await client.channels.fetch(game.channelId);
    if (!channel?.isTextBased()) return false;
    const message = await channel.messages.fetch(game.messageId);
    await message.edit({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    return true;
  } catch (error) {
    console.warn("[Mines] Não foi possível atualizar a mensagem da partida #" + game.gameNumber + ":", error?.message || error);
    return false;
  }
}

async function sendEphemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function withGameLock(gameId, callback) {
  if (gameLocks.has(gameId)) return { busy: true };
  gameLocks.add(gameId);
  try {
    return await callback();
  } finally {
    gameLocks.delete(gameId);
  }
}

async function createGame({ guildId, channelId, userId, bet, bombs }) {
  const db = await getDb();
  const games = db.collection("mines_games");
  const balances = db.collection("economy_balances");
  const counters = db.collection("mines_counters");
  const ledger = db.collection("mines_ledger");
  const gameId = randomUUID();
  const now = new Date();
  const game = {
    _id: gameId,
    gameNumber: null,
    guildId: String(guildId),
    channelId: String(channelId),
    messageId: null,
    userId: String(userId),
    bet,
    bombs,
    bombPositions: makeBombPositions(bombs),
    openedCells: [],
    currentMultiplier: 1,
    currentPayout: bet,
    status: "active",
    firstSafeAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const session = mongoClient.startSession();
  try {
    await session.withTransaction(async () => {
      const counter = await counters.findOneAndUpdate(
        { _id: "global" },
        { $inc: { seq: 1 }, $setOnInsert: { createdAt: now } },
        { upsert: true, returnDocument: "after", session }
      );
      game.gameNumber = Number(counter?.seq) || 1;

      const debit = await balances.updateOne(
        { userId: String(userId), balance: { $gte: bet } },
        { $inc: { balance: -bet }, $set: { updatedAt: now } },
        { session }
      );
      if (debit.modifiedCount !== 1) throw new Error("MINES_INSUFFICIENT_BALANCE");

      await games.insertOne(game, { session });
      await ledger.insertOne({
        gameId,
        gameNumber: game.gameNumber,
        userId: String(userId),
        type: "bet",
        amount: bet,
        createdAt: now,
      }, { session });
    });
  } finally {
    await session.endSession();
  }
  return game;
}

async function attachMessage(gameId, messageId) {
  const db = await getDb();
  await db.collection("mines_games").updateOne(
    { _id: gameId, status: "active" },
    { $set: { messageId: String(messageId), updatedAt: new Date() } }
  );
}

async function finishGame(game, status, payout, ledgerType) {
  const db = await getDb();
  const games = db.collection("mines_games");
  const balances = db.collection("economy_balances");
  const ledger = db.collection("mines_ledger");
  const now = new Date();
  const amount = Math.max(0, Math.floor(Number(payout) || 0));
  const session = mongoClient.startSession();
  let finished = false;
  try {
    await session.withTransaction(async () => {
      finished = false;
      const update = await games.updateOne(
        { _id: game._id, status: "active" },
        {
          $set: {
            status,
            currentPayout: amount,
            profit: amount - Number(game.bet),
            endedAt: now,
            displayPending: true,
            updatedAt: now,
          },
        },
        { session }
      );
      if (update.modifiedCount !== 1) return;

      if (amount > 0) {
        await balances.updateOne(
          { userId: String(game.userId) },
          {
            $inc: { balance: amount },
            $set: { updatedAt: now },
            $setOnInsert: { userId: String(game.userId), createdAt: now },
          },
          { upsert: true, session }
        );
      }
      await ledger.insertOne({
        gameId: game._id,
        gameNumber: game.gameNumber,
        userId: String(game.userId),
        type: ledgerType,
        amount,
        createdAt: now,
      }, { session });
      finished = true;
    });
  } finally {
    await session.endSession();
  }
  const finalGame = await games.findOne({ _id: game._id });
  return { finished, game: finalGame };
}

function clearExpiry(gameId) {
  const timer = expiryTimers.get(gameId);
  if (timer) clearTimeout(timer);
  expiryTimers.delete(gameId);
}

function scheduleExpiry(client, game) {
  if (!game?.expiresAt || game.status !== "active") return;
  clearExpiry(game._id);
  const remaining = Math.max(0, new Date(game.expiresAt).getTime() - Date.now());
  const timer = setTimeout(() => {
    expireGame(client, game._id).catch(error => console.error("[Mines] Falha no saque automático:", error));
  }, Math.min(remaining, 2_147_000_000));
  if (typeof timer.unref === "function") timer.unref();
  expiryTimers.set(game._id, timer);
}

async function expireGameLocked(client, gameId) {
  const db = await getDb();
  const games = db.collection("mines_games");
  const game = await games.findOne({ _id: gameId, status: "active" });
  if (!game || !game.expiresAt || !(game.openedCells || []).length) {
    clearExpiry(gameId);
    return false;
  }
  const remaining = new Date(game.expiresAt).getTime() - Date.now();
  if (remaining > 0) {
    scheduleExpiry(client, game);
    return false;
  }
  const result = await finishGame(game, "expired", game.currentPayout, "automatic_payout");
  clearExpiry(gameId);
  if (!result.finished || !result.game) return false;
  await finalizeDisplay(client, result.game);
  return true;
}

async function expireGame(client, gameId) {
  return withGameLock(gameId, () => expireGameLocked(client, gameId));
}

async function finalizeDisplay(client, game) {
  const kind = game.status === "lost" ? "lost"
    : game.status === "expired" ? "expired"
    : game.status === "cancelled" ? "cancelled" : "won";
  const container = buildFinalContainer(game, kind);
  if (kind === "lost") {
    for (const row of buildCellRows(game, true)) container.addActionRowComponents(row);
  }
  const updated = await editGameMessage(client, game, container);
  if (updated) {
    const db = await getDb();
    await db.collection("mines_games").updateOne(
      { _id: game._id, status: game.status },
      { $set: { displayPending: false, displayedAt: new Date() } }
    );
  }
  return updated;
}

async function initialize(client) {
  const db = await getDb();
  const pendingDisplays = await db.collection("mines_games")
    .find({ displayPending: true, status: { $in: ["lost", "expired", "cashed_out", "cancelled"] } }).toArray();
  for (const game of pendingDisplays) await finalizeDisplay(client, game);

  const activeGames = await db.collection("mines_games")
    .find({ status: "active", expiresAt: { $ne: null } }).toArray();
  for (const game of activeGames) {
    if (new Date(game.expiresAt).getTime() <= Date.now()) {
      await expireGame(client, game._id);
    } else {
      scheduleExpiry(client, game);
    }
  }
  console.log("[Mines] " + activeGames.length + " partida(s) com temporizador recuperada(s) do MongoDB.");
}

async function openCell(client, interaction, gameId, cell) {
  const result = await withGameLock(gameId, async () => {
    const db = await getDb();
    const games = db.collection("mines_games");
    let game = await games.findOne({ _id: gameId });
    if (!game || game.status !== "active") {
      return sendEphemeral(interaction, "Esta partida já foi encerrada ou não existe mais.");
    }
    if (game.expiresAt && new Date(game.expiresAt).getTime() <= Date.now()) {
      await expireGameLocked(client, gameId);
      return sendEphemeral(interaction, "O tempo desta partida acabou. O saque automático foi realizado.");
    }
    if ((game.openedCells || []).includes(cell)) {
      return sendEphemeral(interaction, "Essa casa já foi aberta. Escolha outra para continuar.");
    }

    const isBomb = (game.bombPositions || []).includes(cell);
    if (isBomb) {
      const result = await finishGame(game, "lost", 0, "loss");
      clearExpiry(gameId);
      if (result.finished && result.game) {
        await finalizeDisplay(client, result.game);
      }
      return;
    }

    const now = new Date();
    const openedCells = [...(game.openedCells || []), cell];
    const multiplier = multiplierFor(game.bombs, openedCells.length);
    const payout = payoutFor(game.bet, multiplier);
    const firstSafe = !game.firstSafeAt;
    const expiresAt = firstSafe ? new Date(now.getTime() + EXPIRATION_MS) : game.expiresAt;
    const updated = await games.updateOne(
      { _id: gameId, status: "active", openedCells: { $ne: cell } },
      {
        $addToSet: { openedCells: cell },
        $set: {
          currentMultiplier: multiplier,
          currentPayout: payout,
          firstSafeAt: firstSafe ? now : game.firstSafeAt,
          expiresAt,
          updatedAt: now,
        },
      }
    );
    if (updated.modifiedCount !== 1) {
      return sendEphemeral(interaction, "Essa casa já foi aberta. Atualize o tabuleiro e tente outra.");
    }
    game = await games.findOne({ _id: gameId });
    if (game.expiresAt) scheduleExpiry(client, game);
    await editGameMessage(client, game, buildGameContainer(game));
    return;
  });
  if (result?.busy) return sendEphemeral(interaction, "A Yukina está atualizando esta jogada. Aguarde um instante e tente novamente.");
  return result;
}

async function handleButton(interaction, client) {
  const parts = String(interaction.customId || "").split(":");
  const action = parts[1];
  const gameId = parts[2];
  const cell = action === "cell" ? Number(parts[3]) : null;
  if (!gameId) return;
  const db = await getDb();
  const game = await db.collection("mines_games").findOne({ _id: gameId });
  if (!game) return sendEphemeral(interaction, "Esta partida não existe mais.");
  if (String(interaction.user.id) !== String(game.userId)) {
    return sendEphemeral(interaction, "Esse jogo não é o seu. Tá tentando acabar com o coitado? Deixa ele(a) ser feliz, viu.");
  }
  if (game.status !== "active") {
    return sendEphemeral(interaction, "Esta partida já foi encerrada.");
  }

  await interaction.deferUpdate();
  if (action === "cell") {
    if (!Number.isInteger(cell) || cell < 0 || cell >= BOARD_SIZE) {
      return sendEphemeral(interaction, "Essa casa não é válida.");
    }
    return openCell(client, interaction, gameId, cell);
  }

  if (action === "random") {
    const opened = new Set(game.openedCells || []);
    const available = Array.from({ length: BOARD_SIZE }, (_, index) => index).filter(index => !opened.has(index));
    if (!available.length) return sendEphemeral(interaction, "Não existem mais casas fechadas.");
    return openCell(client, interaction, gameId, available[randomInt(available.length)]);
  }

  if (action === "refresh") {
    if (game.expiresAt && new Date(game.expiresAt).getTime() <= Date.now()) {
      await expireGame(client, gameId);
      return;
    }
    return editGameMessage(client, game, buildGameContainer(game));
  }

  if (action === "cashout") {
    if (!(game.openedCells || []).length) {
      return sendEphemeral(interaction, "Você precisa abrir pelo menos uma casa segura antes de sacar.");
    }
    const cashoutResult = await withGameLock(gameId, async () => {
      const latest = await db.collection("mines_games").findOne({ _id: gameId, status: "active" });
      if (!latest) return sendEphemeral(interaction, "Esta partida já foi encerrada.");
      if (latest.expiresAt && new Date(latest.expiresAt).getTime() <= Date.now()) {
        await expireGameLocked(client, gameId);
        return;
      }
      try {
        const result = await finishGame(latest, "cashed_out", latest.currentPayout, "manual_payout");
        clearExpiry(gameId);
        if (!result.finished || !result.game) return sendEphemeral(interaction, "Não foi possível concluir seu saque. Tente sacar novamente.");
        await finalizeDisplay(client, result.game);
      } catch (error) {
        console.error("[Mines] Erro no saque manual:", error);
        return sendEphemeral(interaction, "Não foi possível concluir seu saque. Tente sacar novamente.");
      }
    });
    if (cashoutResult?.busy) {
      return sendEphemeral(interaction, "A Yukina está atualizando esta partida. Aguarde um instante e tente sacar novamente.");
    }
    return cashoutResult;
  }
}

async function startGame({ guild, channel, user, betInput, bombs, send }) {
  if (!guild || !channel) return { ok: false, message: "Este jogo só pode ser iniciado dentro de um servidor." };
  const bet = parseBet(betInput);
  if (!bet || !Number.isInteger(bombs) || bombs < MIN_BOMBS || bombs > MAX_BOMBS) {
    const prefix = await getGuildPrefix(guild.id).catch(() => "Y");
    return { ok: false, message: "Valor e bomba inválido. Use " + prefix + "mines valor bomba" };
  }

  const db = await getDb();
  const active = await db.collection("mines_games").findOne({ userId: String(user.id), status: "active" });
  if (active) return { ok: false, message: "Você já está explorando uma caverna! Termine sua partida #" + active.gameNumber + " antes de iniciar outra." };

  let game;
  try {
    game = await createGame({
      guildId: guild.id,
      channelId: channel.id,
      userId: user.id,
      bet,
      bombs,
    });
  } catch (error) {
    if (error.message === "MINES_INSUFFICIENT_BALANCE") {
      return { ok: false, message: "Você não possui KZ o suficiente para entrar nas cavernas. Você precisa de **" + format(bet) + " KZ**." };
    }
    if (error.code === 11000) {
      const existing = await db.collection("mines_games").findOne({ userId: String(user.id), status: "active" });
      return { ok: false, message: "Você já está explorando uma caverna! Termine sua partida" + (existing ? " #" + existing.gameNumber : "") + " antes de iniciar outra." };
    }
    throw error;
  }

  try {
    const message = await send({
      components: [buildGameContainer(game)],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
    if (!message?.id) throw new Error("A mensagem da partida não retornou um ID.");
    await attachMessage(game._id, message.id);
    return { ok: true, game, message };
  } catch (error) {
    console.error("[Mines] Não foi possível publicar o tabuleiro; devolvendo a aposta:", error);
    const refund = await finishGame(game, "cancelled", bet, "refund");
    return { ok: false, message: "Não consegui abrir o tabuleiro agora. Sua aposta foi devolvida." };
  }
}

async function getGuildPrefix(guildId) {
  const db = await getDb();
  const settings = await db.collection("guild_settings").findOne(
    { guildId: String(guildId) },
    { projection: { "settings.prefix": 1 } }
  );
  const prefix = String(settings?.settings?.prefix || "Y").trim();
  return prefix && prefix.length <= 5 && !/\s/.test(prefix) ? prefix : "Y";
}

module.exports = {
  MIN_BET,
  MAX_BET,
  MIN_BOMBS,
  MAX_BOMBS,
  EXPIRATION_MS,
  parseBet,
  multiplierFor,
  payoutFor,
  startGame,
  attachMessage,
  initialize,
  handleButton,
};
