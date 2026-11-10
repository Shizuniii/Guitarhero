import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { APP_VERSION } from '../config.js';
import { useStore } from '../lib/core.js';
import { exportBackup, importBackup } from '../lib/backup.js';
import { folderState, forgetFolder, pickFolder, reconnectFolder } from '../lib/folder.js';
import { acquireMic, releaseMic } from '../lib/mic.js';
import { settings, updateSettings } from '../lib/state.js';
import { setTimerDuration } from '../lib/timer.js';
import { toast } from '../lib/ui-state.js';
import { LevelMeter } from '../steps/record.js';
import { audioCtx, beep, resumeAudio } from '../lib/audio.js';
import { analyze } from '../lib/analyze.js';
import { startRecording } from '../lib/recorder.js';
import { Button, Field, PageHead, Segmented, Stepper, Toggle } from '../ui/common.js';
import { MicSelect } from '../ui/tuner.js';

const KEYS = [
  ['Leertaste', 'Timer oder Wiedergabe starten und anhalten'],
  ['N oder Bild runter', 'Nächster Schritt'],
  ['P oder Bild hoch', 'Vorheriger Schritt'],
  ['Pfeil links und rechts', 'Einen Takt zurück oder vor'],
  ['Pos1', 'An den Anfang'],
  ['+ und -', 'Tempo ändern'],
  ['L', 'Loop an oder aus'],
  ['[ und ]', 'Bereich am aktuellen Takt beginnen oder beenden'],
  ['Enter oder Z', 'Akkordwechsel zählen'],
  ['M', 'Metronom'],
  ['T', 'Timer öffnen'],
  ['G', 'Stimmgerät öffnen'],
];

function MicTest() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return undefined;
    return () => releaseMic();
  }, [on]);
  return html`<div class="stack">
    <${Button} onClick=${async () => {
      if (on) { setOn(false); return; }
      try { await acquireMic(); setOn(true); } catch { toast('Das Mikrofon lässt sich nicht öffnen.', 'warn'); }
    }}>${on ? 'Test beenden' : 'Mikrofon testen'}<//>
    ${on && html`<${LevelMeter} active/>`}
  </div>`;
}

const CAL_CLICKS = 12;
const CAL_COUNT_IN = 4;
const CAL_GAP = 0.75;

function Calibration() {
  const ms = useStore(settings, (s) => s.latencyMs);
  const [state, setState] = useState({ phase: 'idle' });

  async function run() {
    let rec;
    try {
      rec = await startRecording({ tap: true });
    } catch {
      toast('Das Mikrofon lässt sich nicht öffnen.', 'warn');
      return;
    }
    const ctx = await resumeAudio();
    for (let i = 0; i < 50 && rec.tapStart() === null; i++) await new Promise((r) => setTimeout(r, 20));
    const t0 = ctx.currentTime + 0.5;
    const clicks = [];
    for (let i = 0; i < CAL_CLICKS; i++) {
      const t = t0 + i * CAL_GAP;
      beep({ freq: i < CAL_COUNT_IN ? 880 : 1320, when: t, dur: 0.05, gain: 0.35 });
      if (i >= CAL_COUNT_IN) clicks.push(t);
    }
    const tick = setInterval(() => {
      const n = Math.floor((ctx.currentTime - t0) / CAL_GAP) + 1;
      setState({ phase: 'running', n: Math.max(0, Math.min(CAL_CLICKS, n)) });
    }, 60);
    await new Promise((r) => setTimeout(r, (0.5 + CAL_CLICKS * CAL_GAP + 0.6) * 1000));
    clearInterval(tick);
    setState({ phase: 'working' });
    const { audio } = await rec.stop();
    if (!audio) { setState({ phase: 'failed', reason: 'Dieser Browser kann die Aufnahme nicht genau genug auslesen.' }); return; }
    const r = await analyze({ kind: 'calibration', samples: audio.samples, sampleRate: audio.sampleRate, startTime: audio.startTime, clicks });
    if (r.ok && r.latencyMs > -20 && r.latencyMs < 600) {
      updateSettings({ latencyMs: r.latencyMs });
      setState({ phase: 'done', r });
    } else {
      setState({ phase: 'failed', reason: r.found < 5 ? `Nur ${r.found} von 8 Anschlägen gehört. Schlage kräftiger an und prüfe das Mikrofon.` : 'Die Anschläge lagen zu unterschiedlich. Versuche es nochmal, möglichst genau auf die Klicks.' });
    }
  }

  const n = state.n || 0;
  return html`<div class="stack">
    <p class="muted">Zwischen Klick im Kopfhörer und deinem Anschlag im Mikrofon vergeht etwas Zeit. Der Abgleich misst sie, damit die Bewertung beim Strummen weiß, ob du zu früh oder zu spät bist.</p>
    <p>${ms !== null && ms !== undefined ? `Gemessen: ${ms} ms` : 'Noch nicht abgeglichen.'}</p>
    ${state.phase === 'running' && html`<p class="cal-count" role="status">${n <= CAL_COUNT_IN ? `Einzählen ${n} von ${CAL_COUNT_IN}` : `Anschlagen: ${n - CAL_COUNT_IN} von ${CAL_CLICKS - CAL_COUNT_IN}`}</p>`}
    ${state.phase === 'working' && html`<p role="status">Wird ausgewertet…</p>`}
    ${state.phase === 'done' && html`<p role="status">Fertig: ${state.r.latencyMs} ms, Abweichung ±${state.r.spreadMs} ms.</p>`}
    ${state.phase === 'failed' && html`<p class="notice" role="alert">${state.reason}</p>`}
    <div class="row wrap">
      <${Button} variant="primary" disabled=${state.phase === 'running' || state.phase === 'working'} onClick=${run}>Abgleich starten<//>
      ${ms !== null && ms !== undefined && html`<${Button} onClick=${() => updateSettings({ latencyMs: null })}>Zurücksetzen<//>`}
    </div>
    <p class="muted small">Setz das Headset auf. Nach 4 Klicks zum Einzählen schlägst du bei den nächsten 8 Klicks jeweils eine leere Saite an.</p>
  </div>`;
}

export function SettingsPage({ install }) {
  const s = useStore(settings);
  const folder = useStore(folderState);
  const backupFile = useRef(null);
  const [withRecordings, setWithRecordings] = useState(false);
  const [storage, setStorage] = useState(null);

  useEffect(() => {
    (async () => {
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      setStorage({ used: est?.usage || 0, persisted });
    })();
  }, []);

  async function askPersist() {
    const ok = await navigator.storage?.persist?.();
    setStorage({ ...storage, persisted: ok });
    toast(ok ? 'Der Browser hält deine Daten jetzt dauerhaft.' : 'Der Browser hat das abgelehnt. Installiere die App oder nutze den Aufnahme-Ordner.', ok ? 'good' : 'warn', 6000);
  }

  async function restore(e) {
    const file = e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      await importBackup(file);
      toast('Sicherung eingespielt', 'good');
    } catch (err) {
      toast(err.message || 'Diese Datei lässt sich nicht einspielen.', 'warn', 6000);
    }
  }

  return html`<div class="page settings">
    <${PageHead} title="Einstellungen"/>

    <section class="stack">
      <h2>Mikrofon</h2>
      <${MicSelect}/>
      <${MicTest}/>
    </section>

    <section class="stack">
      <h2>Deine Gitarre</h2>
      <${Field} label="Art" hint="Bestimmt den Klang beim Abspielen und wie die App deine Töne erkennt.">
        <${Segmented} label="Gitarre" value=${s.guitar} onChange=${(v) => updateSettings({ guitar: v })}
          options=${[{ value: 'nylon', label: 'Konzertgitarre (Nylon)' }, { value: 'steel', label: 'Westerngitarre (Stahl)' }, { value: 'electric', label: 'E-Gitarre' }]}/>
      <//>
      <h3>Timing-Abgleich</h3>
      <${Calibration}/>
    </section>

    <section class="stack">
      <h2>Timer</h2>
      <${Field} label="Standarddauer" hint="Gilt für neue Schritte und den alleinstehenden Timer.">
        <${Stepper} label="Standarddauer" unit="Sek." value=${s.timerSeconds} min=${5} max=${3600} step=${5} onChange=${(v) => { updateSettings({ timerSeconds: v }); setTimerDuration(v); }}/>
      <//>
      <${Field} label="Countdown vor dem Start"><${Stepper} label="Countdown" unit="Sek." value=${s.countdownSeconds} min=${0} max=${30} onChange=${(v) => updateSettings({ countdownSeconds: v })}/><//>
      <${Toggle} checked=${s.recordDuringTimer} onChange=${(v) => updateSettings({ recordDuringTimer: v })}>Beim Timer in einem Schritt mitschneiden<//>
      <${Field} label="Aufnahme läuft nach Timer-Ende weiter"><${Stepper} label="Nachlauf" unit="Sek." value=${s.tailSeconds} min=${0} max=${15} onChange=${(v) => updateSettings({ tailSeconds: v })}/><//>
    </section>

    <section class="stack">
      <h2>Darstellung</h2>
      <${Field} label="Farben">
        <${Segmented} label="Farben" value=${s.theme} onChange=${(v) => updateSettings({ theme: v })}
          options=${[{ value: 'auto', label: 'Wie das System' }, { value: 'dark', label: 'Palisander (dunkel)' }, { value: 'light', label: 'Ahorn (hell)' }]}/>
      <//>
      <${Field} label="Notennamen">
        <${Segmented} label="Notennamen" value=${s.noteNames} onChange=${(v) => updateSettings({ noteNames: v })}
          options=${[{ value: 'intl', label: 'B wie in Tabs aus dem Netz' }, { value: 'de', label: 'H und B wie in der Schule' }]}/>
      <//>
    </section>

    <section class="stack">
      <h2>Deine Daten</h2>
      <p class="muted">Alles liegt nur auf diesem Gerät in diesem Browser. Wenn du Browserdaten löschst, ist es weg, außer du hast einen Aufnahme-Ordner oder eine Sicherung.</p>
      ${storage && html`<p>Belegt: ${(storage.used / 1e6).toFixed(1)} MB. ${storage.persisted ? 'Dauerhafter Speicher ist aktiv.' : 'Dauerhafter Speicher ist noch nicht aktiv.'}</p>`}
      ${storage && !storage.persisted && html`<${Button} onClick=${askPersist}>Dauerhaften Speicher anfordern<//>`}

      <h3>Aufnahme-Ordner</h3>
      ${!folder.supported && html`<p class="muted">Das geht nur in Chrome oder Edge.</p>`}
      ${folder.supported && html`<div class="stack">
        <p class="muted">Dauerhaft gespeicherte Aufnahmen landen zusätzlich als Dateien in diesem Ordner. Sie bleiben dort, auch wenn der Browser seine Daten verliert.</p>
        ${folder.name && html`<p>Verbunden mit <strong>${folder.name}</strong></p>`}
        <div class="row wrap">
          <${Button} icon="folder" onClick=${async () => { try { await pickFolder(); toast('Ordner verbunden', 'good'); } catch { /* abgebrochen */ } }}>${folder.name ? 'Anderen Ordner wählen' : 'Ordner wählen'}<//>
          ${folder.name && folder.permission === 'prompt' && html`<${Button} onClick=${reconnectFolder}>Ordner freigeben<//>`}
          ${folder.name && html`<${Button} onClick=${forgetFolder}>Verbindung trennen<//>`}
        </div>
      </div>`}

      <h3>Sicherung</h3>
      <${Toggle} checked=${withRecordings} onChange=${setWithRecordings}>Aufnahmen einschließen<//>
      <div class="row wrap">
        <${Button} icon="download" onClick=${() => exportBackup({ withRecordings })}>Sicherung herunterladen<//>
        <${Button} icon="upload" onClick=${() => backupFile.current.click()}>Sicherung einspielen<//>
      </div>
      <input ref=${backupFile} type="file" hidden accept="application/json,.json" onChange=${restore}/>
    </section>

    ${install && html`<section class="stack">
      <h2>Als App installieren</h2>
      <p class="muted">Guitarhero läuft dann im eigenen Fenster und auch ohne Internet.</p>
      <${Button} variant="primary" onClick=${install}>Installieren<//>
    </section>`}

    <section class="stack">
      <h2>Tastenkürzel</h2>
      <table class="table">
        <tbody>${KEYS.map(([k, v]) => html`<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`)}</tbody>
      </table>
    </section>
    <p class="muted small">Guitarhero ${APP_VERSION}. Mit alphaTab (MPL-2.0), Gitarrenklang aus GeneralUser GS von S. Christian Collins, Sonivox-Soundfont, chords-db (MIT), Preact und htm.</p>
  </div>`;
}
