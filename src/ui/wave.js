// Wellenform mit Wiedergabe. Der Bereich nach Timer-Ende ist markiert.
import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { audioCtx, resumeAudio } from '../lib/audio.js';
import { createStore, downloadBlob, fmtDuration, safeFileName, useStore } from '../lib/core.js';
import { extensionFor, keepTake, removeTake, takes } from '../lib/recorder.js';
import { issueText, summary } from '../lib/feedback.js';
import { toast } from '../lib/ui-state.js';
import { Button } from './common.js';
import { Icon } from './icons.js';

const nowPlaying = createStore(null);

export async function decodeBlob(blob) {
  const c = audioCtx();
  return c.decodeAudioData(await blob.arrayBuffer());
}

function buildPeaks(buffer, count) {
  const data = buffer.getChannelData(0);
  const size = Math.max(1, Math.floor(data.length / count));
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let max = 0;
    const from = i * size;
    const to = Math.min(data.length, from + size);
    for (let j = from; j < to; j += 8) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    out[i] = max;
  }
  return out;
}

function hexToRgb(hex) {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// Je schlechter, desto roter: Rot über Gelb nach Grün.
export function scoreColor(score) {
  const st = getComputedStyle(document.documentElement);
  const [bad, warn, good] = ['--bad', '--warn', '--good'].map((v) => hexToRgb(st.getPropertyValue(v) || '#888888'));
  const s = Math.max(0, Math.min(1, score));
  const [a, b, t] = s < 0.5 ? [bad, warn, s / 0.5] : [warn, good, (s - 0.5) / 0.5];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const SCORE_WORD = (s) => (s >= 0.85 ? 'sauber' : s >= 0.5 ? 'kleine Fehler' : 'deutlich daneben');

function Verdict({ analysis, duration, playAt }) {
  if (!analysis) return null;
  if (analysis.pending) return html`<p class="verdict-note" role="status">Wird ausgewertet…</p>`;
  if (analysis.error) {
    return html`<p class="verdict-note">${analysis.error === 'paused' ? 'Nach einer Pause lässt sich dieser Versuch nicht bewerten.' : `Die Auswertung hat nicht geklappt: ${analysis.error}`}</p>`;
  }
  const dur = duration || analysis.duration || 1;
  const segs = (analysis.segments || []).filter((s) => s.score !== null && s.t0 < dur);
  const issues = analysis.issues || [];
  return html`<div class="verdict">
    <p class="verdict-sum">${summary(analysis)}</p>
    ${segs.length > 0 && html`<div class="verdict-line" role="list" aria-label="Bewertung im Zeitverlauf">
      ${segs.map((s) => {
        const left = (Math.max(0, s.t0) / dur) * 100;
        const width = Math.max(0.6, ((Math.min(dur, s.t1) - Math.max(0, s.t0)) / dur) * 100 - 0.3);
        const what = s.bar !== undefined ? `Takt ${s.bar + (analysis.kind === 'strum' ? 1 : 0)}` : `Anschlag bei ${fmtT(s.t0)}`;
        const label = `${what}${s.chord ? ` (${s.chord})` : ''}: ${SCORE_WORD(s.score)}`;
        return html`<button type="button" role="listitem" class="verdict-seg" title=${label} aria-label=${`${label}, abspielen`}
          style=${`left:${left}%;width:${width}%;background:${scoreColor(s.score)}`} onClick=${() => playAt(Math.max(0, s.t0 - 0.15))}></button>`;
      })}
    </div>
    <p class="verdict-legend">
      <span><i style=${`background:${scoreColor(1)}`}></i>sauber</span>
      <span><i style=${`background:${scoreColor(0.55)}`}></i>kleine Fehler</span>
      <span><i style=${`background:${scoreColor(0)}`}></i>deutlich daneben</span>
      <span>Klick spielt die Stelle ab.</span>
    </p>`}
    ${issues.length > 0 && html`<ul class="verdict-issues">
      ${issues.map((i) => {
        const t = issueText(analysis, i, analysis.models || {});
        return html`<li>
          <p><strong>${t.title}</strong>${t.count && html`<span class="muted"> ${t.count}</span>`}</p>
          ${t.causes.length > 0 && html`<p class="muted small">${t.causes.length > 1 ? `Mögliche Ursachen: ${t.causes.join('; ')}.` : `${t.causes[0]}.`}</p>`}
          ${i.times?.length > 0 && html`<div class="row wrap chips">${i.times.slice(0, 8).map((x) => html`<button type="button" class="chip" onClick=${() => playAt(Math.max(0, x - 0.2))}>${fmtT(x)}</button>`)}</div>`}
        </li>`;
      })}
    </ul>`}
    ${!analysis.empty && !issues.length && html`<p class="muted small">Keine Fehler, die sich wiederholen. Einzelne Ausreißer zeigt nur der Zeitstrahl.</p>`}
  </div>`;
}

export function WavePlayer({ blob, marks, ms, analysis }) {
  const canvas = useRef(null);
  const [buffer, setBuffer] = useState(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const player = useRef({ src: null, startedAt: 0, offset: 0, raf: 0 });
  const me = useRef({});
  const current = useStore(nowPlaying);

  useEffect(() => {
    let alive = true;
    decodeBlob(blob).then((b) => alive && setBuffer(b)).catch(() => alive && setError(true));
    return () => { alive = false; stop(); };
  }, [blob]);

  useEffect(() => {
    if (current !== me.current && playing) stop(true);
  }, [current]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !buffer) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      const g = cv.getContext('2d');
      g.scale(dpr, dpr);
      const style = getComputedStyle(cv);
      const ink = style.getPropertyValue('--wave').trim();
      const played = style.getPropertyValue('--wave-played').trim();
      const tailColor = style.getPropertyValue('--wave-tail').trim();
      const count = Math.max(40, Math.floor(w / 3));
      const peaks = buildPeaks(buffer, count);
      const top = Math.max(0.02, ...peaks);
      const mid = h / 2;
      const end = marks?.timerEnd ? marks.timerEnd / 1000 / buffer.duration : 1;
      if (end < 1) {
        g.fillStyle = tailColor;
        g.fillRect(end * w, 0, w - end * w, h);
      }
      const at = pos / buffer.duration;
      for (let i = 0; i < count; i++) {
        const x = (i / count) * w;
        const v = Math.max(1, (peaks[i] / top) * (mid - 3));
        g.fillStyle = i / count <= at ? played : ink;
        g.fillRect(x, mid - v, 2, v * 2);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [buffer, pos, marks?.timerEnd]);

  function stop(keep) {
    const p = player.current;
    cancelAnimationFrame(p.raf);
    if (p.src) {
      p.src.onended = null;
      try { p.src.stop(); } catch { /* lief nicht mehr */ }
      p.src = null;
    }
    setPlaying(false);
    if (keep) setPos(p.offset);
  }

  async function play(from) {
    const c = await resumeAudio();
    stop();
    const p = player.current;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    p.offset = from;
    p.startedAt = c.currentTime;
    p.src = src;
    src.onended = () => { stop(); p.offset = 0; setPos(0); };
    src.start(0, from);
    nowPlaying.set(me.current);
    setPlaying(true);
    const tick = () => {
      const t = p.offset + (c.currentTime - p.startedAt);
      setPos(t);
      p.raf = requestAnimationFrame(tick);
    };
    p.raf = requestAnimationFrame(tick);
  }

  const toggle = () => {
    if (!buffer) return;
    if (playing) {
      const c = audioCtx();
      player.current.offset += c.currentTime - player.current.startedAt;
      stop(true);
    } else {
      play(pos >= buffer.duration ? 0 : pos);
    }
  };

  const seek = (e) => {
    if (!buffer) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * buffer.duration;
    if (playing) play(t);
    else { player.current.offset = t; setPos(t); }
  };

  if (error) return html`<p class="muted">Die Wellenform lässt sich nicht anzeigen. Du kannst die Datei trotzdem herunterladen.</p>`;
  const tailSec = marks?.timerEnd && buffer ? buffer.duration - marks.timerEnd / 1000 : 0;
  return html`<div class="wave">
    <${Button} icon=${playing ? 'pause' : 'play'} variant="round" aria-label=${playing ? 'Anhalten' : 'Abspielen'} onClick=${toggle} disabled=${!buffer}/>
    <div class="wave-body">
      <canvas ref=${canvas} class="wave-canvas" onClick=${seek} role="img" aria-label="Wellenform"></canvas>
      <div class="wave-meta">
        <span>${fmtDuration(pos * 1000)} / ${fmtDuration((buffer?.duration ?? ms / 1000) * 1000)}</span>
        ${tailSec > 0.2 && html`<span class="wave-tail-note"><i></i>Nach Timer-Ende</span>`}
      </div>
      <${Verdict} analysis=${analysis} duration=${buffer?.duration} playAt=${(t) => buffer && play(t)}/>
    </div>
  </div>`;
}

export function TakesList() {
  const list = useStore(takes);
  if (!list.length) return null;
  return html`<section class="takes" aria-label="Deine Aufnahmen in diesem Schritt">
    <h3>Gerade aufgenommen</h3>
    <p class="muted">Bleibt, bis du zum nächsten Schritt gehst. Behalte, was du später noch hören willst.</p>
    ${list.map((t, i) => html`<article class="take" key=${t.id}>
      <header class="row between">
        <strong>Versuch ${list.length - i}</strong>
        <div class="row">
          ${t.kept
            ? html`<span class="kept"><${Icon} name="check" size=${18}/> Behalten</span>`
            : html`<${Button} icon="keep" onClick=${async () => { await keepTake(t); toast('Aufnahme behalten'); }}>Behalten<//>`}
          <${Button} icon="download" aria-label="Herunterladen" onClick=${() => downloadBlob(t.blob, `${safeFileName(t.meta?.title || 'Aufnahme')}.${extensionFor(t.mime)}`)}/>
          <${Button} icon="trash" aria-label="Verwerfen" onClick=${() => removeTake(t.id)}/>
        </div>
      </header>
      <${WavePlayer} blob=${t.blob} marks=${t.marks} ms=${t.ms} analysis=${t.analysis}/>
    </article>`)}
  </section>`;
}
