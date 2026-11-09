import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { uid, useStore } from '../lib/core.js';
import { voicingMidi, voicingsFor } from '../lib/chords.js';
import { countInBeats, metronome, nextBarStart, onMetronomeSchedule, setMetronome, startMetronome, stopMetronome, toggleMetronome } from '../lib/metronome.js';
import { patterns, settings, updateSettings } from '../lib/state.js';
import { muteHit, strum } from '../lib/synth.js';
import { useTimerRecording } from '../lib/take-control.js';
import { setCountdownSync, timer, timerEvents } from '../lib/timer.js';
import { latency } from '../lib/analyze.js';
import { toast } from '../lib/ui-state.js';
import { ChordInput } from '../ui/chord.js';
import { Button, confirmDialog, Field, Modal, Segmented, Stepper, Toggle } from '../ui/common.js';
import { Icon } from '../ui/icons.js';
import { MetronomeFace } from '../ui/metronome-face.js';
import { TimerFace } from '../ui/timer-face.js';
import { TakesList } from '../ui/wave.js';
import { useStepTimer } from './common.js';

const NEXT = { D: 'U', U: '-', '-': 'X', X: 'D' };
const SUB_LABELS = { 1: [''], 2: ['', '+'], 3: ['', '+', 'a'], 4: ['', 'e', '+', 'a'] };
const STATE_LABEL = { D: 'Abschlag', U: 'Aufschlag', '-': 'leer', X: 'gedämpft' };

export function slotLabel(i, perBeat) {
  const sub = i % perBeat;
  return sub === 0 ? String(i / perBeat + 1) : SUB_LABELS[perBeat][sub];
}

function regrid(p, perBeat, beats) {
  const out = [];
  for (let b = 0; b < beats; b++) {
    for (let s = 0; s < perBeat; s++) {
      const srcIndex = b * p.perBeat + Math.round((s * p.perBeat) / perBeat);
      const exact = (s * p.perBeat) % perBeat === 0;
      out.push(exact && b < p.beats ? p.slots[srcIndex] || '-' : '-');
    }
  }
  return out;
}

function StrumCell({ slot, label, active, beat, onClick }) {
  return html`<button type="button" class=${`strum-cell s-${slot === '-' ? 'empty' : slot} ${active ? 'hit' : ''} ${beat ? 'beat' : ''}`} aria-label=${`Zählzeit ${label}: ${STATE_LABEL[slot]}`} onClick=${onClick}>
    <span class="strum-mark">
      ${slot === 'D' && html`<${Icon} name="down" size=${38}/>`}
      ${slot === 'U' && html`<${Icon} name="up" size=${38}/>`}
      ${slot === 'X' && html`<${Icon} name="close" size=${32}/>`}
    </span>
    <span class="strum-count">${label}</span>
  </button>`;
}

export function StrumStep({ step, onConfig }) {
  const c = step.config;
  const list = useStore(patterns.store);
  const lastId = useStore(settings, (s) => s.lastPatternId);
  const pattern = list.find((p) => p.id === c.patternId) || list.find((p) => p.id === lastId) || list[0];
  const bpm = useStore(metronome, (m) => m.bpm);
  const running = useStore(metronome, (m) => m.running);
  const pos = useStore(metronome, (m) => m.pos.index);
  const [naming, setNaming] = useState(null);
  const [playAlong, setPlayAlong] = useState(false);
  const chord = c.chord || { name: 'Am', voicing: 0 };
  const live = useRef({});
  live.current = { pattern, playAlong, chord };

  useStepTimer(c.seconds, { m: toggleMetronome });
  const ticks = useRef([]);
  useTimerRecording(() => {
    const lat = latency();
    return {
      type: 'strum', title: pattern?.name || 'Strum', patternId: pattern?.id, bpm: metronome.get().bpm,
      analysis: pattern ? { kind: 'strum', ticks: [...ticks.current], slots: pattern.slots, perBeat: pattern.perBeat, latency: lat.sec, calibrated: lat.calibrated } : null,
    };
  });

  // Metronom gehört diesem Schritt: Taktart und Raster kommen vom Muster, das Tempo bleibt pro Schritt erhalten.
  useEffect(() => {
    const before = metronome.get();
    if (c.bpm) setMetronome({ bpm: c.bpm }, { save: false });
    return () => {
      stopMetronome();
      setMetronome({ bpm: before.bpm, beatsPerBar: before.beatsPerBar, clickDiv: before.clickDiv, grid: before.clickDiv });
    };
  }, []);

  useEffect(() => {
    if (!pattern) return;
    setMetronome({ beatsPerBar: pattern.beats, grid: pattern.perBeat }, { save: false });
  }, [pattern?.id, pattern?.perBeat, pattern?.beats]);

  useEffect(() => {
    if (bpm !== c.bpm) onConfig({ bpm });
  }, [bpm]);

  useEffect(() => {
    const offs = [
      // Das Metronom zählt während des Countdowns ein, und der Countdown endet genau auf Schlag 1 des Musters.
      setCountdownSync(async (seconds) => {
        if (metronome.get().running) return nextBarStart(seconds);
        return startMetronome({ preBeats: countInBeats(seconds) });
      }),
      timerEvents.on('prepare', () => { ticks.current = []; }),
      timerEvents.on('run', () => startMetronome()),
      timerEvents.on('end', () => stopMetronome()),
      timerEvents.on('stop', () => stopMetronome()),
      onMetronomeSchedule((tick) => {
        if (tick.index < 0) return; // Einzählen: nur Klicks
        if (['countdown', 'running'].includes(timer.get().phase)) ticks.current.push({ time: tick.time, index: tick.index });
        const l = live.current;
        if (!l.playAlong || !l.pattern) return;
        const slot = l.pattern.slots[tick.index % l.pattern.slots.length];
        const v = voicingsFor(l.chord.name)[l.chord.voicing || 0];
        if (!v) return;
        if (slot === 'D' || slot === 'U') strum(voicingMidi(v), { direction: slot, time: tick.time, duration: 0.9 });
        else if (slot === 'X') muteHit({ time: tick.time });
      }),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  function select(id) {
    onConfig({ patternId: id });
    updateSettings({ lastPatternId: id });
  }

  const savePattern = (next) => patterns.put(next);

  function cycle(i) {
    const slots = [...pattern.slots];
    slots[i] = NEXT[slots[i]];
    savePattern({ ...pattern, slots });
  }

  async function createPattern(name, copy) {
    const base = copy ? pattern : { beats: 4, perBeat: 2, slots: Array(8).fill('-') };
    const made = await patterns.put({ id: uid(), name, beats: base.beats, perBeat: base.perBeat, slots: [...base.slots] });
    select(made.id);
    setNaming(null);
  }

  async function remove() {
    if (list.length < 2) { toast('Ein Muster muss bleiben.', 'warn'); return; }
    const ok = await confirmDialog({ title: 'Muster löschen', text: `„${pattern.name}“ wird gelöscht.` });
    if (!ok) return;
    await patterns.remove(pattern.id);
    select(patterns.all()[0].id);
  }

  if (!pattern) return null;
  const index = running && pos >= 0 ? pos % pattern.slots.length : -1;

  return html`<div class="step step-strum">
    <div class="row wrap strum-head">
      <${Field} label="Gespeichertes Muster">
        <select value=${pattern.id} onChange=${(e) => select(e.currentTarget.value)}>
          ${list.map((p) => html`<option value=${p.id}>${p.name}</option>`)}
        </select>
      <//>
      <${Button} icon="plus" onClick=${() => setNaming({ name: '', copy: false })}>Neues Muster<//>
      <${Button} onClick=${() => setNaming({ name: `${pattern.name} Kopie`, copy: true })}>Kopieren<//>
      <${Button} onClick=${() => setNaming({ name: pattern.name, rename: true })}>Umbenennen<//>
      <${Button} icon="trash" aria-label="Muster löschen" onClick=${remove}/>
    </div>

    <div class="strum-grid" style=${`--cols:${pattern.slots.length};--per:${pattern.perBeat}`} role="group" aria-label="Strum-Muster, klicke ein Feld zum Ändern">
      ${pattern.slots.map((slot, i) => html`<${StrumCell} slot=${slot} label=${slotLabel(i, pattern.perBeat)} active=${i === index} beat=${i % pattern.perBeat === 0} onClick=${() => cycle(i)}/>`)}
    </div>
    <p class="muted small">Klick auf ein Feld wechselt zwischen Abschlag, Aufschlag, leer und gedämpft.</p>

    <div class="row wrap strum-options">
      <${Field} label="Raster">
        <${Segmented} label="Raster" value=${pattern.perBeat} onChange=${(v) => savePattern({ ...pattern, perBeat: v, slots: regrid(pattern, v, pattern.beats) })}
          options=${[{ value: 2, label: 'Achtel' }, { value: 4, label: '16tel' }, { value: 3, label: 'Triolen' }]}/>
      <//>
      <${Field} label="Schläge pro Takt">
        <${Stepper} label="Schläge" value=${pattern.beats} min=${2} max=${7} onChange=${(v) => savePattern({ ...pattern, beats: v, slots: regrid(pattern, pattern.perBeat, v) })}/>
      <//>
      <${ChordInput} value=${chord.name} label="Akkord zum Mitspielen" onChange=${(name) => onConfig({ chord: { name, voicing: 0 } })}/>
      <${Toggle} checked=${playAlong} onChange=${setPlayAlong}>Muster mit Gitarrenklang vorspielen<//>
    </div>

    <div class="step-main strum-tools">
      <${MetronomeFace} compact/>
      <${TimerFace}/>
    </div>
    <${TakesList}/>

    ${naming && html`<${Modal} title=${naming.rename ? 'Muster umbenennen' : 'Muster anlegen'} onClose=${() => setNaming(null)}>
      <${Field} label="Name">
        <input type="text" value=${naming.name} onInput=${(e) => setNaming({ ...naming, name: e.currentTarget.value })}/>
      <//>
      <div class="row end">
        <${Button} onClick=${() => setNaming(null)}>Abbrechen<//>
        <${Button} variant="primary" disabled=${!naming.name.trim()} onClick=${() => {
          if (naming.rename) { savePattern({ ...pattern, name: naming.name.trim() }); setNaming(null); }
          else createPattern(naming.name.trim(), naming.copy);
        }}>Speichern<//>
      </div>
    <//>`}
  </div>`;
}
