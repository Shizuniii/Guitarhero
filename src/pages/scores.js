import { html, useEffect, useMemo, useRef, useState } from '../../vendor/htm-preact.js';
import { HELPER_URL } from '../config.js';
import { uid, useStore } from '../lib/core.js';
import { dbDelete, dbPut } from '../lib/db.js';
import { go } from '../lib/router.js';
import { scores, settings } from '../lib/state.js';
import { badBars, barList, GUITAR_PROGRAMS, newModel, parseHelperJson, parseTextTab, toAlphaTex } from '../lib/tabformat.js';
import { toast } from '../lib/ui-state.js';
import { Button, confirmDialog, Empty, Field, Modal, PageHead, useDebounced } from '../ui/common.js';
import { Icon } from '../ui/icons.js';
import { inspectScoreFile, ScorePlayer } from '../ui/score-player.js';
import { TabEditor } from '../ui/tab-editor.js';
import { youTubeId } from '../ui/youtube.js';
import { AddToPlanDialog, newStep } from './practice.js';

const SOURCE_LABEL = { model: 'Eigene Tabs', alphatex: 'alphaTex', gp: 'Guitar Pro', musicxml: 'MusicXML' };

async function createItem(kind) {
  const item = await scores.put({ id: uid(), kind, title: kind === 'riff' ? 'Neuer Riff' : 'Neuer Song', artist: '', notes: '', score: null, attachments: [] });
  go(`score/${item.id}`);
}

export function ScoreListPage({ kind }) {
  const all = useStore(scores.store);
  const list = all.filter((s) => s.kind === kind);
  const [plan, setPlan] = useState(null);
  const label = kind === 'riff' ? 'Riffs' : 'Songs';
  const single = kind === 'riff' ? 'Riff' : 'Song';

  return html`<div class="page">
    <${PageHead} title=${label}>
      <${Button} variant="primary" icon="plus" onClick=${() => createItem(kind)}>${single} hinzufügen<//>
    <//>
    ${!list.length && html`<${Empty} title=${`Noch keine ${label}`}>
      <p>Füge Tabs als Datei, Text, Bild oder Link hinzu, oder schreibe sie im Editor selbst.</p>
    <//>`}
    <ul class="score-list">
      ${list.map((s) => html`<li key=${s.id}>
        <a class="score-title" href=${`#/frei/${kind}?score=${s.id}`}>
          <strong>${s.title}</strong>
          <small>${[s.artist, s.score ? SOURCE_LABEL[s.score.format] : 'Nur Bilder oder Links'].filter(Boolean).join(', ')}</small>
        </a>
        <div class="row">
          <${Button} icon="play" onClick=${() => go(`frei/${kind}?score=${s.id}`)}>Üben<//>
          <${Button} icon="plus" aria-label="Zum Plan hinzufügen" onClick=${() => setPlan(s)}/>
          <${Button} icon="edit" aria-label="Bearbeiten" onClick=${() => go(`score/${s.id}`)}/>
        </div>
      </li>`)}
    </ul>
    ${plan && html`<${AddToPlanDialog} step=${newStep(kind, { scoreId: plan.id })} onClose=${() => setPlan(null)}/>`}
  </div>`;
}

function PasteDialog({ title, hint, placeholder, onClose, onApply, children }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  return html`<${Modal} wide title=${title} onClose=${onClose}>
    <p class="muted">${hint}</p>
    ${children}
    <textarea class="tab-paste" rows="12" spellcheck="false" placeholder=${placeholder} value=${text} onInput=${(e) => setText(e.currentTarget.value)}></textarea>
    ${error && html`<p class="notice" role="alert">${error}</p>`}
    <div class="row end">
      <${Button} onClick=${onClose}>Abbrechen<//>
      <${Button} variant="primary" disabled=${!text.trim()} onClick=${() => { const e = onApply(text); if (e) setError(e); }}>Übernehmen<//>
    </div>
  <//>`;
}

export function ScoreEditPage({ id }) {
  const all = useStore(scores.store);
  const item = all.find((s) => s.id === id);
  const [paste, setPaste] = useState(null);
  const [linkText, setLinkText] = useState('');
  const scoreFile = useRef(null);
  const imageFile = useRef(null);

  if (!item) return html`<div class="page"><${Empty} title="Diesen Eintrag gibt es nicht mehr"><${Button} onClick=${() => go('songs')}>Zu den Songs<//><//></div>`;

  const patch = (p) => scores.put({ ...scores.find(id), ...p });
  const atts = item.attachments || [];
  const addAttachments = (added) => patch({ attachments: [...(scores.find(id).attachments || []), ...added] });

  async function onScoreFile(e) {
    const file = e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const info = await inspectScoreFile(buffer);
      const format = /\.(xml|musicxml|mxl)$/i.test(file.name) ? 'musicxml' : 'gp';
      await patch({
        score: { format, data: buffer, fileName: file.name },
        title: item.title.startsWith('Neuer') && info.title ? info.title : item.title,
        artist: item.artist || info.artist,
      });
      toast(`${info.bars} Takte geladen${info.tracks > 1 ? `, ${info.tracks} Spuren` : ''}`, 'good');
    } catch {
      toast('Diese Datei lässt sich nicht lesen. Unterstützt sind Guitar Pro 3 bis 8 und MusicXML.', 'warn', 7000);
    }
  }

  async function onImages(e) {
    const files = [...e.currentTarget.files];
    e.currentTarget.value = '';
    const added = [];
    for (const f of files) {
      const blobId = uid();
      await dbPut('blobs', f, blobId);
      added.push({ id: uid(), type: f.type === 'application/pdf' ? 'pdf' : 'image', blobId, name: f.name });
    }
    await addAttachments(added);
  }

  function addLink() {
    const url = linkText.trim();
    if (!url) return;
    let parsed;
    try { parsed = new URL(url.includes('://') ? url : `https://${url}`); } catch { toast('Das sieht nicht wie ein Link aus.', 'warn'); return; }
    const videoId = youTubeId(parsed.href);
    const entry = videoId ? { id: uid(), type: 'youtube', videoId, url: parsed.href } : { id: uid(), type: 'link', url: parsed.href, title: parsed.hostname };
    addAttachments([entry]);
    setLinkText('');
  }

  async function removeAttachment(a) {
    if (a.blobId) await dbDelete('blobs', a.blobId);
    patch({ attachments: scores.find(id).attachments.filter((x) => x.id !== a.id) });
  }

  async function removeItem() {
    const ok = await confirmDialog({ title: `${item.kind === 'riff' ? 'Riff' : 'Song'} löschen`, text: `„${item.title}“ wird gelöscht. Verknüpfte Aufnahmen bleiben erhalten.` });
    if (!ok) return;
    for (const a of atts) if (a.blobId) await dbDelete('blobs', a.blobId);
    await scores.remove(item.id);
    go(item.kind === 'riff' ? 'riffs' : 'songs');
  }

  function warnBars(model) {
    const bad = badBars(model);
    if (bad.length) toast(`${barList(bad)} füllen die Taktart nicht genau. Prüfe sie im Editor, sonst überlappen sich beim Abspielen Töne.`, 'warn', 9000);
  }

  function applyText(text) {
    const model = parseTextTab(text);
    if (!model) return 'Ich finde hier keine Tabs. Gebraucht werden sechs Zeilen untereinander, zum Beispiel e|--0--3--|.';
    patch({ score: { format: 'model', data: model } });
    setPaste(null);
    toast('Tabs übernommen. Prüfe den Rhythmus im Editor, Text-Tabs enthalten ihn nur ungefähr.', 'info', 7000);
    return null;
  }

  function applyHelper(text) {
    const res = parseHelperJson(text);
    if (res?.tooNew) return 'Dieses Ergebnis kommt aus einer neueren Version des Tab-Lesers. Schließ Guitarhero, öffne es neu und füge es dann noch einmal ein.';
    if (!res) return 'Das ist kein Ergebnis der Helfer-Seite. Kopiere dort den ganzen Block über den Kopieren-Knopf.';
    // Hinweise eines früheren Einlesens ersetzen, statt sie anzuhängen
    const ownNotes = (item.notes || '').split('\n')
      .filter((l) => !l.startsWith('Unsichere Stellen laut KI:') && !l.startsWith('Aus dem Wissen der KI:'))
      .join('\n').trim();
    const notes = [
      ownNotes,
      res.info.length ? `Aus dem Wissen der KI: ${res.info.join(' ')}` : '',
      res.uncertain.length ? `Unsichere Stellen laut KI: ${res.uncertain.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    warnBars(res.model);
    patch({
      score: { format: 'model', data: res.model },
      title: item.title.startsWith('Neuer') && res.title ? res.title : item.title,
      artist: item.artist || res.artist,
      notes,
    }).then(() => {
      setPaste(null);
      go(`score/${item.id}/tabs`);
    });
    return null;
  }

  return html`<div class="page">
    <${PageHead} title=${item.title}>
      <${Button} variant="primary" icon="play" onClick=${() => go(`frei/${item.kind}?score=${item.id}`)}>Üben<//>
      <${Button} icon="trash" aria-label="Löschen" onClick=${removeItem}/>
    <//>

    <div class="edit-grid">
      <section class="stack">
        <${Field} label="Titel"><input type="text" value=${item.title} onChange=${(e) => patch({ title: e.currentTarget.value })}/><//>
        <${Field} label="Band oder Künstler"><input type="text" value=${item.artist} onChange=${(e) => patch({ artist: e.currentTarget.value })}/><//>
        <${Field} label="Art">
          <select value=${item.kind} onChange=${(e) => patch({ kind: e.currentTarget.value })}>
            <option value="riff">Riff</option><option value="song">Song</option>
          </select>
        <//>
        <${Field} label="Notizen"><textarea rows="3" value=${item.notes} onChange=${(e) => patch({ notes: e.currentTarget.value })}></textarea><//>
      </section>

      <section class="stack">
        <h2>Tabs oder Noten</h2>
        ${item.score
          ? html`<p class="source-line"><${Icon} name="check" size=${18}/> ${SOURCE_LABEL[item.score.format]}${item.score.fileName ? `: ${item.score.fileName}` : ''}</p>`
          : html`<p class="muted">Abspielen geht mit allem außer Bildern und Links.</p>`}
        <div class="source-grid">
          <${Button} icon="edit" onClick=${async () => {
            if (!item.score || item.score.format === 'model') {
              if (!item.score) await patch({ score: { format: 'model', data: newModel() } });
              go(`score/${item.id}/tabs`);
            } else toast('Dateien aus Guitar Pro oder MusicXML lassen sich hier abspielen, aber nicht bearbeiten.', 'warn', 6000);
          }}>Im Editor schreiben<//>
          <${Button} icon="list" onClick=${() => setPaste('text')}>Text-Tab einfügen<//>
          <${Button} icon="upload" onClick=${() => scoreFile.current.click()}>Datei laden<//>
          <${Button} icon="image" onClick=${() => setPaste('helper')}>Screenshot per KI<//>
        </div>
        <input ref=${scoreFile} type="file" hidden accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl" onChange=${onScoreFile}/>
        <p class="muted small">Dateien: Guitar Pro 3 bis 8 und MusicXML.</p>
      </section>
    </div>

    <section class="stack">
      <h2>Bilder und Links</h2>
      <div class="row wrap bottom">
        <${Field} label="Link zu einer Seite oder einem YouTube-Video" class="grow">
          <input type="url" value=${linkText} placeholder="https://" onInput=${(e) => setLinkText(e.currentTarget.value)} onKeyDown=${(e) => e.key === 'Enter' && addLink()}/>
        <//>
        <${Button} icon="link" onClick=${addLink}>Link hinzufügen<//>
        <${Button} icon="image" onClick=${() => imageFile.current.click()}>Bild oder PDF hinzufügen<//>
      </div>
      <input ref=${imageFile} type="file" hidden multiple accept="image/*,application/pdf" onChange=${onImages}/>
      <p class="muted small">Bilder und Links zeigt die App beim Üben an, abspielen kann sie diese nicht. YouTube-Videos laufen direkt in der App, mit Tempo und Loop.</p>
      ${atts.length > 0 && html`<ul class="plain-list">
        ${atts.map((a) => html`<li key=${a.id} class="row between">
          <span class="row"><${Icon} name=${a.type === 'image' || a.type === 'pdf' ? 'image' : 'link'} size=${18}/> ${a.name || a.title || a.url}</span>
          <${Button} icon="trash" aria-label="Entfernen" onClick=${() => removeAttachment(a)}/>
        </li>`)}
      </ul>`}
    </section>

    ${paste === 'text' && html`<${PasteDialog} title="Text-Tab einfügen" onClose=${() => setPaste(null)} onApply=${applyText}
      hint="Füge Tabs aus einer Webseite ein. Überschriften stören nicht. Der Rhythmus wird aus den Abständen geschätzt."
      placeholder=${'e|-----------------|\nB|-----------------|\nG|-----------------|\nD|-----2---2---2---|\nA|-0-3---3---3---3-|\nE|-----------------|'}/>`}
    ${paste === 'helper' && html`<${PasteDialog} title="Screenshot per KI" onClose=${() => setPaste(null)} onApply=${applyHelper}
      hint="Lade den Screenshot auf der Helfer-Seite hoch, kopiere das Ergebnis und füge es hier ein. Danach öffnet sich der Editor zum Prüfen."
      placeholder='{"title": "...", "bars": [...]}'>
      ${HELPER_URL && html`<p><a href=${HELPER_URL} target="_blank" rel="noopener">Helfer-Seite in Claude öffnen</a></p>`}
    <//>`}
  </div>`;
}

export function ScoreTabsPage({ id }) {
  const item = useStore(scores.store, (l) => l.find((s) => s.id === id));
  const [model, setModel] = useState(item?.score?.format === 'model' ? item.score.data : null);
  const persist = useDebounced((m) => {
    const fresh = scores.find(id);
    if (fresh) scores.put({ ...fresh, score: { format: 'model', data: m } });
  }, 500);
  const program = GUITAR_PROGRAMS[settings.get().guitar];
  const [tex, setTex] = useState(() => (model ? toAlphaTex(model, { program }) : ''));
  const refresh = useDebounced((m) => setTex(toAlphaTex(m, { program })), 500);
  const previewItem = useMemo(() => (item ? { id: item.id, kind: item.kind, title: item.title } : null), [item?.id]);

  useEffect(() => {
    if (!model && item?.score?.format === 'model') setModel(item.score.data);
  }, [item]);

  if (!item) return html`<div class="page"><${Empty} title="Diesen Eintrag gibt es nicht mehr"/></div>`;
  if (!model) return html`<div class="page"><p class="muted">Dieser Eintrag hat keine bearbeitbaren Tabs.</p></div>`;

  const change = (m) => { setModel(m); persist(m); refresh(m); };

  return html`<div class="page">
    <${PageHead} title=${item.title} sub=${model.approximate ? 'Aus Text eingelesen: prüfe die Notenwerte.' : 'Änderungen werden automatisch gespeichert.'}>
      <${Button} onClick=${() => go(`score/${item.id}`)}>Zurück<//>
      <${Button} variant="primary" icon="play" onClick=${() => go(`frei/${item.kind}?score=${item.id}`)}>Üben<//>
    <//>
    <${TabEditor} model=${model} onChange=${change}/>
    <h2>Vorschau</h2>
    <${ScorePlayer} compact key=${item.id} item=${previewItem} tex=${tex}/>
  </div>`;
}
