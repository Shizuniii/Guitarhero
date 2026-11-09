// Saiten-Check: Akkord halten, jede Saite einzeln zupfen, pro Saite ein Ergebnis.
import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { useStore } from '../lib/core.js';
import { assignPluck } from '../lib/analysis.js';
import { chordFor } from '../lib/analyze.js';
import { rms } from '../lib/dsp.js';
import { acquireMic, micAnalyser, micState, releaseMic } from '../lib/mic.js';
import { detectPitch, midiToFreq, noteLabel } from '../lib/pitch.js';
import { settings } from '../lib/state.js';
import { Button } from './common.js';
import { stringNames } from './chord.js';

const TEXT = {
  ok: 'klingt sauber',
  dead: 'kein klarer Ton: gedämpft oder schnarrt',
  open: 'klingt leer, der Finger drückt nicht',
  fret: (d) => `${Math.abs(d) === 1 ? 'einen Bund' : `${Math.abs(d)} Bünde`} zu ${d > 0 ? 'hoch' : 'tief'}`,
  other: (m, style) => `falscher Ton (${noteLabel(m, style)}). Richtige Saite gezupft?`,
};

export function StringCheck({ chord }) {
  const style = useStore(settings, (s) => s.noteNames);
  const mic = useStore(micState);
  const model = chordFor(chord);
  const playable = model ? [...model.notes].sort((a, b) => a.string - b.string) : [];
  const [on, setOn] = useState(false);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState({});
  const live = useRef({});
  live.current = { current, playable };

  useEffect(() => { setResults({}); setCurrent(0); }, [chord.name, chord.voicing]);

  useEffect(() => {
    if (!on) return undefined;
    let alive = true;
    let timer = 0;
    let holding = false;
    (async () => {
      try {
        await acquireMic();
        holding = true;
        const analyser = await micAnalyser();
        const buf = new Float32Array(analyser.fftSize);
        const sr = analyser.context.sampleRate;
        let phase = 'wait';
        let since = 0;
        const recent = [];
        let noise = 0.002;
        let reads = [];
        timer = setInterval(() => {
          if (!alive) return;
          analyser.getFloatTimeDomainData(buf);
          const level = rms(buf, buf.length - 2048, 2048);
          const now = performance.now();
          const { current: idx, playable: list } = live.current;
          const target = list[idx];
          if (!target) return;
          // Neuer Anschlag: Pegel steigt deutlich über das Minimum der letzten Viertelsekunde.
          recent.push(level);
          if (recent.length > 8) recent.shift();
          const low = Math.min(...recent);
          if (phase === 'wait') {
            // Grundrauschen folgt schnell nach unten und nur langsam nach oben, damit klingende Saiten es nicht anheben.
            noise = level < noise ? level : Math.min(0.01, noise * 0.995 + level * 0.005);
            if (recent.length >= 4 && level > Math.max(0.004, noise * 3) && level > low * 1.6) { phase = 'listen'; since = now; reads = []; }
          } else if (phase === 'listen') {
            const age = now - since;
            if (age >= 110) {
              const lo = midiToFreq(Math.min(...list.map((s) => s.midi)));
              const hi = midiToFreq(Math.max(...list.map((s) => s.midi)));
              reads.push(detectPitch(buf, sr, { minHz: lo / 1.3, maxHz: hi * 2.3 }));
            }
            if (age >= 330 || reads.length >= 4) {
              const good = reads.filter((r) => r.freq > 0).sort((a, b) => a.freq - b.freq);
              const pick = good[Math.floor(good.length / 2)] || { freq: 0, clarity: 0 };
              const clarity = good.length ? good.reduce((s, r) => s + r.clarity, 0) / good.length : 0;
              const { string: hit, result } = assignPluck({ freq: pick.freq, clarity }, list, idx);
              setResults((r) => {
                const next = { ...r, [hit]: result };
                // Weiter zur nächsten Saite, die noch nicht sauber geklungen hat.
                if (hit === target.string) {
                  let k = idx + 1;
                  while (k < list.length && next[list[k].string]?.status === 'ok') k++;
                  setCurrent(k);
                }
                return next;
              });
              phase = 'rest';
              since = now;
            }
          } else if (phase === 'rest' && now - since > 380) {
            phase = 'wait';
            recent.length = 0;
          }
        }, 30);
      } catch {
        setOn(false);
      }
    })();
    return () => {
      alive = false;
      clearInterval(timer);
      if (holding) releaseMic();
    };
  }, [on]);

  if (!model) return null;
  const names = stringNames();
  const done = current >= playable.length;
  return html`<section class="string-check" aria-label="Saiten-Check">
    <div class="row between wrap">
      <h3>Saiten-Check</h3>
      <div class="row">
        ${on && html`<${Button} onClick=${() => { setResults({}); setCurrent(0); }}>Von vorn<//>`}
        <${Button} variant=${on ? 'plain' : 'primary'} icon=${on ? 'stop' : 'mic'} onClick=${() => { setOn(!on); if (!on) { setResults({}); setCurrent(0); } }}>${on ? 'Beenden' : 'Saiten einzeln prüfen'}<//>
      </div>
    </div>
    <p class="muted small">Halte den Akkord und zupfe jede Saite einzeln, von der tiefsten zur höchsten. Die Gitarre sollte gestimmt sein.</p>
    ${mic.message && on && html`<p class="notice">${mic.message}</p>`}
    ${(on || Object.keys(results).length > 0) && html`<ol class="sc-list">
      ${[0, 1, 2, 3, 4, 5].map((s) => {
        const n = model.notes.find((x) => x.string === s);
        if (!n) return html`<li class="sc-row muted"><b>${names[s]}</b><span>nicht anschlagen</span></li>`;
        const i = playable.indexOf(n);
        const r = results[s];
        const now = on && i === current;
        const text = !r ? (now ? 'Jetzt zupfen' : '') : r.status === 'fret' ? TEXT.fret(r.delta) : r.status === 'other' ? TEXT.other(r.heard, style) : TEXT[r.status];
        return html`<li class=${`sc-row ${now ? 'now' : ''} ${r ? `st-${r.status}` : ''}`}>
          <button type="button" class="sc-pick" disabled=${!on} onClick=${() => setCurrent(i)} aria-label=${`${names[s]}-Saite neu prüfen`}><b>${names[s]}</b></button>
          <span class="sc-note">${noteLabel(n.midi, style)}${n.fret ? `, Bund ${n.fret}` : ', leer'}</span>
          <span class="sc-result">${r?.status === 'ok' ? '✓ ' : r ? '✗ ' : ''}${text}</span>
        </li>`;
      })}
    </ol>`}
    ${on && done && html`<p role="status">${Object.values(results).every((r) => r.status === 'ok') ? 'Alle Saiten klingen sauber.' : 'Fertig. Klicke auf eine Saite, um sie nochmal zu prüfen.'}</p>`}
  </section>`;
}
