// Gemeinsamer AudioContext und kleine Signaltöne.
let ctx = null;

export function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
  }
  return ctx;
}

export async function resumeAudio() {
  const c = audioCtx();
  if (c.state !== 'running') await c.resume();
  return c;
}

export function beep({ freq = 880, dur = 0.09, gain = 0.25, when = 0, type = 'sine' } = {}) {
  const c = audioCtx();
  const t = when || c.currentTime + 0.005;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
