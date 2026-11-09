// Aufnahmen: Kurzzeit-Takes pro Modul und dauerhafte Aufnahmen.
import { createEmitter, createStore, safeFileName, uid } from './core.js';
import { resumeAudio } from './audio.js';
import { dbDelete, dbGet, dbPut } from './db.js';
import { acquireMic, releaseMic } from './mic.js';
import { recordings } from './state.js';
import { deleteFromFolder, writeToFolder } from './folder.js';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export const extensionFor = (mime) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

let tapModule = null;

// Gemeinsamer Strom für alle, die beim Spielen live mithören (z. B. der Wechselzähler).
export const liveChunks = createEmitter();

async function startTap(stream) {
  const ctx = await resumeAudio();
  if (!ctx.audioWorklet) return null;
  if (!tapModule) tapModule = ctx.audioWorklet.addModule(new URL('./tap-worklet.js', import.meta.url).href);
  await tapModule;
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'gh-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(node).connect(mute).connect(ctx.destination);
  const state = { chunks: [], startTime: null, sampleRate: ctx.sampleRate, broken: false };
  let finish;
  const done = new Promise((r) => { finish = r; });
  node.port.onmessage = (e) => {
    const d = e.data;
    if (d.start !== undefined) state.startTime = d.start;
    if (d.chunk) {
      state.chunks.push(d.chunk);
      liveChunks.emit('chunk', { data: d.chunk, sampleRate: state.sampleRate });
    }
    if (d.done) finish();
  };
  return {
    state,
    async stop() {
      node.port.postMessage('stop');
      await Promise.race([done, new Promise((r) => setTimeout(r, 400))]);
      src.disconnect();
      node.disconnect();
      mute.disconnect();
      const len = state.chunks.reduce((n, c) => n + c.length, 0);
      const samples = new Float32Array(len);
      let o = 0;
      for (const c of state.chunks) { samples.set(c, o); o += c.length; }
      return { samples, sampleRate: state.sampleRate, startTime: state.startTime ?? 0, broken: state.broken };
    },
    cancel() { node.port.postMessage('stop'); src.disconnect(); node.disconnect(); mute.disconnect(); },
  };
}

export async function startRecording({ tap = false } = {}) {
  const mime = pickMime();
  if (mime === null) throw new Error('Dieser Browser kann nicht aufnehmen.');
  const stream = await acquireMic();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 128000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  const marks = {};
  let tapper = null;
  if (tap) {
    try { tapper = await startTap(stream); } catch { tapper = null; }
  }
  let startedAt = performance.now();
  let pausedFor = 0;
  let pausedAt = 0;
  const elapsed = () => (pausedAt || performance.now()) - startedAt - pausedFor;
  rec.start(1000);
  startedAt = performance.now();

  return {
    elapsed,
    tapStart: () => tapper?.state.startTime ?? null,
    mark(name) { marks[name] = elapsed(); },
    pause() {
      if (rec.state === 'recording') { rec.pause(); pausedAt = performance.now(); }
      if (tapper) tapper.state.broken = true;
    },
    resume() {
      if (rec.state === 'paused') { rec.resume(); pausedFor += performance.now() - pausedAt; pausedAt = 0; }
    },
    async stop() {
      const audio = tapper ? await tapper.stop() : null;
      return new Promise((resolve) => {
        const ms = elapsed();
        rec.onstop = () => {
          releaseMic();
          resolve({ blob: new Blob(chunks, { type: rec.mimeType || mime }), mime: rec.mimeType || mime, ms, marks, audio });
        };
        if (rec.state !== 'inactive') rec.stop();
      });
    },
    cancel() {
      tapper?.cancel();
      rec.onstop = () => releaseMic();
      if (rec.state !== 'inactive') rec.stop();
    },
  };
}

// Kurzzeit-Takes: bleiben nur, bis du zum nächsten Schritt gehst.
export const takes = createStore([]);

export function addTake(result, meta) {
  const take = { id: uid(), createdAt: Date.now(), kept: false, ...result, meta };
  takes.set((list) => [take, ...list]);
  return take;
}

export function setTakeAnalysis(id, analysis) {
  let rid = null;
  takes.set((list) => list.map((t) => {
    if (t.id !== id) return t;
    rid = t.recordingId;
    return { ...t, analysis };
  }));
  if (rid && !analysis.pending) {
    const rec = recordings.find(rid);
    if (rec) recordings.put({ ...rec, analysis });
  }
}

export const clearTakes = () => takes.set([]);
export const removeTake = (id) => takes.set((list) => list.filter((t) => t.id !== id));

export async function saveRecording({ blob, mime, ms, marks, meta = {}, title, createdAt, analysis }) {
  const when = createdAt || Date.now();
  const id = uid();
  const stamp = new Date(when).toISOString().slice(0, 16).replace('T', ' ').replace(':', '-');
  const name = title || meta.title || 'Aufnahme';
  const fileName = `${stamp} ${safeFileName(name)}.${extensionFor(mime)}`;
  await dbPut('blobs', blob, id);
  const { analysis: job, ...cleanMeta } = meta;
  const saved = await recordings.put({
    id, title: name, ms, marks: marks || {}, mime, meta: cleanMeta, fileName, createdAt: when, size: blob.size,
    ...(analysis && !analysis.pending ? { analysis } : {}), ...(job?.models ? { models: job.models } : {}),
  });
  writeToFolder(fileName, blob);
  return saved;
}

export const keepTake = async (take) => {
  const saved = await saveRecording(take);
  takes.set((list) => list.map((t) => (t.id === take.id ? { ...t, kept: true, recordingId: saved.id } : t)));
  return saved;
};

export const loadRecordingBlob = (id) => dbGet('blobs', id);

export async function deleteRecording(rec) {
  await dbDelete('blobs', rec.id);
  await recordings.remove(rec.id);
  await deleteFromFolder(rec.fileName);
}
