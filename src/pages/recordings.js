import { html, useEffect, useState } from '../../vendor/htm-preact.js';
import { downloadBlob, fmtDateTime, fmtDuration, useStore } from '../lib/core.js';
import { folderState, reconnectFolder } from '../lib/folder.js';
import { deleteRecording, loadRecordingBlob } from '../lib/recorder.js';
import { recordings, scores, STEP_TYPES } from '../lib/state.js';
import { RecordPanel } from '../steps/record.js';
import { Button, confirmDialog, Field, Modal, PageHead } from '../ui/common.js';
import { WavePlayer } from '../ui/wave.js';

function Row({ rec }) {
  const [blob, setBlob] = useState(null);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  useEffect(() => {
    if (open && !blob) loadRecordingBlob(rec.id).then(setBlob);
  }, [open]);
  const song = rec.meta?.scoreId ? scores.find(rec.meta.scoreId) : null;
  const kind = STEP_TYPES[rec.meta?.type]?.label;
  return html`<li class="rec-row">
    <div class="row between">
      <button type="button" class="rec-open" aria-expanded=${open} onClick=${() => setOpen(!open)}>
        <strong>${rec.title}</strong>
        <small>${[fmtDateTime(rec.createdAt), fmtDuration(rec.ms), kind].filter(Boolean).join(', ')}</small>
      </button>
      <div class="row">
        ${song && html`<a class="btn btn-plain btn-sm" href=${`#/frei/${song.kind}?score=${song.id}`}><span>Zum ${song.kind === 'riff' ? 'Riff' : 'Song'}</span></a>`}
        <${Button} icon="edit" aria-label="Umbenennen" onClick=${() => setRenaming(rec.title)}/>
        <${Button} icon="download" aria-label="Herunterladen" onClick=${async () => downloadBlob(await loadRecordingBlob(rec.id), rec.fileName)}/>
        <${Button} icon="trash" aria-label="Löschen" onClick=${async () => {
          if (await confirmDialog({ title: 'Aufnahme löschen', text: `„${rec.title}“ wird endgültig gelöscht.` })) deleteRecording(rec);
        }}/>
      </div>
    </div>
    ${open && blob && html`<${WavePlayer} blob=${blob} marks=${rec.marks} ms=${rec.ms} analysis=${rec.analysis}/>`}
    ${renaming !== null && html`<${Modal} title="Aufnahme umbenennen" onClose=${() => setRenaming(null)}>
      <${Field} label="Titel"><input type="text" value=${renaming} onInput=${(e) => setRenaming(e.currentTarget.value)}/><//>
      <div class="row end">
        <${Button} onClick=${() => setRenaming(null)}>Abbrechen<//>
        <${Button} variant="primary" disabled=${!renaming.trim()} onClick=${() => { recordings.put({ ...rec, title: renaming.trim() }); setRenaming(null); }}>Speichern<//>
      </div>
    <//>`}
  </li>`;
}

export function RecordingsPage() {
  const list = useStore(recordings.store);
  const folder = useStore(folderState);
  const [scoreId, setScoreId] = useState('');
  const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
  return html`<div class="page">
    <${PageHead} title="Aufnahmen"/>
    <${RecordPanel} scoreId=${scoreId} onScore=${setScoreId}/>
    ${folder.name && folder.permission === 'prompt' && html`<p class="notice">
      Der Ordner „${folder.name}“ braucht deine Freigabe, damit neue Aufnahmen dort landen.
      <${Button} size="sm" onClick=${reconnectFolder}>Ordner freigeben<//>
    </p>`}
    <h2>Gespeichert</h2>
    ${!sorted.length && html`<p class="muted">Noch nichts gespeichert. Nimm etwas auf oder behalte einen Versuch aus einem Schritt.</p>`}
    <ul class="rec-list">${sorted.map((r) => html`<${Row} key=${r.id} rec=${r}/>`)}</ul>
  </div>`;
}
