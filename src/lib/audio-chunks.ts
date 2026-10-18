/** Splits large lesson audio into pieces the transcription service accepts (each under ~20 MB). */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
export const CHUNK_BYTES = 20 * 1024 * 1024;

function isMp3(file: Blob & { name?: string }) {
  return file.type === "audio/mpeg" || file.type === "audio/mp3" || /\.mp3$/i.test(file.name ?? "");
}

function wavFromPcm(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

export async function splitAudio(file: Blob & { name?: string }): Promise<Blob[]> {
  if (file.size <= CHUNK_BYTES) return [file];
  if (isMp3(file)) {
    // MP3 is a stream of independent frames, so byte slices stay decodable.
    const parts: Blob[] = [];
    for (let i = 0; i < file.size; i += CHUNK_BYTES) parts.push(file.slice(i, i + CHUNK_BYTES, "audio/mpeg"));
    return parts;
  }
  // Other formats: decode, downmix to 16 kHz mono, cut into ~10 minute WAV pieces.
  const rate = 16000;
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } finally {
    await ctx.close().catch(() => {});
  }
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const per = rate * 600;
  const parts: Blob[] = [];
  for (let i = 0; i < pcm.length; i += per) parts.push(wavFromPcm(pcm.subarray(i, i + per), rate));
  return parts;
}
