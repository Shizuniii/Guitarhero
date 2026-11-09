// Ein einziger Timer für die ganze App: das Panel und die Module zeigen denselben.
import { audioCtx, audioToPerf, beep, resumeAudio } from './audio.js';
import { createEmitter, createStore } from './core.js';
import { settings } from './state.js';
import { metronome, nextBarStart } from './metronome.js';

export const timer = createStore({
  phase: 'idle', // idle | countdown | running | paused | finished
  duration: 60,
  remaining: 60,
  count: 0,
});

export const timerEvents = createEmitter();

let tickId = null;
let endAt = 0;
let lastWhole = 0;
let countdownMax = 0;
let starting = false;
let countdownSync = null;
let runTimeout = null;

// Ein Modul mit eigenem Takt (z. B. Strum) legt fest, wann der Countdown endet: genau auf Takt 1.
// Die Funktion bekommt die Countdown-Sekunden und liefert eine Zeit der Audio-Uhr oder null.
export function setCountdownSync(fn) {
  countdownSync = fn;
  return () => { if (countdownSync === fn) countdownSync = null; };
}

// Ohne eigenes Modul-Timing gilt: läuft das Metronom, endet der Countdown auf einem Taktanfang.
async function countdownEnd(seconds) {
  let at = null;
  if (countdownSync) at = await countdownSync(seconds);
  else at = nextBarStart(seconds);
  return at === null || at === undefined ? null : audioToPerf(at);
}

function clear() {
  clearInterval(tickId);
  tickId = null;
  clearTimeout(runTimeout);
  runTimeout = null;
}

function loop() {
  const t = timer.get();
  const left = (endAt - performance.now()) / 1000;
  if (t.phase === 'countdown') {
    const whole = Math.min(countdownMax, Math.ceil(left));
    if (whole !== lastWhole) {
      lastWhole = whole;
      if (whole > 0) {
        timer.patch({ count: whole });
        if (!metronome.get().running) beep({ freq: whole === 1 ? 1320 : 880 });
      }
    }
    if (left <= 0) beginRun(t.duration);
    return;
  }
  if (t.phase === 'running') {
    if (left <= 0) {
      clear();
      timer.patch({ phase: 'finished', remaining: 0 });
      beep({ freq: 1320, dur: 0.18 });
      beep({ freq: 1760, dur: 0.3, when: audioCtx().currentTime + 0.2 });
      timerEvents.emit('end', { seconds: t.duration });
    } else {
      timer.patch({ remaining: left });
    }
  }
}

function beginRun(seconds) {
  clearTimeout(runTimeout);
  runTimeout = null;
  endAt = performance.now() + seconds * 1000;
  timer.patch({ phase: 'running', remaining: seconds, count: 0 });
  timerEvents.emit('run', { seconds });
}

export async function startTimer() {
  const t = timer.get();
  if (starting || t.phase === 'running' || t.phase === 'countdown') return;
  if (t.phase === 'paused') return resumeTimer();
  starting = true;
  try {
    await resumeAudio();
    const countdown = settings.get().countdownSeconds;
    clear();
    timer.patch({ remaining: t.duration });
    timerEvents.emit('prepare', {});
    if (countdown > 0) {
      const synced = await countdownEnd(countdown);
      endAt = synced ?? performance.now() + countdown * 1000;
      countdownMax = countdown;
      lastWhole = 0;
      timer.patch({ phase: 'countdown', count: Math.min(countdown, Math.ceil((endAt - performance.now()) / 1000)) });
      timerEvents.emit('countdown', { seconds: countdown });
      // Genau zum Ende umschalten, nicht erst beim nächsten Nachsehen.
      runTimeout = setTimeout(() => {
        if (timer.get().phase === 'countdown') beginRun(timer.get().duration);
      }, Math.max(0, endAt - performance.now()));
    } else {
      beginRun(t.duration);
    }
    tickId = setInterval(loop, 20);
    loop();
  } finally {
    starting = false;
  }
}

export function pauseTimer() {
  const t = timer.get();
  if (t.phase !== 'running') return;
  clear();
  timer.patch({ phase: 'paused', remaining: (endAt - performance.now()) / 1000 });
  timerEvents.emit('pause', {});
}

export function resumeTimer() {
  const t = timer.get();
  if (t.phase !== 'paused') return;
  endAt = performance.now() + t.remaining * 1000;
  timer.patch({ phase: 'running' });
  timerEvents.emit('resume', {});
  tickId = setInterval(loop, 50);
}

export function resetTimer() {
  const t = timer.get();
  const wasActive = ['countdown', 'running', 'paused'].includes(t.phase);
  clear();
  const elapsed = t.phase === 'running' || t.phase === 'paused' ? t.duration - t.remaining : 0;
  timer.patch({ phase: 'idle', remaining: t.duration, count: 0 });
  if (wasActive) timerEvents.emit('stop', { seconds: elapsed });
}

export function setTimerDuration(seconds) {
  const s = Math.max(1, Math.round(seconds));
  const t = timer.get();
  if (['countdown', 'running', 'paused'].includes(t.phase)) return;
  timer.patch({ duration: s, remaining: s, phase: 'idle' });
}

export function toggleTimer() {
  const { phase } = timer.get();
  if (phase === 'running') pauseTimer();
  else if (phase === 'countdown') resetTimer();
  else if (phase === 'finished') {
    timer.patch({ phase: 'idle', remaining: timer.get().duration });
    startTimer();
  } else startTimer();
}
