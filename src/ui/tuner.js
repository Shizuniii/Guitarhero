import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { useStore } from '../lib/core.js';
import { acquireMic, deviceLabel, micAnalyser, micState, refreshDevices, releaseMic, selectMic, VIRTUAL_MIC } from '../lib/mic.js';
import { centsBetween, detectPitch, freqToMidi, midiToFreq, noteLabel, TUNINGS, tuningById } from '../lib/pitch.js';
import { settings, updateSettings } from '../lib/state.js';
import { Button, Field, Stepper, Toggle } from './common.js';
import { stringNames } from './chord.js';

const IN_TUNE = 5;
const HOLD_MS = 1200;

export function MicSelect() {
  const mic = useStore(micState);
  const current = useStore(settings, (s) => s.micDeviceId);
  useEffect(() => { refreshDevices(); }, []);
  const label = deviceLabel(current);
  const virtual = VIRTUAL_MIC.test(label);
  return html`<${Field} label="Mikrofon">
    <select value=${current} onChange=${(e) => selectMic(e.currentTarget.value)}>
      <option value="">Standard-Mikrofon</option>
      ${mic.devices.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications').map((d, i) => html`<option value=${d.deviceId}>${d.label || `Mikrofon ${i + 1}`}</option>`)}
    </select>
    ${virtual && html`<span class="field-hint warn">„${label}“ ist ein virtuelles Gerät mit Filtern, die Gitarrentöne verschlucken können. Wähle dein echtes Mikrofon, zum Beispiel das Fifine.</span>`}
  <//>`;
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function TunerFace() {
  const cfg = useStore(settings, (s) => s.tuner);
  const noteStyle = useStore(settings, (s) => s.noteNames);
  const mic = useStore(micState);
  const micDevice = useStore(settings, (s) => s.micDeviceId);
  const tuning = tuningById(cfg.tuningId);
  const targets = tuning.midi.map((m) => m + (cfg.capo || 0));
  const [string, setString] = useState(0);
  const [done, setDone] = useState([]);
  const [reading, setReading] = useState(null);
  const [auto, setAuto] = useState(false);
  const [listening, setListening] = useState(false);
  const refs = useRef({ string, auto, targets, a4: cfg.a4, hold: 0, history: [] });
  refs.current.string = string;
  refs.current.auto = auto;
  refs.current.targets = targets;
  refs.current.a4 = cfg.a4;
  refs.current.autoAdvance = cfg.autoAdvance;

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let last = 0;
    let holding = false;
    (async () => {
      try {
        await acquireMic();
        holding = true;
        if (!alive) return;
        const analyser = await micAnalyser();
        const buf = new Float32Array(analyser.fftSize);
        const sr = analyser.context.sampleRate;
        setListening(true);
        const frame = (now) => {
          if (!alive) return;
          raf = requestAnimationFrame(frame);
          if (now - last < 66) return;
          last = now;
          analyser.getFloatTimeDomainData(buf);
          const r = refs.current;
          const target = midiToFreq(r.targets[r.string], r.a4);
          const window = r.auto ? { minHz: 60, maxHz: 1100 } : { minHz: target / 1.6, maxHz: target * 1.6 };
          const res = detectPitch(buf, sr, window);
          if (!res.freq || res.rms < 0.004) {
            r.history = [];
            r.hold = 0;
            setReading(null);
            return;
          }
          r.history.push(res.freq);
          if (r.history.length > 5) r.history.shift();
          if (r.history.length < 3) return;
          const freq = median(r.history);
          let idx = r.string;
          if (r.auto) {
            idx = r.targets.reduce((best, m, i) => (Math.abs(freqToMidi(freq, r.a4) - m) < Math.abs(freqToMidi(freq, r.a4) - r.targets[best]) ? i : best), 0);
            if (idx !== r.string) setString(idx);
          }
          const cents = centsBetween(freq, midiToFreq(r.targets[idx], r.a4));
          setReading({ freq, cents, midi: freqToMidi(freq, r.a4) });
          if (Math.abs(cents) <= IN_TUNE) {
            r.hold = r.hold || now;
            if (now - r.hold >= HOLD_MS) {
              r.hold = 0;
              r.history = [];
              setDone((d) => (d.includes(idx) ? d : [...d, idx]));
              if (r.autoAdvance && !r.auto && idx < 5) {
                setString(idx + 1);
                setReading(null);
              }
            }
          } else {
            r.hold = 0;
          }
        };
        raf = requestAnimationFrame(frame);
      } catch {
        setListening(false);
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (holding) releaseMic();
    };
  }, [micDevice]);

  const names = stringNames();
  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0;
  const inTune = reading && Math.abs(reading.cents) <= IN_TUNE;
  let message = 'Zupfe die markierte Saite';
  if (reading) {
    if (inTune) message = 'Passt';
    else if (reading.cents < 0) message = reading.cents < -50 ? 'Viel zu tief, dreh höher' : 'Zu tief, dreh höher';
    else message = reading.cents > 50 ? 'Viel zu hoch, dreh tiefer' : 'Zu hoch, dreh tiefer';
  }
  const allDone = done.length === 6;

  return html`<section class="tuner" aria-label="Stimmgerät">
    ${mic.message && html`<p class="notice" role="alert">${mic.message}</p>`}
    ${!listening && !mic.message && html`<p class="muted">Mikrofon wird geöffnet…</p>`}
    <div class=${`tuner-dial ${reading ? (inTune ? 'good' : 'off') : ''}`} aria-hidden="true">
      <i class="tick mid"></i><i class="tick l1"></i><i class="tick r1"></i>
      <i class="needle" style=${`transform:translateX(-50%) rotate(${cents * 0.9}deg)`}></i>
      <b>${noteLabel(targets[string], noteStyle)}</b>
    </div>
    <p class="tuner-msg" role="status" aria-live="polite">${allDone && !reading ? 'Alle sechs Saiten passen' : message}</p>
    <p class="tuner-cents muted">${reading ? `${Math.round(reading.cents) > 0 ? '+' : ''}${Math.round(reading.cents)} Cent, gehört: ${noteLabel(reading.midi, noteStyle)}` : ' '}</p>
    <div class="tuner-strings" role="group" aria-label="Saite wählen">
      ${targets.map((m, i) => html`<button type="button" class=${`${i === string ? 'on' : ''} ${done.includes(i) ? 'ok' : ''}`} aria-pressed=${i === string} onClick=${() => { setString(i); setAuto(false); }}>
        <b>${names[i]}</b><small>${noteLabel(m, noteStyle)}</small>
      </button>`)}
    </div>
    <div class="row wrap">
      <${Toggle} checked=${auto} onChange=${setAuto}>Saite automatisch erkennen<//>
      <${Toggle} checked=${cfg.autoAdvance} onChange=${(v) => updateSettings({ tuner: { autoAdvance: v } })}>Automatisch weiter zur nächsten<//>
    </div>
    <div class="tuner-settings">
      <${MicSelect}/>
      <${Field} label="Stimmung">
        <select value=${cfg.tuningId} onChange=${(e) => { updateSettings({ tuner: { tuningId: e.currentTarget.value } }); setDone([]); setString(0); }}>
          ${TUNINGS.map((t) => html`<option value=${t.id}>${t.name}</option>`)}
        </select>
      <//>
      <${Field} label="Kammerton A">
        <${Stepper} label="Kammerton" unit="Hz" value=${cfg.a4} min=${415} max=${466} onChange=${(v) => updateSettings({ tuner: { a4: v } })}/>
      <//>
      <${Field} label="Kapodaster im Bund">
        <${Stepper} label="Kapodaster" value=${cfg.capo} min=${0} max=${12} onChange=${(v) => { updateSettings({ tuner: { capo: v } }); setDone([]); }}/>
      <//>
    </div>
    <${Button} onClick=${() => { setDone([]); setString(0); }}>Von vorn beginnen<//>
  </section>`;
}
