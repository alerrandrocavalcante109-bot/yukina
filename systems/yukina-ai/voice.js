"use strict";
try { process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || require("ffmpeg-static"); } catch {}
const { Readable } = require("node:stream");
const prism = require("prism-media");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, EndBehaviorType, StreamType } = require("@discordjs/voice");
const { transcribeAudio, synthesizeSpeech, pcmToWav } = require("./audio");
const sessions = new Map();
const MAX_UTTERANCE_MS = 15000;
const MAX_PCM_BYTES = 48000 * 2 * 2 * 15;
function buildDecoder() { return new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }); }
async function speak(session, text) {
  const audio = await synthesizeSpeech(text);
  if (!audio || !session.connection) return false;
  session.player.play(createAudioResource(Readable.from(audio), { inputType: StreamType.Arbitrary }));
  return true;
}
function installReceiver(session, getEngine) {
  const receiver = session.connection.receiver;
  receiver.speaking.on("start", async userId => {
    if (session.busy || session.connection.state.status !== VoiceConnectionStatus.Ready) return;
    const member = await session.guild.members.fetch(userId).catch(() => null);
    if (!member || member.user.bot) return;
    session.busy = true;
    const opusStream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 1100 } });
    const decoder = buildDecoder();
    const chunks = []; let total = 0; let finished = false;
    const timeout = setTimeout(() => { if (!finished) { opusStream.unpipe(decoder); decoder.end(); opusStream.destroy(); } }, MAX_UTTERANCE_MS);
    const cleanup = () => { finished = true; clearTimeout(timeout); session.busy = false; };
    decoder.on("data", chunk => {
      if (total >= MAX_PCM_BYTES) return;
      const safeChunk = chunk.length > MAX_PCM_BYTES - total ? chunk.subarray(0, MAX_PCM_BYTES - total) : chunk;
      chunks.push(safeChunk); total += safeChunk.length;
    });
    decoder.on("error", error => { console.warn("[Yukina Voz] Falha ao decodificar áudio:", error.message); cleanup(); });
    decoder.on("end", async () => {
      if (finished) return;
      clearTimeout(timeout);
      try {
        if (total < 12000) return;
        const transcript = await transcribeAudio(pcmToWav(Buffer.concat(chunks, total)), "discord-voice.wav", "audio/wav");
        const result = await getEngine().answer({
          userId, channelId: session.textChannel.id, guildId: session.guild.id, prompt: transcript,
          displayName: member.displayName || member.user.username,
          discordContext: { guild: session.guild, channel: session.textChannel, actorId: userId, actorTag: member.user.tag, source: "voice" }
        });
        await session.textChannel.send({ content: "<@" + userId + "> 🎙️ **" + transcript.slice(0, 700) + "**\n" + result.text, allowedMentions: { parse: [], users: [userId] } }).catch(() => {});
        await speak(session, result.text).catch(error => console.warn("[Yukina Voz] Não consegui gerar fala:", error.message));
      } catch (error) {
        console.warn("[Yukina Voz] Áudio não processado:", error.message);
        await session.textChannel.send("<@" + userId + "> 🌸 Não consegui entender esse áudio. Tente falar um pouquinho mais perto do microfone.").catch(() => {});
      } finally { cleanup(); }
    });
    opusStream.pipe(decoder);
  });
}
function enter(guild, voiceChannel, textChannel, getEngine) {
  const existing = sessions.get(guild.id);
  if (existing) { existing.connection.destroy(); sessions.delete(guild.id); }
  const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
  const player = createAudioPlayer(); connection.subscribe(player);
  const session = { guild, voiceChannel, textChannel, connection, player, busy: false };
  sessions.set(guild.id, session);
  connection.on(VoiceConnectionStatus.Ready, () => console.log("[Yukina Voz] Conectada em " + voiceChannel.name + " (" + guild.id + ")."));
  connection.on("error", error => console.error("[Yukina Voz] Erro de conexão:", error.message));
  player.on("error", error => console.error("[Yukina Voz] Erro no player:", error.message));
  player.on(AudioPlayerStatus.Idle, () => {});
  installReceiver(session, getEngine);
  return session;
}
function leave(guildId) {
  const session = sessions.get(String(guildId));
  if (!session) return false;
  session.player.stop(true); session.connection.destroy(); sessions.delete(String(guildId)); return true;
}
module.exports = { enter, leave, getSession: guildId => sessions.get(String(guildId)) || null };
