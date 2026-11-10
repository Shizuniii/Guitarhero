// Eigener Tab-Editor: Bünde tippen, Notenwerte wählen, Effekte setzen.
import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { noteName, TUNINGS, tuningById } from '../lib/pitch.js';
import { settings } from '../lib/state.js';
import { barFill, durationTicks, emptyBar, TUPLET_NAMES } from '../lib/tabformat.js';
import { Button, Field, Stepper } from './common.js';
import { stringNames } from './chord.js';

const DURS = [
  { d: 1, label: 'Ganze' }, { d: 2, label: 'Halbe' }, { d: 4, label: 'Viertel' }, { d: 8, label: 'Achtel' }, { d: 16, label: '16tel' }, { d: 32, label: '32tel' },
];
const FX = [
  { key: 'h', label: 'Hammer-on oder Pull-off', short: 'h' },
  { key: 'sl', label: 'Slide', short: '/' },
  { key: 'b', label: 'Bend', short: 'b' },
  { key: 'v', label: 'Vibrato', short: '~' },
  { key: 'pm', label: 'Palm Mute', short: 'PM' },
  { key: 'x', label: 'Gedämpft', short: 'x' },
];
const FILL_STEPS = [
  [3840, 1, false], [2880, 2, true], [1920, 2, false], [1440, 4, true], [960, 4, false], [720, 8, true], [480, 8, false], [360, 16, true], [240, 16, false], [120, 32, false],
];

// Pausen in Triolen-Werten, für Lücken, die normale Notenwerte nicht genau füllen.
const TRIPLET_STEPS = [[2560, 1], [1280, 2], [640, 4], [320, 8], [160, 16], [80, 32]];

function restsFor(ticks) {
  const out = [];
  let left = Math.round(ticks);
  if (left % 120 !== 0 && left % 80 === 0) {
    while (left >= 80) {
      const [size, d] = TRIPLET_STEPS.find(([s]) => s <= left);
      out.push({ d, t: 3, notes: [] });
      left -= size;
    }
    return out;
  }
  while (left >= 120) {
    const [size, d, dot] = FILL_STEPS.find(([s]) => s <= left);
    out.push({ d, ...(dot ? { dot: true } : {}), notes: [] });
    left -= size;
  }
  while (left >= 80) {
    const [size, d] = TRIPLET_STEPS.find(([s]) => s <= left);
    out.push({ d, t: 3, notes: [] });
    left -= size;
  }
  return out;
}

// Gleicht eine Längenänderung hinter Spalte i aus: kürzer heißt Pausen einfügen, länger heißt folgende Pausen verbrauchen.
function fitAfter(beats, i, delta) {
  let left = delta;
  if (left > 0) {
    beats.splice(i + 1, 0, ...restsFor(left));
    return;
  }
  while (left < 0 && beats[i + 1] && !beats[i + 1].notes.length) {
    left += durationTicks(beats[i + 1]);
    beats.splice(i + 1, 1);
  }
  if (left > 0) beats.splice(i + 1, 0, ...restsFor(left));
}

// Die N-tole, zu der Spalte i gehört: aufeinanderfolgende Spalten mit gleichem t und Notenwert, in Gruppen zu t.
function tupletGroup(beats, i) {
  const b = beats[i];
  if (!b?.t) return null;
  const same = (x) => x && x.t === b.t && x.d === b.d;
  let start = i;
  while (same(beats[start - 1])) start -= 1;
  const from = start + Math.floor((i - start) / b.t) * b.t;
  let to = from;
  while (to < from + b.t && same(beats[to])) to += 1;
  return [from, to];
}

function fretText(n) {
  if (!n) return '';
  const base = n.fx?.x ? 'x' : String(n.f);
  const mark = n.fx?.h ? 'h' : n.fx?.sl ? '/' : n.fx?.b ? 'b' : n.fx?.v ? '~' : '';
  return base + mark;
}

export function TabEditor({ model, onChange }) {
  const [cur, setCur] = useState({ bar: 0, beat: 0, s: 6 });
  const [duration, setDuration] = useState({ d: 8, dot: false });
  const digit = useRef({ at: 0, value: '' });
  const grid = useRef(null);
  // Bei anderer Stimmung zeigen die Saiten ihren tatsächlichen Ton
  const style = settings.get().noteNames === 'de' ? 'de' : 'intl';
  const names = (model.tuningId || 'standard') === 'standard'
    ? stringNames()
    : tuningById(model.tuningId).midi.map((m, i) => (i === 5 ? noteName(m, style).toLowerCase() : noteName(m, style)));
  const stringLabels = [5, 4, 3, 2, 1, 0].map((i) => names[i]);

  const bar = model.bars[cur.bar];
  const beat = bar?.beats[cur.beat];
  const note = beat?.notes.find((n) => n.s === cur.s);

  const commit = (fn) => {
    const next = structuredClone(model);
    delete next.approximate;
    fn(next);
    onChange(next);
  };

  useEffect(() => {
    if (!bar) setCur({ bar: Math.max(0, model.bars.length - 1), beat: 0, s: cur.s });
    else if (!beat) setCur({ ...cur, beat: Math.max(0, bar.beats.length - 1) });
  }, [model]);

  const setFret = (value) => commit((m) => {
    const b = m.bars[cur.bar].beats[cur.beat];
    const n = b.notes.find((x) => x.s === cur.s);
    if (n) n.f = value;
    else b.notes.push({ s: cur.s, f: value });
  });

  const clearNote = () => commit((m) => {
    const b = m.bars[cur.bar].beats[cur.beat];
    b.notes = b.notes.filter((x) => x.s !== cur.s);
  });

  const toggleFx = (key) => {
    if (!note) return;
    commit((m) => {
      const n = m.bars[cur.bar].beats[cur.beat].notes.find((x) => x.s === cur.s);
      n.fx = { ...(n.fx || {}) };
      if (n.fx[key]) delete n.fx[key]; else n.fx[key] = true;
      if (!Object.keys(n.fx).length) delete n.fx;
    });
  };

  function applyDuration(d, dot) {
    setDuration({ d, dot });
    if (!beat) return;
    commit((m) => {
      const beats = m.bars[cur.bar].beats;
      const b = beats[cur.beat];
      const before = durationTicks(b);
      b.d = d;
      if (dot) b.dot = true; else delete b.dot;
      fitAfter(beats, cur.beat, before - durationTicks(b));
    });
  }

  // Triole an: Die Spalte wird zur ersten von drei Triolen-Noten mit gleichem Notenwert.
  // Triole aus: Die Gruppe wird wieder zu normalen Noten.
  function toggleTuplet() {
    if (!beat) return;
    commit((m) => {
      const beats = m.bars[cur.bar].beats;
      const group = tupletGroup(beats, cur.beat);
      if (group) {
        const [from, to] = group;
        const before = beats.slice(from, to).reduce((n, x) => n + durationTicks(x), 0);
        for (let k = from; k < to; k++) delete beats[k].t;
        const after = beats.slice(from, to).reduce((n, x) => n + durationTicks(x), 0);
        fitAfter(beats, to - 1, before - after);
        return;
      }
      const b = beats[cur.beat];
      const before = durationTicks(b);
      delete b.dot;
      b.t = 3;
      beats.splice(cur.beat + 1, 0, { d: b.d, t: 3, notes: [] }, { d: b.d, t: 3, notes: [] });
      const after = durationTicks(b) * 3;
      fitAfter(beats, cur.beat + 2, before - after);
    });
  }

  const addBar = (after = cur.bar) => commit((m) => m.bars.splice(after + 1, 0, emptyBar(m.ts)));
  const copyBar = () => commit((m) => m.bars.splice(cur.bar + 1, 0, structuredClone(m.bars[cur.bar])));
  const removeBar = () => {
    if (model.bars.length < 2) return;
    commit((m) => m.bars.splice(cur.bar, 1));
  };
  const insertBeat = () => commit((m) => m.bars[cur.bar].beats.splice(cur.beat, 0, { d: duration.d, ...(duration.dot ? { dot: true } : {}), notes: [] }));
  const removeBeat = () => {
    if (bar.beats.length < 2) return;
    commit((m) => m.bars[cur.bar].beats.splice(cur.beat, 1));
  };

  function move(dir) {
    if (dir > 0) {
      if (cur.beat + 1 < bar.beats.length) setCur({ ...cur, beat: cur.beat + 1 });
      else if (cur.bar + 1 < model.bars.length) setCur({ ...cur, bar: cur.bar + 1, beat: 0 });
      else { addBar(cur.bar); setCur({ ...cur, bar: cur.bar + 1, beat: 0 }); }
    } else if (cur.beat > 0) setCur({ ...cur, beat: cur.beat - 1 });
    else if (cur.bar > 0) setCur({ ...cur, bar: cur.bar - 1, beat: model.bars[cur.bar - 1].beats.length - 1 });
  }

  function typeDigit(ch) {
    const now = performance.now();
    const d = digit.current;
    const joined = now - d.at < 700 ? d.value + ch : ch;
    const value = Number(joined) <= 24 && joined.length <= 2 ? joined : ch;
    digit.current = { at: now, value };
    setFret(Number(value));
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k >= '0' && k <= '9') typeDigit(k);
    else if (k === 'ArrowRight') move(1);
    else if (k === 'ArrowLeft') move(-1);
    else if (k === 'ArrowUp') setCur({ ...cur, s: Math.max(1, cur.s - 1) });
    else if (k === 'ArrowDown') setCur({ ...cur, s: Math.min(6, cur.s + 1) });
    else if (k === ' ') move(1);
    else if (k === 'Enter') { addBar(); setCur({ ...cur, bar: cur.bar + 1, beat: 0 }); }
    else if (k === 'Backspace' || k === 'Delete') clearNote();
    else if (k === 'h') toggleFx('h');
    else if (k === 's') toggleFx('sl');
    else if (k === 'b') toggleFx('b');
    else if (k === 'v') toggleFx('v');
    else if (k === 'm') toggleFx('pm');
    else if (k === 'x') { if (!note) setFret(0); setTimeout(() => toggleFx('x')); }
    else if (k === '.') applyDuration(beat.d, !beat.dot);
    else if (k === 't') toggleTuplet();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  const pick = (b, i, s) => {
    setCur({ bar: b, beat: i, s });
    const col = model.bars[b].beats[i];
    setDuration({ d: col.d, dot: Boolean(col.dot) });
    grid.current?.focus();
  };

  return html`<div class="tabed">
    <div class="row wrap tabed-meta">
      <${Field} label="Tempo in BPM"><${Stepper} label="Tempo" value=${model.tempo} min=${20} max=${320} step=${5} onChange=${(v) => commit((m) => { m.tempo = v; })}/><//>
      <${Field} label="Taktart">
        <select value=${model.ts.join('/')} onChange=${(e) => commit((m) => { m.ts = e.currentTarget.value.split('/').map(Number); })}>
          ${['4/4', '3/4', '2/4', '6/8', '5/4', '7/8', '12/8'].map((t) => html`<option value=${t}>${t}</option>`)}
        </select>
      <//>
      <${Field} label="Stimmung">
        <select value=${model.tuningId || 'standard'} onChange=${(e) => commit((m) => { m.tuningId = e.currentTarget.value; })}>
          ${TUNINGS.map((t) => html`<option value=${t.id}>${t.name}</option>`)}
        </select>
      <//>
      <${Field} label="Kapodaster im Bund"><${Stepper} label="Kapodaster" value=${model.capo || 0} min=${0} max=${12} onChange=${(v) => commit((m) => { m.capo = v; })}/><//>
    </div>

    <div class="tabed-tools" role="toolbar" aria-label="Notenwert und Effekte">
      <div class="row wrap">
        ${DURS.map((x) => html`<${Button} size="sm" variant=${beat?.d === x.d ? 'on' : 'plain'} onClick=${() => applyDuration(x.d, Boolean(beat?.dot))}>${x.label}<//>`)}
        <${Button} size="sm" variant=${beat?.dot ? 'on' : 'plain'} onClick=${() => applyDuration(beat.d, !beat.dot)}>Punktiert<//>
        <${Button} size="sm" variant=${beat?.t ? 'on' : 'plain'} title="Drei Noten in der Zeit von zwei" onClick=${toggleTuplet}>${beat?.t ? `${TUPLET_NAMES[beat.t]} aufheben` : 'Triole'}<//>
      </div>
      <div class="row wrap">
        ${FX.map((x) => html`<${Button} size="sm" title=${x.label} disabled=${!note} variant=${note?.fx?.[x.key] ? 'on' : 'plain'} onClick=${() => toggleFx(x.key)}>${x.label}<//>`)}
      </div>
      <div class="row wrap">
        <${Button} size="sm" onClick=${insertBeat}>Spalte einfügen<//>
        <${Button} size="sm" onClick=${removeBeat}>Spalte löschen<//>
        <${Button} size="sm" onClick=${() => { addBar(); setCur({ ...cur, bar: cur.bar + 1, beat: 0 }); }}>Takt hinzufügen<//>
        <${Button} size="sm" onClick=${copyBar}>Takt kopieren<//>
        <${Button} size="sm" onClick=${removeBar}>Takt löschen<//>
      </div>
    </div>

    <div class="tabed-pad" aria-label="Bund eingeben">
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`<button type="button" onClick=${() => { typeDigit(String(n)); grid.current?.focus(); }}>${n}</button>`)}
      <button type="button" aria-label="Note löschen" onClick=${() => { clearNote(); grid.current?.focus(); }}>Entf</button>
    </div>

    <div class="tabed-grid" ref=${grid} tabindex="0" role="application" aria-label="Tab-Raster. Zahlen tippen setzt den Bund, Pfeiltasten bewegen die Markierung." onKeyDown=${onKey}>
      ${model.bars.map((b, bi) => {
        const fill = barFill(b, model.ts);
        return html`<div class=${`tabed-bar ${fill.ok ? '' : 'bad'}`} key=${bi}>
          <div class="tabed-barnum">${bi + 1}${!fill.ok && html`<span> ${fill.over ? 'zu lang' : 'zu kurz'}</span>`}</div>
          <div class="tabed-cols">
            <div class="tabed-col tabed-names" aria-hidden="true">${stringLabels.map((n) => html`<span>${n}</span>`)}<span></span></div>
            ${b.beats.map((col, ci) => html`<div class=${`tabed-col ${!col.notes.length ? 'rest' : ''}`} style=${`--len:${Math.max(0.8, Math.log2(durationTicks(col) / 240) * 0.45 + 0.8)}`}>
              ${[1, 2, 3, 4, 5, 6].map((s) => {
                const n = col.notes.find((x) => x.s === s);
                const isCur = cur.bar === bi && cur.beat === ci && cur.s === s;
                return html`<button type="button" tabindex="-1" class=${`tabed-cell ${isCur ? 'cur' : ''}`}
                  aria-label=${`Takt ${bi + 1}, Spalte ${ci + 1}, ${stringLabels[s - 1]}-Saite${n ? `, Bund ${n.f}` : ''}`}
                  onClick=${() => pick(bi, ci, s)}>${fretText(n)}</button>`;
              })}
              <span class="tabed-dur" title=${col.t ? TUPLET_NAMES[col.t] : undefined}>1/${col.d}${col.dot ? '.' : ''}${col.t ? html`<sup>${col.t}</sup>` : ''}</span>
            </div>`)}
          </div>
        </div>`;
      })}
    </div>
    <p class="muted small">Zahlen setzen den Bund, Pfeiltasten bewegen die Markierung, Leertaste geht zur nächsten Spalte, Enter fügt einen Takt an. h, s, b, v, m und x setzen Effekte, t macht eine Triole.</p>
  </div>`;
}
