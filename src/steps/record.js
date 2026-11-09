import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { fmtDuration, useStore } from '../lib/core.js';
import { micAnalyser, micState } from '../lib/mic.js';
import { loadRecordingBlob, saveRecording, startRecording } from '../lib/recorder.js';
import { logPractice, recordings, scores } from '../lib/state.js';
import { analyze, chordFor } from '../lib/analyze.js';
import { ChordCard } from '../ui/chord.js';
import { WavePlayer } from '../ui/wave.js';
import { setHotkeys, toast } from '../lib/ui-state.js';
import { Button, Field } from '../ui/common.js';
import { MicSelect } from '../ui/tuner.js';

export function LevelMeter({ active }) {
  const bar = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let alive = true;
    (async () => {
      const analyser = await micAnalyser();
      const buf = new Float32Array(2048);
      const frame = () => {
        if (!alive) return;
        analyser.getFloatTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
        if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, peak * 1.3)})`;
        raf = requestAnimationFrame(frame);
      };
      frame();
    })().catch(() => {});
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [active]);
  return html`<div class="level" aria-hidden="true"><i ref=${bar}></i></div>`;
}

function LastRecording({ id }) {
  const rec = useStore(recordings.store, (l) => l.find((r) => r.id === id));
  const [blob, setBlob] = useState(null);
  useEffect(() => { loadRecordingBlob(id).then(setBlob); }, [id]);
  if (!rec || !blob) return null;
  return html`<section class="takes"><h3>Gerade aufgenommen: ${rec.title}</h3><p class="muted small">Gespeichert unter Aufnahmen.</p><${WavePlayer} blob=${blob} marks=${rec.marks} ms=${rec.ms} analysis=${rec.analysis}/></section>`;
}

export function RecordPanel({ title: presetTitle, scoreId: presetScore, onScore, chord }) {
  const [rec, setRec] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState(presetTitle || '');
  const [lastId, setLastId] = useState(null);
  const list = useStore(scores.store);
  const mic = useStore(micState);
  const scoreId = presetScore || '';
  const ref = useRef(null);
  ref.current = rec;

  useEffect(() => {
    if (!rec) return undefined;
    const id = setInterval(() => setElapsed(rec.elapsed()), 200);
    return () => clearInterval(id);
  }, [rec]);

  useEffect(() => () => ref.current?.cancel(), []);

  async function start() {
    try {
      setElapsed(0);
      setRec(await startRecording({ tap: Boolean(chord) }));
    } catch {
      toast(micState.get().message || 'Die Aufnahme ließ sich nicht starten.', 'warn', 7000);
    }
  }

  async function stop() {
    const r = rec;
    setRec(null);
    const { audio, ...result } = await r.stop();
    const song = scores.find(scoreId);
    const saved = await saveRecording({ ...result, title: title.trim() || song?.title || 'Aufnahme', meta: { type: 'record', scoreId: scoreId || undefined, title: song?.title, chord: chord?.name } });
    setLastId(saved.id);
    const model = chord ? chordFor(chord) : null;
    if (model && audio?.samples.length) {
      recordings.put({ ...saved, analysis: { pending: true } });
      analyze({ kind: 'chord', chord: model, samples: audio.samples, sampleRate: audio.sampleRate, startTime: audio.startTime })
        .then((a) => recordings.put({ ...recordings.find(saved.id), analysis: { ...a, models: { _: model } } }))
        .catch((e) => recordings.put({ ...recordings.find(saved.id), analysis: { error: e.message } }));
    }
    logPractice({ type: 'record', title: title || 'Aufnahme', seconds: result.ms / 1000 });
    toast('Aufnahme gespeichert');
  }

  const toggle = () => (rec ? stop() : start());
  useEffect(() => {
    setHotkeys({ ' ': toggle });
    return () => setHotkeys({});
  });

  return html`<div class="stack"><section class="record-panel" aria-label="Neue Aufnahme">
    <button type="button" class=${`rec-button ${rec ? 'on' : ''}`} aria-pressed=${Boolean(rec)} onClick=${toggle}>
      <i aria-hidden="true"></i><span>${rec ? 'Stoppen' : 'Aufnehmen'}</span>
    </button>
    <div class="record-info">
      <div class="record-time">${fmtDuration(elapsed)}</div>
      <${LevelMeter} active=${Boolean(rec)}/>
      ${mic.message && html`<p class="notice" role="alert">${mic.message}</p>`}
      <div class="row wrap">
        <${Field} label="Titel"><input type="text" value=${title} placeholder="Aufnahme" onInput=${(e) => setTitle(e.currentTarget.value)}/><//>
        <${Field} label="Zu Song oder Riff">
          <select value=${scoreId} onChange=${(e) => onScore?.(e.currentTarget.value)}>
            <option value="">Keine Verknüpfung</option>
            ${list.map((s) => html`<option value=${s.id}>${s.title}</option>`)}
          </select>
        <//>
        <${MicSelect}/>
      </div>
      <p class="muted small">Diese Aufnahmen bleiben gespeichert, bis du sie selbst löschst.</p>
    </div>
  </section>
  ${lastId && html`<${LastRecording} key=${lastId} id=${lastId}/>`}</div>`;
}

export function RecordStep({ step, onConfig }) {
  const chord = step.config.chord;
  return html`<div class="step step-record">
    ${chord && html`<${ChordCard} chord=${chord} size=${200}/>`}
    <${RecordPanel} key=${step.id} title=${step.config.label} chord=${chord} scoreId=${step.config.scoreId} onScore=${(id) => onConfig({ scoreId: id })}/>
  </div>`;
}
