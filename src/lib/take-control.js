// Verbindet Timer und Aufnahme: Timer in einem Modul starten heißt mitschneiden.
import { useEffect, useRef } from '../../vendor/htm-preact.js';
import { createStore } from './core.js';
import { acquireMic, micState, releaseMic } from './mic.js';
import { analyze } from './analyze.js';
import { addTake, setTakeAnalysis, startRecording } from './recorder.js';
import { logPractice, settings } from './state.js';
import { timerEvents } from './timer.js';
import { toast } from './ui-state.js';

export const recStatus = createStore({ state: 'off' }); // off | recording | tail

// Legt einen Versuch ab und startet, falls vorgesehen, die Auswertung im Hintergrund.
export function queueTake(result, meta) {
  const { audio, ...rest } = result;
  const job = meta.analysis;
  const take = addTake(rest, meta);
  if (!job || !audio || !audio.samples.length) return take;
  if (audio.broken) {
    setTakeAnalysis(take.id, { error: 'paused' });
    return take;
  }
  setTakeAnalysis(take.id, { pending: true });
  const { models, ...params } = job;
  analyze({ ...params, samples: audio.samples, sampleRate: audio.sampleRate, startTime: audio.startTime })
    .then((a) => setTakeAnalysis(take.id, { ...a, models }))
    .catch((e) => setTakeAnalysis(take.id, { error: e.message }));
  return take;
}

export function useTimerRecording(getMeta) {
  const metaRef = useRef(getMeta);
  metaRef.current = getMeta;

  useEffect(() => {
    let active = null;
    let tail = null;
    let held = false;
    let wantRecording = false;

    const letGo = () => {
      if (held) { held = false; releaseMic(); }
    };

    const finish = async () => {
      clearTimeout(tail);
      tail = null;
      const rec = active;
      active = null;
      recStatus.set({ state: 'off' });
      if (!rec) return;
      const result = await rec.stop();
      queueTake(result, metaRef.current());
    };

    const off = [
      timerEvents.on('prepare', async () => {
        wantRecording = settings.get().recordDuringTimer;
        if (!wantRecording) return;
        try {
          await acquireMic();
          held = true;
        } catch {
          wantRecording = false;
          toast(micState.get().message || 'Das Mikrofon lässt sich nicht öffnen. Der Timer läuft ohne Aufnahme.', 'warn', 7000);
        }
      }),
      timerEvents.on('run', async () => {
        if (!wantRecording || active) return;
        try {
          active = await startRecording({ tap: true });
          recStatus.set({ state: 'recording' });
        } catch {
          toast('Die Aufnahme ließ sich nicht starten.', 'warn');
        }
        letGo();
      }),
      timerEvents.on('pause', () => active?.pause()),
      timerEvents.on('resume', () => active?.resume()),
      timerEvents.on('end', ({ seconds }) => {
        const meta = metaRef.current();
        logPractice({ type: meta.type, title: meta.title, seconds });
        letGo();
        if (!active) return;
        active.mark('timerEnd');
        recStatus.set({ state: 'tail' });
        tail = setTimeout(finish, settings.get().tailSeconds * 1000);
      }),
      timerEvents.on('stop', ({ seconds }) => {
        const meta = metaRef.current();
        logPractice({ type: meta.type, title: meta.title, seconds });
        letGo();
        if (!active) return;
        if (seconds >= 2) {
          active.mark('timerEnd');
          finish();
        } else {
          active.cancel();
          active = null;
          recStatus.set({ state: 'off' });
        }
      }),
    ];

    return () => {
      off.forEach((fn) => fn());
      clearTimeout(tail);
      letGo();
      if (active) {
        // Schritt gewechselt: laufender Mitschnitt verfällt wie alle Kurzzeit-Takes.
        active.cancel();
        active = null;
      }
      recStatus.set({ state: 'off' });
    };
  }, []);
}
