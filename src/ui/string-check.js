// Saiten-Check: Akkord halten, jede Saite einzeln zupfen, pro Saite ein Ergebnis.
import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { useStore } from '../lib/core.js';
import { classifyPluck } from '../lib/analysis.js';
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
  otherString: (name) => `klingt wie die ${name}-Saite. Zupfe die markierte Saite.`,
};

// Nächste Saite ab `from`, die noch nicht sauber geklungen hat. Am Ende wieder vorne suchen.
export function nextOpen(list, results, from) {
  for (let k = 0; k < list.length; k += 1) {
    const i = (from + k) % list.length;
    if (results[list[i].string]?.status !== 'ok') return i;
  }
  return list.length; // alle sauber
}

export function StringCheck({ chord }) {
  const style = useStore(settings, (s) => s.noteNames);
  const mic = useStore(micState);
  const model = chordFor(chord);
  const playable = model ? [...model.notes].sort((a, b) => a.string - b.string) : [];
  const [on, setOn] = useState(false);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState({});
  const [tries, setTries] = useState(0); // Fehlversuche auf der aktuellen Saite
  const live = useRef({});
  live.current = { current, playable, results };
  const names = stringNames();

  useEffect(() => { setResults({}); setCurrent(0); setTries(0); }, [chord.name, chord.voicing]);

  // Eine Saite wählen: von Hand oder automatisch
  const goTo = (i) => { setCurrent(i); setTries(0); if (!on) setOn(true); };

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
              // Gewertet wird immer die markierte Saite. Erst wenn sie sauber klingt, geht es weiter.
              let result = classifyPluck({ freq: pick.freq, clarity }, target.midi, target.openMidi);
              if (result.status === 'other') {
                const m = pick.freq ? 12 * Math.log2(pick.freq / 440) + 69 : 0;
                const twin = list.find((x) => x !== target && Math.abs(m - x.midi) <= 0.4);
                if (twin) result = { status: 'otherString', string: twin.string };
              }
              setResults((r) => ({ ...r, [target.string]: result }));
              if (result.status === 'ok') {
                // Kurz das Häkchen zeigen, dann zur nächsten offenen Saite
                const done = { ...live.current.results, [target.string]: result };
                setTimeout(() => {
                  if (!alive || live.current.current !== idx) return;
                  setCurrent(nextOpen(list, done, idx + 1));
                  setTries(0);
                }, 600);
              } else {
                setTries((t) => t + 1);
              }
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
  const done = current >= playable.length;
  const target = playable[current];
  const failed = target && results[target.string] && results[target.string].status !== 'ok';
  return html`<section class="string-check" aria-label="Saiten-Check">
    <div class="row between wrap">
      <h3>Saiten-Check</h3>
      <div class="row">
        ${on && html`<${Button} onClick=${() => { setResults({}); setCurrent(0); setTries(0); }}>Von vorn<//>`}
        ${on && !done && html`<${Button} onClick=${() => goTo(nextOpen(playable, { ...results, [target.string]: { status: 'ok' } }, current + 1))}>Saite überspringen<//>`}
        <${Button} variant=${on ? 'plain' : 'primary'} icon=${on ? 'stop' : 'mic'} onClick=${() => { setOn(!on); if (!on) { setResults({}); setCurrent(0); setTries(0); } }}>${on ? 'Beenden' : 'Saiten einzeln prüfen'}<//>
      </div>
    </div>
    <p class="muted small">Halte den Akkord und zupfe die markierte Saite. Erst wenn sie sauber klingt, geht es zur nächsten. Mit einem Klick auf eine Saite prüfst du genau diese. Die Gitarre sollte gestimmt sein.</p>
    ${on && target && html`<p class="sc-now" role="status" aria-live="polite">
      ${failed
        ? html`<b>${names[target.string]}-Saite nochmal zupfen</b>${tries > 1 ? ` · ${tries}. Fehlversuch` : ''}`
        : html`<b>Zupfe die ${names[target.string]}-Saite</b>`}
    </p>`}
    ${mic.message && on && html`<p class="notice">${mic.message}</p>`}
    ${(on || Object.keys(results).length > 0) && html`<ol class="sc-list">
      ${[0, 1, 2, 3, 4, 5].map((s) => {
        const n = model.notes.find((x) => x.string === s);
        if (!n) return html`<li class="sc-row muted"><b>${names[s]}</b><span>nicht anschlagen</span></li>`;
        const i = playable.indexOf(n);
        const r = results[s];
        const now = on && i === current;
        const text = !r ? (now ? 'Jetzt zupfen' : '')
          : r.status === 'fret' ? TEXT.fret(r.delta)
          : r.status === 'other' ? TEXT.other(r.heard, style)
          : r.status === 'otherString' ? TEXT.otherString(names[r.string])
          : TEXT[r.status];
        return html`<li class=${`sc-row ${now ? 'now' : ''} ${r ? `st-${r.status}` : ''}`}>
          <button type="button" class="sc-pick" aria-current=${now ? 'step' : undefined} onClick=${() => goTo(i)} aria-label=${`${names[s]}-Saite prüfen`}><b>${names[s]}</b></button>
          <span class="sc-note">${noteLabel(n.midi, style)}${n.fret ? `, Bund ${n.fret}` : ', leer'}</span>
          <span class="sc-result">${r?.status === 'ok' ? '✓ ' : r ? '✗ ' : ''}${text}</span>
        </li>`;
      })}
    </ol>`}
    ${on && done && html`<p role="status" class="sc-done">${playable.every((n) => results[n.string]?.status === 'ok') ? 'Alle Saiten klingen sauber. Schlag jetzt den ganzen Akkord an.' : 'Durch, aber übersprungene Saiten sind noch offen. Klicke auf eine Saite, um sie zu prüfen.'}</p>`}
  </section>`;
}
