// Ein einziger Timer für die ganze App: das Panel und die Module zeigen denselben.
import { audioCtx, beep, resumeAudio } from './audio.js';
import { createEmitter, createStore } from './core.js';
import { settings } from './state.js';
import { metronome } from './metronome.js';

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

function clear() {
  clearInterval(tickId);
  tickId = null;
}

function loop() {
  const t = timer.get();
  const left = (endAt - performance.now()) / 1000;
  if (t.phase === 'countdown') {
    const whole = Math.ceil(left);
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
  endAt = performance.now() + seconds * 1000;
  timer.patch({ phase: 'running', remaining: seconds, count: 0 });
  timerEvents.emit('run', { seconds });
}

export async function startTimer() {
  const t = timer.get();
  if (t.phase === 'running' || t.phase === 'countdown') return;
  if (t.phase === 'paused') return resumeTimer();
  await resumeAudio();
  const countdown = settings.get().countdownSeconds;
  clear();
  timer.patch({ remaining: t.duration });
  timerEvents.emit('prepare', {});
  if (countdown > 0) {
    endAt = performance.now() + countdown * 1000;
    lastWhole = 0;
    timer.patch({ phase: 'countdown', count: countdown });
    timerEvents.emit('countdown', { seconds: countdown });
  } else {
    beginRun(t.duration);
  }
  tickId = setInterval(loop, 50);
  loop();
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
