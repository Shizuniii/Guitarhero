import { html, useState } from '../../vendor/htm-preact.js';
import { uid, useStore } from '../lib/core.js';
import { COMMON_CHORDS, displayChordName, fromInput, searchChords, voicingsFor } from '../lib/chords.js';
import { go } from '../lib/router.js';
import { customChords, settings } from '../lib/state.js';
import { ChordDiagram, ChordInput, SoundButton, TabColumn } from '../ui/chord.js';
import { Button, confirmDialog, Field, Modal, PageHead, Stepper } from '../ui/common.js';

function Tile({ name }) {
  const list = voicingsFor(name);
  if (!list[0]) return null;
  return html`<a class="chord-tile" href=${`#/frei/chord?chord=${encodeURIComponent(name)}`}>
    <${ChordDiagram} voicing=${list[0]} width=${118} frets=${Math.max(4, ...list[0].f)}/>
    <b>${displayChordName(name)}</b>
  </a>`;
}

function ChordEditor({ initial, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [frets, setFrets] = useState(initial?.frets || [0, 0, 0, 0, 0, 0]);
  const [baseFret, setBaseFret] = useState(initial?.baseFret || 1);
  const voicing = { f: frets, g: [0, 0, 0, 0, 0, 0], b: baseFret, r: [] };

  const toggle = (s, fret) => setFrets(frets.map((f, i) => (i === s ? (f === fret ? 0 : fret) : f)));
  const top = (s) => setFrets(frets.map((f, i) => (i === s ? (f === -1 ? 0 : -1) : f)));

  const save = async () => {
    await customChords.put({ id: initial?.id || uid(), name: name.trim(), frets, baseFret, createdAt: initial?.createdAt });
    onClose();
  };

  return html`<${Modal} title=${initial ? 'Griff bearbeiten' : 'Eigenen Griff anlegen'} onClose=${onClose}>
    <div class="row wrap top">
      <${ChordDiagram} voicing=${voicing} width=${220} frets=${5} onToggle=${toggle} onTop=${top}/>
      <div class="stack">
        <${Field} label="Name"><input type="text" value=${name} placeholder="zum Beispiel Mein Am" onInput=${(e) => setName(e.currentTarget.value)}/><//>
        <${Field} label="Erster sichtbarer Bund"><${Stepper} label="Bund" value=${baseFret} min=${1} max=${20} onChange=${setBaseFret}/><//>
        <${TabColumn} voicing=${voicing}/>
        <${SoundButton} voicing=${voicing}/>
        <p class="muted small">Klicke auf einen Bund, um einen Finger zu setzen. Klick über einer Saite schaltet zwischen leer und nicht gespielt.</p>
      </div>
    </div>
    <div class="row end">
      <${Button} onClick=${onClose}>Abbrechen<//>
      <${Button} variant="primary" disabled=${!name.trim()} onClick=${save}>Griff speichern<//>
    </div>
  <//>`;
}

export function ChordsPage() {
  const own = useStore(customChords.store);
  useStore(settings, (s) => s.noteNames);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
  const [a, setA] = useState('Am');
  const [b, setB] = useState('C');

  const q = query.trim().toLowerCase();
  const results = q ? searchChords(fromInput(query), 24) : COMMON_CHORDS;

  return html`<div class="page">
    <${PageHead} title="Akkorde">
      <${Button} icon="plus" onClick=${() => setEditor({})}>Eigenen Griff anlegen<//>
    <//>

    <section class="change-launch" aria-label="Akkordwechsel üben">
      <h2>Akkordwechsel üben</h2>
      <div class="row wrap bottom">
        <${ChordInput} id="la" label="Erster Akkord" value=${a} onChange=${setA}/>
        <${ChordInput} id="lb" label="Zweiter Akkord" value=${b} onChange=${setB}/>
        <${Button} variant="primary" icon="play" onClick=${() => {
          go(`frei/change?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
        }}>Wechsel üben<//>
      </div>
    </section>

    <${Field} label="Akkord suchen" class="chord-search">
      <input type="search" value=${query} placeholder="zum Beispiel F#m7" onInput=${(e) => setQuery(e.currentTarget.value)} spellcheck="false"/>
    <//>

    <div class="chord-tiles">${results.map((n) => html`<${Tile} key=${n} name=${n}/>`)}</div>
    ${q && !results.length && html`<p class="muted">Nichts gefunden. Du kannst einen eigenen Griff anlegen.</p>`}

    ${own.length > 0 && html`<section>
      <h2>Deine Griffe</h2>
      <ul class="plain-list">
        ${own.map((c) => html`<li key=${c.id} class="row between">
          <a href=${`#/frei/chord?chord=${encodeURIComponent(c.name)}`}><strong>${c.name}</strong></a>
          <div class="row">
            <${Button} icon="edit" aria-label="Griff bearbeiten" onClick=${() => setEditor({ chord: c })}/>
            <${Button} icon="trash" aria-label="Griff löschen" onClick=${async () => {
              if (await confirmDialog({ title: 'Griff löschen', text: `„${c.name}“ wird gelöscht.` })) customChords.remove(c.id);
            }}/>
          </div>
        </li>`)}
      </ul>
    </section>`}
    ${editor && html`<${ChordEditor} initial=${editor.chord} onClose=${() => setEditor(null)}/>`}
  </div>`;
}
