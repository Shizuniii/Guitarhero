import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { fmtDate, fmtTime, useStore } from '../lib/core.js';
import { LiveChangeCounter } from '../lib/analysis.js';
import { chordFor } from '../lib/analyze.js';
import { displayChordName } from '../lib/chords.js';
import { liveChunks, takes } from '../lib/recorder.js';
import { records, settings } from '../lib/state.js';
import { useTimerRecording } from '../lib/take-control.js';
import { timer, timerEvents } from '../lib/timer.js';
import { toast } from '../lib/ui-state.js';
import { ChordCard, ChordInput } from '../ui/chord.js';
import { Button, Stepper } from '../ui/common.js';
import { TimerFace } from '../ui/timer-face.js';
import { TakesList } from '../ui/wave.js';
import { useStepTimer } from './common.js';

export const recordKey = (a, b, seconds) => `${[a, b].sort().join('|')}|${seconds}`;

export function ChangeStep({ step, onConfig }) {
  const c = step.config;
  const a = c.a || { name: 'Am', voicing: 0 };
  const b = c.b || { name: 'C', voicing: 0 };
  const seconds = useStore(timer, (t) => t.duration);
  const phase = useStore(timer, (t) => t.phase);
  const all = useStore(records.store);
  const latest = useStore(takes, (l) => l[0]);
  const [auto, setAuto] = useState(0);
  const [adjust, setAdjust] = useState(0);
  const [entry, setEntry] = useState(null);
  const [saved, setSaved] = useState(false);
  const counter = useRef(null);
  const key = recordKey(a.name, b.name, seconds);
  const record = all.find((r) => r.id === key);
  const best = record?.best || 0;
  const count = Math.max(0, auto + adjust);

  const bump = () => setAdjust((n) => n + 1);
  useStepTimer(c.seconds, { Enter: bump, '+': bump, '-': () => setAdjust((n) => n - 1) });
  useTimerRecording(() => {
    const A = chordFor(a);
    const B = chordFor(b);
    return {
      type: 'change', title: `${a.name} und ${b.name}`, chordA: a.name, chordB: b.name,
      analysis: A && B ? { kind: 'change', a: A, b: B, models: { [A.name]: A, [B.name]: B } } : null,
    };
  });

  useEffect(() => {
    const offs = [
      timerEvents.on('countdown', () => { setAuto(0); setAdjust(0); setEntry(null); setSaved(false); counter.current = null; }),
      liveChunks.on('chunk', ({ data, sampleRate }) => {
        if (timer.get().phase !== 'running') return;
        if (!counter.current) {
          const A = chordFor(a);
          const B = chordFor(b);
          if (!A || !B) return;
          counter.current = new LiveChangeCounter(A, B, sampleRate, settings.get().guitar);
        }
        const n = counter.current.push(data);
        setAuto((prev) => (prev === n ? prev : n));
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [a.name, a.voicing, b.name, b.voicing]);

  // Die gründlichere Auswertung nach dem Timer zählt genauer als die Live-Anzeige.
  useEffect(() => {
    if (phase === 'finished' && !saved && entry === null) {
      const n = latest?.analysis?.count;
      if (typeof n === 'number') {
        setAuto(n);
        setEntry(Math.max(0, n + adjust));
      }
      else if (!latest?.analysis?.pending && !settings.get().recordDuringTimer) setEntry(count);
    }
  }, [phase, latest?.analysis]);

  async function save(value) {
    const at = Date.now();
    const history = [...(record?.history || []), { at, count: value, seconds }];
    const isNew = value > best;
    await records.put({
      id: key, a: a.name, b: b.name, seconds, best: Math.max(best, value), bestAt: isNew ? at : record?.bestAt, history,
      createdAt: record?.createdAt,
    });
    setSaved(true);
    toast(isNew ? `Neuer Rekord: ${value} Wechsel` : `${value} Wechsel eingetragen`, isNew ? 'good' : 'info');
  }

  const waiting = phase === 'finished' && !saved && entry === null;
  return html`<div class="step step-change">
    <div class="step-main">
      <div class="change-pair">
        <${ChordCard} chord=${a} size=${200} showTab=${false} onVoicing=${(v) => onConfig({ a: { ...a, voicing: v } })}/>
        <${ChordCard} chord=${b} size=${200} showTab=${false} onVoicing=${(v) => onConfig({ b: { ...b, voicing: v } })}/>
      </div>
      <div class="step-side">
        <${TimerFace}/>
        <section class="counter" aria-label="Wechsel zählen">
          <div class="counter-now" aria-live="polite"><b>${count}</b><span>Wechsel</span></div>
          <div class="row">
            <${Button} onClick=${() => setAdjust((n) => n - 1)} aria-label="Einen Wechsel abziehen">−1<//>
            <${Button} onClick=${bump} aria-label="Einen Wechsel dazuzählen">+1<//>
          </div>
          <p class="muted small">Zählt automatisch mit, sobald der Timer läuft. Liegt die Zahl daneben, korrigierst du mit +1 und −1 oder der Enter-Taste. Jeder Wechsel gibt einen Punkt: C nach G ist 1, zurück nach C ist 2.</p>
          ${waiting && html`<p class="muted" role="status">Wird ausgezählt…</p>`}
          ${phase === 'finished' && !saved && entry !== null && html`<div class="stack">
            <p>Gezählt: <b>${entry}</b> Wechsel. Stimmt das?</p>
            <div class="row wrap">
              <${Stepper} label="Wechsel" value=${entry} min=${0} max=${999} onChange=${setEntry}/>
              <${Button} variant="primary" onClick=${() => save(entry)}>Eintragen<//>
            </div>
          </div>`}
          <p class="record-line">${best
            ? html`Dein Rekord in ${fmtTime(seconds)}: <b>${best}</b> am ${fmtDate(record.bestAt)}`
            : `Noch kein Rekord für ${displayChordName(a.name)} und ${displayChordName(b.name)} in ${fmtTime(seconds)}`}</p>
        </section>
      </div>
    </div>
    <div class="row wrap">
      <${ChordInput} id="a" value=${a.name} label="Erster Akkord" onChange=${(name) => onConfig({ a: { name, voicing: 0 } })}/>
      <${ChordInput} id="b" value=${b.name} label="Zweiter Akkord" onChange=${(name) => onConfig({ b: { name, voicing: 0 } })}/>
    </div>
    <${TakesList}/>
  </div>`;
}
