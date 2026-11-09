// Griffbild, Tab-Spalte und Akkord-Eingabe.
import { html, useEffect, useMemo, useState } from '../../vendor/htm-preact.js';
import { useStore } from '../lib/core.js';
import { absoluteFrets, allChordIds, displayChordName, fromInput, normalizeChordName, parseChordName, voicingMidi, voicingsFor } from '../lib/chords.js';
import { customChords, settings } from '../lib/state.js';
import { previewChord } from '../lib/synth.js';
import { Button } from './common.js';

const STRINGS_INTL = ['E', 'A', 'D', 'G', 'B', 'e'];
const STRINGS_DE = ['E', 'A', 'D', 'G', 'H', 'e'];

export const stringNames = () => (settings.get().noteNames === 'de' ? STRINGS_DE : STRINGS_INTL);

export function ChordDiagram({ voicing, width = 240, onToggle, onTop, frets: fretCount }) {
  const count = fretCount || Math.max(4, ...voicing.f.map((f) => f));
  const pad = { l: 34, r: 16, t: 42, b: 30 };
  const stringGap = 38;
  const fretGap = 50;
  const w = pad.l + pad.r + stringGap * 5;
  const h = pad.t + pad.b + fretGap * count;
  const x = (s) => pad.l + s * stringGap;
  const y = (f) => pad.t + (f - 0.5) * fretGap;
  const names = stringNames();
  const isNut = voicing.b === 1;

  return html`<svg class="chord" viewBox=${`0 0 ${w} ${h}`} width=${width} role="img"
    aria-label=${`Griffbild, Bünde ${absoluteFrets(voicing).map((f) => (f < 0 ? 'x' : f)).join(' ')}`}>
    ${!isNut && html`<text class="chord-base" x=${pad.l - 12} y=${y(1) + 6} text-anchor="end">${voicing.b}</text>`}
    <rect class=${isNut ? 'chord-nut' : 'chord-fret'} x=${x(0) - 1} y=${pad.t - (isNut ? 7 : 1)} width=${stringGap * 5 + 2} height=${isNut ? 8 : 2}/>
    ${Array.from({ length: count }, (_, i) => html`<rect class="chord-fret" x=${x(0)} y=${pad.t + (i + 1) * fretGap - 1} width=${stringGap * 5} height="2"/>`)}
    ${names.map((_, s) => html`<rect class="chord-string" x=${x(s) - (2.6 - s * 0.32) / 2} y=${pad.t} width=${2.6 - s * 0.32} height=${fretGap * count}/>`)}
    ${voicing.f.map((f, s) => (f <= 0 ? html`<g class=${`chord-top ${onTop ? 'hit' : ''}`} onClick=${() => onTop?.(s)}>
      ${onTop && html`<rect x=${x(s) - 16} y="2" width="32" height="32" fill="transparent"/>`}
      ${f < 0
        ? html`<path class="chord-mute" d=${`M${x(s) - 7} 13l14 14m0-14l-14 14`}/>`
        : html`<circle class="chord-open" cx=${x(s)} cy="20" r="7.5"/>`}
    </g>` : null))}
    ${voicing.r?.map((fret) => {
      const on = voicing.f.map((f, s) => (f === fret ? s : -1)).filter((s) => s >= 0);
      if (on.length < 2) return null;
      const a = Math.min(...on);
      const b = Math.max(...on);
      return html`<rect class="chord-barre" x=${x(a) - 15} y=${y(fret) - 15} width=${x(b) - x(a) + 30} height="30" rx="15"/>`;
    })}
    ${voicing.f.map((f, s) => (f > 0 ? html`<g>
      <circle class="chord-dot" cx=${x(s)} cy=${y(f)} r="15"/>
      ${voicing.g?.[s] > 0 && html`<text class="chord-finger" x=${x(s)} y=${y(f) + 6} text-anchor="middle">${voicing.g[s]}</text>`}
    </g>` : null))}
    ${names.map((n, s) => html`<text class="chord-name" x=${x(s)} y=${h - 8} text-anchor="middle">${n}</text>`)}
    ${onToggle && names.map((_, s) => Array.from({ length: count }, (__, i) => html`<rect class="chord-hit" x=${x(s) - 18} y=${pad.t + i * fretGap} width="36" height=${fretGap} fill="transparent" onClick=${() => onToggle(s, i + 1)}/>`))}
  </svg>`;
}

export function TabColumn({ voicing }) {
  const frets = absoluteFrets(voicing);
  const names = stringNames();
  const width = Math.max(...frets.map((f) => String(Math.max(f, 0)).length));
  const lines = [5, 4, 3, 2, 1, 0].map((s) => {
    const f = frets[s] < 0 ? 'x' : String(frets[s]);
    return `${names[s]}|--${f.padEnd(width, '-')}--|`;
  });
  return html`<pre class="tab-col" aria-label="Tab">${lines.join('\n')}</pre>`;
}

export function SoundButton({ voicing, size }) {
  return html`<${Button} icon="sound" size=${size} onClick=${() => previewChord(voicingMidi(voicing))}>Anhören<//>`;
}

export function ChordInput({ value, onChange, label = 'Akkord', id }) {
  const names = useStore(customChords.store) && allChordIds().map(displayChordName);
  useStore(settings, (s) => s.noteNames);
  const [text, setText] = useState(value ? displayChordName(value) : '');
  useEffect(() => setText(value ? displayChordName(value) : ''), [value]);
  const listId = useMemo(() => `chords-${id || Math.random().toString(36).slice(2)}`, [id]);
  const commit = () => {
    const v = fromInput(text);
    if (!v) return;
    onChange(voicingsFor(v).length ? normalizeChordName(v) : v);
  };
  const unknown = text.trim() && !voicingsFor(fromInput(text)).length;
  return html`<label class="field chord-input">
    <span class="field-label">${label}</span>
    <input type="text" list=${listId} value=${text} placeholder="zum Beispiel Am7" autocomplete="off" spellcheck="false"
      onInput=${(e) => {
        const v = e.currentTarget.value;
        setText(v);
        const id = fromInput(v);
        if (voicingsFor(id).length && parseChordName(id)) onChange(normalizeChordName(id));
      }}
      onBlur=${commit} onKeyDown=${(e) => e.key === 'Enter' && commit()}/>
    <datalist id=${listId}>${names.slice(0, 700).map((n) => html`<option value=${n}/>`)}</datalist>
    ${unknown && html`<span class="field-hint warn">Diesen Akkord kenne ich nicht. Unter Akkorde kannst du einen eigenen Griff anlegen.</span>`}
  </label>`;
}

export function VoicingPicker({ chord, onChange }) {
  const list = voicingsFor(chord.name);
  const index = Math.min(chord.voicing || 0, Math.max(0, list.length - 1));
  if (list.length < 2) return null;
  return html`<div class="row voicing">
    <${Button} icon="prev" aria-label="Vorheriger Griff" onClick=${() => onChange((index - 1 + list.length) % list.length)}/>
    <span class="muted">Griff ${index + 1} von ${list.length}</span>
    <${Button} icon="next" aria-label="Nächster Griff" onClick=${() => onChange((index + 1) % list.length)}/>
  </div>`;
}

export function ChordCard({ chord, onVoicing, size = 260, showTab = true }) {
  useStore(settings, (s) => s.noteNames);
  const list = voicingsFor(chord.name);
  const v = list[Math.min(chord.voicing || 0, list.length - 1)];
  if (!v) return html`<div class="chord-missing"><h2>${chord.name}</h2><p class="muted">Für diesen Namen gibt es keinen Griff.</p></div>`;
  return html`<figure class="chord-card">
    <figcaption class="chord-title">${displayChordName(chord.name)}</figcaption>
    <div class="chord-body">
      <${ChordDiagram} voicing=${v} width=${size}/>
      ${showTab && html`<div class="chord-side">
        <${TabColumn} voicing=${v}/>
        <${SoundButton} voicing=${v}/>
      </div>`}
    </div>
    ${onVoicing && html`<${VoicingPicker} chord=${chord} onChange=${onVoicing}/>`}
  </figure>`;
}
