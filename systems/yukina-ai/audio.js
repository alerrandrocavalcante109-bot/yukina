"use strict";
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
function getAudioConfig() {
  return { groqKey: String(process.env.GROQ_API_KEY || "").trim(), elevenKey: String(process.env.ELEVENLABS_API_KEY || "").trim(), voiceId: String(process.env.ELEVENLABS_VOICE_ID || "").trim() };
}
async function transcribeAudio(buffer, filename = "audio.webm", contentType = "audio/webm") {
  const { groqKey } = getAudioConfig();
  if (!groqKey) throw new Error("A variável GROQ_API_KEY não está configurada.");
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_AUDIO_BYTES) throw new Error("O áudio está vazio ou ultrapassa o limite de 24 MB.");
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), filename);
  form.append("model", process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo");
  form.append("language", "pt");
  form.append("response_format", "json");
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + groqKey }, body: form, signal: AbortSignal.timeout(60000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Groq STT HTTP " + response.status + ": " + (data.error?.message || "falha na transcrição"));
  const text = String(data.text || "").trim();
  if (!text) throw new Error("Não consegui identificar fala nesse áudio.");
  return text.slice(0, 2500);
}
async function synthesizeSpeech(text) {
  const { elevenKey, voiceId } = getAudioConfig();
  if (!elevenKey || !voiceId) return null;
  const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId) + "?output_format=mp3_44100_128", {
    method: "POST", headers: { "xi-api-key": elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: String(text || "").slice(0, 1200), model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2", voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.35, use_speaker_boost: true } }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error("ElevenLabs TTS HTTP " + response.status + ": " + (await response.text().catch(() => "")).slice(0, 300));
  return Buffer.from(await response.arrayBuffer());
}
function pcmToWav(pcm, sampleRate = 48000, channels = 2) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8); header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
module.exports = { transcribeAudio, synthesizeSpeech, pcmToWav, MAX_AUDIO_BYTES };
