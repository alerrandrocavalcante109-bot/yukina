"use strict";
try { process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || require("ffmpeg-static"); } catch {}
const { Readable } = require("node:stream");
const prism = require("prism-media");
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, EndBehaviorType, StreamType, entersState
} = require("@discordjs/voice");
const { transcribeAudio, synthesizeSpeech, pcmToWav } = require("./audio");
const sessions = new Map();
const MAX_UTTERANCE_MS = 15000;
const MAX_PCM_BYTES = 48000 * 2 * 2 * 15;
const MIN_PCM_BYTES = 12000;
const MAX_QUEUED_UTTERANCES = 5;

function buildDecoder() { return new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }); }
function isActive(session) {
  return sessions.get(session.guild.id) === session &&
    session.connection.state.status === VoiceConnectionStatus.Ready;
}
function refreshBusy(session) {
  session.busy = Boolean(session.processing || session.queue.length || session.captures.size);
}
async function speak(session, text) {
  if (!isActive(session)) return false;
  const audio = await synthesizeSpeech(text);
  if (!audio || !isActive(session)) return false;
  session.player.play(createAudioResource(Readable.from(audio), { inputType: StreamType.Arbitrary }));
  return true;
}
async function drainQueue(session, getEngine) {
  if (session.processing || !isActive(session)) return;
  session.processing = true;
  refreshBusy(session);
  try {
    while (session.queue.length && isActive(session)) {
      const utterance = session.queue.shift();
      refreshBusy(session);
      try {
        const transcript = await transcribeAudio(utterance.wav, "discord-voice.wav", "audio/wav");
        if (!isActive(session)) break;
        const result = await getEngine().answer({
          userId: utterance.userId,
          channelId: session.textChannel.id,
          guildId: session.guild.id,
          prompt: transcript,
          displayName: utterance.member.displayName || utterance.member.user.username,
          discordContext: {
            guild: session.guild, channel: session.textChannel,
            actorId: utterance.userId, actorTag: utterance.member.user.tag,
            source: "voice"
          }
        });
        if (!isActive(session)) break;
        await session.textChannel.send({
          content: "<@" + utterance.userId + "> 🎙️ **" + transcript.slice(0, 700) + "**\n" + result.text,
          allowedMentions: { parse: [], users: [utterance.userId] }
        }).catch(() => {});
        await speak(session, result.text).catch(error =>
          console.warn("[Yukina Voz] Não consegui gerar fala:", error.message)
        );
      } catch (error) {
        console.warn("[Yukina Voz] Áudio não processado:", error.message);
        if (isActive(session)) {
          await session.textChannel.send({
            content: "<@" + utterance.userId + "> 🌸 Não consegui processar essa fala. Tente novamente em alguns instantes.",
            allowedMentions: { parse: [], users: [utterance.userId] }
          }).catch(() => {});
        }
      }
    }
  } finally {
    session.processing = false;
    refreshBusy(session);
    if (session.queue.length && isActive(session)) drainQueue(session, getEngine);
  }
}
function installReceiver(session, getEngine) {
  const receiver = session.connection.receiver;
  receiver.speaking.on("start", async userId => {
    if (!isActive(session) || session.captures.has(userId)) return;
    session.captures.add(userId);
    refreshBusy(session);
    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1100 }
    });
    const member = await session.guild.members.fetch(userId).catch(() => null);
    if (!member || member.user.bot || !isActive(session)) {
      opusStream.destroy();
      session.captures.delete(userId);
      refreshBusy(session);
      return;
    }
    const decoder = buildDecoder();
    const chunks = [];
    let total = 0;
    let finished = false;
    let timedOut = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      session.captures.delete(userId);
      refreshBusy(session);
    };
    const timeout = setTimeout(() => {
      if (finished) return;
      timedOut = true;
      opusStream.unpipe(decoder);
      opusStream.destroy();
      decoder.destroy();
      cleanup();
      session.textChannel.send("🌸 Sua fala passou do limite de 15 segundos. Pode dividir em frases menores?").catch(() => {});
    }, MAX_UTTERANCE_MS);
    opusStream.on("error", error => {
      if (!finished) console.warn("[Yukina Voz] Fluxo de áudio interrompido:", error.message);
      cleanup();
    });
    decoder.on("data", chunk => {
      if (total >= MAX_PCM_BYTES) return;
      const safeChunk = chunk.length > MAX_PCM_BYTES - total ? chunk.subarray(0, MAX_PCM_BYTES - total) : chunk;
      chunks.push(safeChunk);
      total += safeChunk.length;
    });
    decoder.on("error", error => {
      if (!finished) console.warn("[Yukina Voz] Falha ao decodificar áudio:", error.message);
      cleanup();
    });
    decoder.on("end", () => {
      if (finished || timedOut) return;
      try {
        if (total < MIN_PCM_BYTES) return;
        if (session.queue.length >= MAX_QUEUED_UTTERANCES) {
          session.textChannel.send("🌙 Minha fila de falas está cheia. Aguarde um pouquinho antes de falar novamente.").catch(() => {});
          return;
        }
        session.queue.push({ userId, member, wav: pcmToWav(Buffer.concat(chunks, total)) });
        refreshBusy(session);
        drainQueue(session, getEngine);
      } finally {
        cleanup();
      }
    });
    opusStream.pipe(decoder);
  });
}
async function enter(guild, voiceChannel, textChannel, getEngine, startedBy) {
  const existing = sessions.get(guild.id);
  if (existing && existing.voiceChannel.id === voiceChannel.id) {
    existing.textChannel = textChannel;
    return { session: existing, alreadyConnected: true };
  }
  if (existing) leave(guild.id);
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false, selfMute: false
  });
  const player = createAudioPlayer();
  connection.subscribe(player);
  const session = {
    guild, voiceChannel, textChannel, connection, player,
    startedBy: String(startedBy || ""), joinedAt: new Date(),
    busy: false, processing: false, queue: [], captures: new Set()
  };
  sessions.set(guild.id, session);
  connection.on(VoiceConnectionStatus.Ready, () =>
    console.log("[Yukina Voz] Conectada em " + voiceChannel.name + " (" + guild.id + ").")
  );
  connection.on("error", error => console.error("[Yukina Voz] Erro de conexão:", error.message));
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000)
      ]);
      console.log("[Yukina Voz] Reconexão iniciada em " + voiceChannel.name + ".");
    } catch {
      if (sessions.get(guild.id) === session) {
        console.warn("[Yukina Voz] Conexão perdida; encerrando sessão.");
        leave(guild.id);
        textChannel.send("🌙 Minha conexão de voz caiu. Quando eu voltar, pode me chamar novamente com /voz entrar.").catch(() => {});
      }
    }
  });
  connection.on(VoiceConnectionStatus.Destroyed, () => {
    if (sessions.get(guild.id) === session) sessions.delete(guild.id);
  });
  player.on("error", error => console.error("[Yukina Voz] Erro no player:", error.message));
  player.on(AudioPlayerStatus.Idle, () => {});
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
  } catch (error) {
    if (sessions.get(guild.id) === session) sessions.delete(guild.id);
    connection.destroy();
    throw new Error("A conexão de voz não ficou pronta em 20 segundos: " + error.message);
  }
  installReceiver(session, getEngine);
  return { session, alreadyConnected: false };
}
function leave(guildId) {
  const key = String(guildId);
  const session = sessions.get(key);
  if (!session) return false;
  sessions.delete(key);
  session.queue.length = 0;
  session.player.stop(true);
  session.connection.destroy();
  return true;
}
function getSession(guildId) { return sessions.get(String(guildId)) || null; }
module.exports = { enter, leave, getSession };
