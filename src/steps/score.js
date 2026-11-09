import { html, useEffect, useState } from '../../vendor/htm-preact.js';
import { useStore } from '../lib/core.js';
import { dbGet } from '../lib/db.js';
import { go } from '../lib/router.js';
import { scores, STEP_TYPES } from '../lib/state.js';
import { useTimerRecording } from '../lib/take-control.js';
import { resetTimer, setTimerDuration } from '../lib/timer.js';
import { Button, Empty, Field } from '../ui/common.js';
import { Icon } from '../ui/icons.js';
import { ScorePlayer } from '../ui/score-player.js';
import { TakesList } from '../ui/wave.js';
import { YouTubePane } from '../ui/youtube.js';

function BlobImage({ id, name }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u;
    dbGet('blobs', id).then((b) => {
      if (!b) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => u && URL.revokeObjectURL(u);
  }, [id]);
  if (!url) return null;
  return html`<a href=${url} target="_blank" rel="noopener"><img class="score-image" src=${url} alt=${name || 'Tab-Bild'}/></a>`;
}

function BlobPdf({ id, name }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u;
    dbGet('blobs', id).then((b) => {
      if (!b) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => u && URL.revokeObjectURL(u);
  }, [id]);
  if (!url) return null;
  return html`<iframe class="score-pdf" src=${url} title=${name || 'PDF'}></iframe>`;
}

export function Attachments({ item }) {
  const list = item.attachments || [];
  if (!list.length) return null;
  return html`<section class="attachments">
    ${list.map((a) => {
      if (a.type === 'youtube') return html`<${YouTubePane} key=${a.id} videoId=${a.videoId}/>`;
      if (a.type === 'link') return html`<a key=${a.id} class="link-row" href=${a.url} target="_blank" rel="noopener"><${Icon} name="link"/><span>${a.title || a.url}</span></a>`;
      if (a.type === 'image') return html`<${BlobImage} key=${a.id} id=${a.blobId} name=${a.name}/>`;
      if (a.type === 'pdf') return html`<${BlobPdf} key=${a.id} id=${a.blobId} name=${a.name}/>`;
      return null;
    })}
  </section>`;
}

export function ScoreStep({ step, onConfig }) {
  const list = useStore(scores.store);
  const kind = step.type;
  const item = list.find((s) => s.id === step.config.scoreId);
  useTimerRecording(() => ({ type: kind, title: item?.title || STEP_TYPES[kind].label, scoreId: item?.id }));
  useEffect(() => {
    resetTimer();
    setTimerDuration(step.config.seconds || 60);
    return () => resetTimer();
  }, [step.config.seconds]);

  if (!item) {
    const options = list.filter((s) => s.kind === kind);
    return html`<${Empty} title=${`Wähle einen ${STEP_TYPES[kind].label}`}>
      ${options.length ? html`<${Field} label=${STEP_TYPES[kind].label}>
        <select value="" onChange=${(e) => onConfig({ scoreId: e.currentTarget.value })}>
          <option value="" disabled>Bitte wählen</option>
          ${options.map((o) => html`<option value=${o.id}>${o.title}</option>`)}
        </select>
      <//>` : html`<${Button} variant="primary" onClick=${() => go(kind === 'riff' ? 'riffs' : 'songs')}>${STEP_TYPES[kind].label} anlegen<//>`}
    <//>`;
  }

  return html`<div class="step step-score">
    ${item.score
      ? html`<${ScorePlayer} key=${item.id} item=${item}/>`
      : html`<p class="muted">Hier sind noch keine abspielbaren Tabs hinterlegt.</p>`}
    <${Attachments} item=${item}/>
    <div class="row between score-foot">
      <p class="score-notes muted">${item.notes}</p>
      <${Button} icon="edit" onClick=${() => go(`score/${item.id}`)}>Bearbeiten<//>
    </div>
    <${TakesList}/>
  </div>`;
}
