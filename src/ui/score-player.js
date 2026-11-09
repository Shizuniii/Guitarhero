// Tab-Anzeige und Wiedergabe mit alphaTab: Tempo, Takte, Bereich, Loop, Speed-Trainer, Mitschnitt.
import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { audioCtx, resumeAudio } from '../lib/audio.js';
import { clamp, useStore } from '../lib/core.js';
import { micState } from '../lib/mic.js';
import { metronomeBridge, stopMetronome } from '../lib/metronome.js';
import { loadRecordingBlob, startRecording } from '../lib/recorder.js';
import { queueTake } from '../lib/take-control.js';
import { latency } from '../lib/analyze.js';
import { logPractice, recordings, scores, settings, updateSettings } from '../lib/state.js';
import { GUITAR_PROGRAMS, toAlphaTex } from '../lib/tabformat.js';
import { setHotkeys, toast } from '../lib/ui-state.js';
import { Button, Field, Segmented, Stepper, Toggle } from './common.js';
import { decodeBlob } from './wave.js';

const base = new URL('.', location.href).href;
let loading = null;

export function loadAlphaTab() {
  if (window.alphaTab) return Promise.resolve(window.alphaTab);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${base}vendor/alphatab/alphaTab.min.js`;
    s.onload = () => resolve(window.alphaTab);
    s.onerror = () => reject(new Error('alphaTab lässt sich nicht laden'));
    document.head.append(s);
  });
  return loading;
}

function themeColors(host) {
  const st = getComputedStyle(host);
  const read = (n) => st.getPropertyValue(n).trim();
  return {
    staffLineColor: read('--tab-line'),
    barSeparatorColor: read('--tab-line'),
    barNumberColor: read('--tab-muted'),
    mainGlyphColor: read('--tab-ink'),
    secondaryGlyphColor: read('--tab-muted'),
    scoreInfoColor: read('--tab-ink'),
  };
}

function loadInto(api, item, texOverride, trackIndex) {
  if (texOverride !== undefined) { api.tex(texOverride); return; }
  const s = item.score;
  if (!s) return;
  if (s.format === 'model') api.tex(toAlphaTex(s.data, { program: GUITAR_PROGRAMS[settings.get().guitar] }));
  else if (s.format === 'alphatex') api.tex(s.data);
  else api.load(new Uint8Array(s.data), [trackIndex ?? 0]);
}

// Erwartete Noten aus der Partitur, zeitlich passend zur aufgezeichneten Wiedergabe.
function expectedEvents(a, trackIndex, trace, ts) {
  const runs = [];
  let cur = [];
  for (const p of trace) {
    if (cur.length && p.tick < cur[cur.length - 1].tick - 10) { runs.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length) runs.push(cur);
  const staff = a.score?.tracks[trackIndex]?.staves[0];
  if (!staff || !a.tickCache) return [];
  const events = [];
  for (const run of runs) {
    const pts = run.filter((p, i) => i === run.length - 1 || run[i + 1].tick > p.tick);
    if (pts.length < 2) continue;
    const lo = pts[0].tick;
    const hi = pts[pts.length - 1].tick;
    const toPerf = (tick) => {
      let i = 1;
      while (i < pts.length - 1 && pts[i].tick < tick) i++;
      const p = pts[i - 1];
      const q = pts[i];
      return p.perf + ((tick - p.tick) * (q.perf - p.perf)) / Math.max(1, q.tick - p.tick);
    };
    for (const mb of a.tickCache.masterBars) {
      if (mb.end <= lo || mb.start > hi) continue;
      const bar = staff.bars[mb.masterBar.index];
      if (!bar) continue;
      for (const beat of bar.voices[0].beats) {
        if (beat.isRest) continue;
        const notes = beat.notes.filter((n) => !n.isTieDestination && !n.isDead).map((n) => ({ midi: n.realValue, string: n.string - 1, fret: n.fret }));
        if (!notes.length) continue;
        const tick = mb.start + beat.playbackStart;
        if (tick < lo - 5 || tick > hi) continue;
        events.push({ time: ts.contextTime + (toPerf(tick) - ts.performanceTime) / 1000, bar: mb.masterBar.index + 1, idx: beat.index, notes });
      }
    }
  }
  return events;
}

export function ScorePlayer({ item, tex, compact, onBars }) {
  const host = useRef(null);
  const viewport = useRef(null);
  const api = useRef(null);
  const cfg = useStore(settings, (s) => s.player);
  const theme = useStore(settings, (s) => s.theme);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(item?.lastSpeed || 100);
  const [loop, setLoop] = useState(false);
  const [bar, setBar] = useState(1);
  const [barCount, setBarCount] = useState(0);
  const [tempo, setTempo] = useState(90);
  const [range, setRange] = useState(null);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [guitarOn, setGuitarOn] = useState(true);
  const [click, setClick] = useState(cfg.click);
  const [countIn, setCountIn] = useState(cfg.countIn);
  const [more, setMore] = useState(false);
  const [record, setRecord] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [track, setTrack] = useState(0);
  const [trainer, setTrainer] = useState({ on: false, from: 60, to: 100, step: 5, every: 2 });
  const [trainerInfo, setTrainerInfo] = useState('');

  const live = useRef({});
  Object.assign(live.current, { speed, loop, trainer, record, range, guitarOn, track, bar, item, tempo });

  function barIndexAt(tick) {
    const list = api.current?.tickCache?.masterBars;
    if (!list?.length) return 0;
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (list[mid].start <= tick) lo = mid; else hi = mid - 1;
    }
    return list[lo].masterBar.index;
  }

  function applySpeed(pct) {
    const v = clamp(Math.round(pct), 25, 200);
    setSpeedState(v);
    if (api.current) api.current.playbackSpeed = v / 100;
    return v;
  }

  function seekBar(n) {
    const a = api.current;
    if (!a?.tickCache) return;
    const target = clamp(n, 1, barCount || 1);
    const entry = a.tickCache.masterBars.find((m) => m.masterBar.index === target - 1);
    if (!entry) return;
    a.tickPosition = entry.start;
    setBar(target);
  }

  const toStart = () => {
    const a = api.current;
    if (!a) return;
    if (a.playbackRange) a.tickPosition = a.playbackRange.startTick;
    else { a.stop(); setBar(1); }
  };

  function beatsOfBar(n) {
    const a = api.current;
    const t = a.tracks?.[0] || a.score.tracks[0];
    const b = t.staves[0].bars[n - 1];
    return b?.voices[0].beats || [];
  }

  function applyRange(a, b) {
    const x = api.current;
    if (!x?.tickCache) return;
    const start = clamp(Math.min(a, b), 1, barCount);
    const end = clamp(Math.max(a, b), 1, barCount);
    const list = x.tickCache.masterBars;
    const first = list.find((m) => m.masterBar.index === start - 1);
    const last = [...list].reverse().find((m) => m.masterBar.index === end - 1);
    if (!first || !last) return;
    x.playbackRange = { startTick: first.start, endTick: last.end };
    const bs = beatsOfBar(start);
    const be = beatsOfBar(end);
    if (bs.length && be.length) x.highlightPlaybackRange(bs[0], be[be.length - 1]);
    x.tickPosition = first.start;
    setFrom(start);
    setTo(end);
    setRange([start, end]);
    setBar(start);
  }

  function clearRange() {
    const x = api.current;
    if (!x) return;
    x.playbackRange = null;
    x.clearPlaybackRangeHighlight();
    setRange(null);
  }

  const toggleLoop = () => {
    const next = !loop;
    setLoop(next);
    if (api.current) api.current.isLooping = next;
  };

  const togglePlay = async () => {
    await resumeAudio();
    api.current?.playPause();
  };

  useEffect(() => {
    let alive = true;
    let playStart = 0;
    let takeHandle = null;
    let takeInfo = null;
    let trace = [];
    let clock = null;
    let loops = 0;
    const offs = [];

    (async () => {
      stopMetronome();
      const alphaTab = await loadAlphaTab();
      if (!alive) return;
      const NE = alphaTab.NotationElement;
      const a = new alphaTab.AlphaTabApi(host.current, {
        core: {
          fontDirectory: `${base}vendor/alphatab/font/`,
          scriptFile: `${base}vendor/alphatab/alphaTab.min.js`,
          useWorkers: true,
          logLevel: 'warning',
        },
        display: {
          staveProfile: cfg.stave,
          layoutMode: cfg.layout,
          scale: (window.innerWidth < 700 ? Math.min(cfg.zoom, 100) : cfg.zoom) / 100,
          resources: themeColors(host.current),
        },
        notation: {
          rhythmMode: 'ShowWithBars',
          elements: new Map([
            [NE.ScoreTitle, false], [NE.ScoreSubTitle, false], [NE.ScoreArtist, false], [NE.ScoreAlbum, false],
            [NE.ScoreWords, false], [NE.ScoreMusic, false], [NE.ScoreWordsAndMusic, false], [NE.ScoreCopyright, false],
            [NE.EffectDynamics, false], [NE.GuitarTuning, false],
          ]),
        },
        player: {
          enablePlayer: true,
          enableCursor: true,
          enableUserInteraction: true,
          enablePlaybackRangeSelection: true,
          resetPlaybackRangeOnClick: false,
          soundFont: `${base}vendor/alphatab/soundfont/sonivox.sf2`,
          scrollElement: viewport.current,
          scrollMode: 'OffScreen',
          scrollOffsetY: -24,
        },
      });
      api.current = a;
      window.__player = a;
      a.playbackSpeed = speed / 100;
      a.metronomeVolume = click ? 1 : 0;
      a.countInVolume = countIn ? 1 : 0;

      a.error.on((e) => {
        setError(`Diese Noten lassen sich nicht öffnen: ${e?.message || 'unbekanntes Format'}`);
      });
      a.scoreLoaded.on((score) => {
        setBarCount(score.masterBars.length);
        setTempo(score.tempo || 90);
        setTo((t) => (t > 1 ? t : score.masterBars.length));
        setTracks(score.tracks.map((t, i) => ({ index: i, name: t.name || `Spur ${i + 1}` })));
        setError('');
        onBars?.(score.masterBars.length);
      });
      a.playerReady.on(() => setReady(true));
      a.playerPositionChanged.on((e) => {
        if (takeHandle) trace.push({ perf: performance.now(), tick: e.currentTick });
        const n = barIndexAt(e.currentTick) + 1;
        if (n !== live.current.bar) setBar(n);
      });
      a.playbackRangeChanged.on((e) => {
        const r = e.playbackRange;
        if (!r) { setRange(null); return; }
        const s = barIndexAt(r.startTick) + 1;
        const t = barIndexAt(r.endTick - 1) + 1;
        setFrom(s);
        setTo(t);
        setRange([s, t]);
      });
      a.playerFinished.on(() => {
        const l = live.current;
        loops += 1;
        if (l.trainer.on && l.loop && loops % l.trainer.every === 0) {
          const next = Math.min(l.trainer.to, l.speed + l.trainer.step);
          if (next !== l.speed) {
            applySpeed(next);
            setTrainerInfo(`Tempo auf ${next} % erhöht`);
          } else {
            setTrainerInfo(`Ziel von ${next} % erreicht`);
          }
        }
      });
      a.playerStateChanged.on(async (e) => {
        const isPlaying = e.state === 1;
        setPlaying(isPlaying);
        if (isPlaying) {
          playStart = performance.now();
          loops = 0;
          if (live.current.record && !takeHandle) {
            takeInfo = {
              startTick: a.tickPosition,
              startBar: barIndexAt(a.tickPosition) + 1,
              speed: live.current.speed,
              range: live.current.range,
              loop: live.current.loop,
            };
            try {
              trace = [];
              takeHandle = await startRecording({ tap: true });
              clock = audioCtx().getOutputTimestamp?.() || { contextTime: audioCtx().currentTime, performanceTime: performance.now() };
            } catch {
              toast(micState.get().message || 'Die Aufnahme ließ sich nicht starten.', 'warn', 7000);
            }
          }
        } else {
          if (playStart) {
            const it = live.current.item;
            logPractice({ type: it?.kind || 'song', title: it?.title || 'Tab', seconds: (performance.now() - playStart) / 1000 });
            playStart = 0;
          }
          if (takeHandle) {
            const h = takeHandle;
            takeHandle = null;
            const result = await h.stop();
            const it = live.current.item;
            const events = clock ? expectedEvents(a, live.current.track, trace, clock) : [];
            const lat = latency();
            queueTake(result, {
              type: it?.kind, title: it?.title, scoreId: it?.id, ...takeInfo,
              analysis: events.length ? { kind: 'score', events, latency: lat.sec } : null,
            });
          }
        }
      });

      loadInto(a, item, tex, track);
    })().catch((e) => setError(e.message));

    return () => {
      alive = false;
      offs.forEach((f) => f());
      takeHandle?.cancel();
      if (playStart) {
        const it = live.current.item;
        logPractice({ type: it?.kind || 'song', title: it?.title || 'Tab', seconds: (performance.now() - playStart) / 1000 });
      }
      api.current?.destroy();
      api.current = null;
      window.__player = null;
    };
  }, [item?.id, theme]);

  // Der Editor reicht bei Änderungen neuen alphaTex-Text herein.
  useEffect(() => {
    if (tex !== undefined && api.current) api.current.tex(tex);
  }, [tex]);

  useEffect(() => {
    const effective = Math.round(tempo * speed / 100);
    if (compact) return undefined;
    metronomeBridge.set({
      title: item?.title || 'diesem Tab',
      bpm: effective,
      on: click,
      setBpm: (b) => applySpeed((b / live.current.tempo) * 100),
      toggle: () => toggleClick(),
    });
    return () => metronomeBridge.set(null);
  }, [tempo, speed, click, item?.id]);

  useEffect(() => {
    if (compact) return undefined;
    setHotkeys({
      ' ': togglePlay,
      ArrowLeft: () => seekBar(bar - 1),
      ArrowRight: () => seekBar(bar + 1),
      Home: toStart,
      '+': () => applySpeed(speed + 5),
      '-': () => applySpeed(speed - 5),
      l: toggleLoop,
      '[': () => applyRange(bar, range ? range[1] : barCount),
      ']': () => applyRange(range ? range[0] : 1, bar),
    });
    return () => setHotkeys({});
  });

  function toggleClick() {
    const next = !click;
    setClick(next);
    if (api.current) api.current.metronomeVolume = next ? 1 : 0;
    updateSettings({ player: { click: next } });
  }

  function toggleCountIn() {
    const next = !countIn;
    setCountIn(next);
    if (api.current) api.current.countInVolume = next ? 1 : 0;
    updateSettings({ player: { countIn: next } });
  }

  function toggleGuitar(on) {
    setGuitarOn(on);
    const a = api.current;
    if (!a?.score) return;
    a.changeTrackMute([a.score.tracks[track]], !on);
  }

  function pickTrack(i) {
    const a = api.current;
    if (!a?.score) return;
    setTrack(i);
    a.renderTracks([a.score.tracks[i]]);
  }

  function changeView(patch) {
    updateSettings({ player: patch });
    const a = api.current;
    if (!a) return;
    if (patch.stave) a.settings.display.staveProfile = window.alphaTab.StaveProfile[patch.stave];
    if (patch.layout) a.settings.display.layoutMode = window.alphaTab.LayoutMode[patch.layout];
    if (patch.zoom) a.settings.display.scale = patch.zoom / 100;
    a.updateSettings();
    if (patch.stave && a.score) a.renderScore(a.score, [track]);
    else a.render();
  }

  async function playWithRecording(rec) {
    const a = api.current;
    if (!a) return;
    const blob = await loadRecordingBlob(rec.id);
    const buffer = await decodeBlob(blob);
    const c = await resumeAudio();
    const m = rec.meta || {};
    if (m.speed) applySpeed(m.speed);
    if (m.range) applyRange(m.range[0], m.range[1]); else clearRange();
    if (m.startTick !== undefined) a.tickPosition = m.startTick;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx().destination);
    let started = false;
    let off = null;
    // Das Ereignis feuert beim Anmelden sofort mit dem aktuellen Stand.
    off = a.playerStateChanged.on((e) => {
      if (e.state === 1 && !started) {
        started = true;
        src.start();
      } else if (e.state !== 1 && started) {
        try { src.stop(); } catch { /* schon beendet */ }
        off?.();
      }
    });
    a.play();
  }

  const effective = Math.round(tempo * speed / 100);
  const linked = useStore(recordings.store).filter((r) => item && r.meta?.scoreId === item.id).slice(-3).reverse();

  return html`<div class=${`player ${compact ? 'compact' : ''}`}>
    <div class="transport" role="toolbar" aria-label="Wiedergabe">
      <${Button} icon="start" aria-label="An den Anfang" onClick=${toStart}/>
      <${Button} icon="barPrev" aria-label="Einen Takt zurück" onClick=${() => seekBar(bar - 1)}/>
      <${Button} icon=${playing ? 'pause' : 'play'} variant="primary" size="lg" aria-label=${playing ? 'Anhalten' : 'Abspielen'} disabled=${!ready} onClick=${togglePlay}/>
      <${Button} icon="barNext" aria-label="Einen Takt vor" onClick=${() => seekBar(bar + 1)}/>
      <div class="transport-bar"><b>${bar}</b><span>von ${barCount || '–'} Takten</span></div>
      <div class="speed" role="group" aria-label="Tempo">
        <${Button} size="sm" aria-label="5 Prozent langsamer" onClick=${() => applySpeed(speed - 5)}>−5<//>
        <${Button} size="sm" aria-label="1 Prozent langsamer" onClick=${() => applySpeed(speed - 1)}>−1<//>
        <div class="speed-value"><b>${speed} %</b><span>${effective} BPM</span></div>
        <${Button} size="sm" aria-label="1 Prozent schneller" onClick=${() => applySpeed(speed + 1)}>+1<//>
        <${Button} size="sm" aria-label="5 Prozent schneller" onClick=${() => applySpeed(speed + 5)}>+5<//>
      </div>
      <div class="row wrap transport-toggles">
        <${Button} icon="loop" variant=${loop ? 'on' : 'plain'} aria-pressed=${loop} onClick=${toggleLoop}>Loop<//>
        <${Button} icon="metronome" variant=${click ? 'on' : 'plain'} aria-pressed=${click} onClick=${toggleClick}>Metronom<//>
        <${Button} variant=${countIn ? 'on' : 'plain'} aria-pressed=${countIn} onClick=${toggleCountIn}>Einzählen<//>
        ${!compact && html`<${Button} icon="record" variant=${record ? 'rec' : 'plain'} aria-pressed=${record} onClick=${() => setRecord(!record)}>Mitschneiden<//>`}
        <${Button} aria-expanded=${more} onClick=${() => setMore(!more)}>Mehr<//>
      </div>
    </div>

    ${record && html`<p class="muted small">Die Aufnahme läuft, solange die Wiedergabe läuft. Nimm Kopfhörer, damit die Wiedergabe nicht mit im Mikrofon landet.</p>`}

    ${more && html`<div class="player-more">
      <div class="more-group">
        <h4>Takte wählen</h4>
        <div class="row wrap">
          <${Field} label="Von Takt"><input type="number" min="1" max=${barCount} value=${from} onChange=${(e) => setFrom(Number(e.currentTarget.value))}/><//>
          <${Field} label="Bis Takt"><input type="number" min="1" max=${barCount} value=${to} onChange=${(e) => setTo(Number(e.currentTarget.value))}/><//>
          <${Button} onClick=${() => applyRange(from, to)}>Bereich setzen<//>
          ${range && html`<${Button} onClick=${clearRange}>Bereich aufheben<//>`}
        </div>
        <p class="muted small">Oder ziehe mit der Maus direkt in den Tabs über die Takte.</p>
      </div>
      <div class="more-group">
        <h4>Speed-Trainer</h4>
        <${Toggle} checked=${trainer.on} onChange=${(on) => {
          setTrainer({ ...trainer, on });
          if (on) { applySpeed(trainer.from); if (!loop) toggleLoop(); }
          setTrainerInfo('');
        }}>Tempo im Loop automatisch steigern<//>
        <div class="row wrap">
          <${Field} label="Start in %"><input type="number" min="25" max="200" value=${trainer.from} onChange=${(e) => setTrainer({ ...trainer, from: Number(e.currentTarget.value) })}/><//>
          <${Field} label="Ziel in %"><input type="number" min="25" max="200" value=${trainer.to} onChange=${(e) => setTrainer({ ...trainer, to: Number(e.currentTarget.value) })}/><//>
          <${Field} label="Schritt in %"><input type="number" min="1" max="50" value=${trainer.step} onChange=${(e) => setTrainer({ ...trainer, step: Number(e.currentTarget.value) })}/><//>
          <${Field} label="Alle … Durchgänge"><input type="number" min="1" max="20" value=${trainer.every} onChange=${(e) => setTrainer({ ...trainer, every: Number(e.currentTarget.value) })}/><//>
        </div>
        ${trainerInfo && html`<p class="muted small" role="status">${trainerInfo}</p>`}
      </div>
      <div class="more-group">
        <h4>Hören</h4>
        <${Toggle} checked=${guitarOn} onChange=${toggleGuitar}>Gitarre hören (aus: nur Cursor und Metronom)<//>
        ${tracks.length > 1 && html`<${Field} label="Angezeigte Spur">
          <select value=${track} onChange=${(e) => pickTrack(Number(e.currentTarget.value))}>
            ${tracks.map((t) => html`<option value=${t.index}>${t.name}</option>`)}
          </select>
        <//>`}
      </div>
      <div class="more-group">
        <h4>Ansicht</h4>
        <${Segmented} label="Darstellung" value=${cfg.stave} onChange=${(v) => changeView({ stave: v })}
          options=${[{ value: 'Tab', label: 'Tabs' }, { value: 'ScoreTab', label: 'Noten und Tabs' }, { value: 'Score', label: 'Noten' }]}/>
        <${Segmented} label="Anordnung" value=${cfg.layout} onChange=${(v) => changeView({ layout: v })}
          options=${[{ value: 'Page', label: 'Seite' }, { value: 'Horizontal', label: 'Laufband' }]}/>
        <${Stepper} label="Größe" unit="%" value=${cfg.zoom} min=${60} max=${200} step=${10} onChange=${(v) => changeView({ zoom: v })}/>
      </div>
    </div>`}

    ${error && html`<p class="notice" role="alert">${error}</p>`}
    <div class="tab-viewport" ref=${viewport}><div class="tab-host" ref=${host}></div></div>

    ${linked.length > 0 && html`<div class="linked-recs">
      <h4>Deine Aufnahmen dazu</h4>
      ${linked.map((r) => html`<div class="row between" key=${r.id}>
        <span>${r.title}${r.meta?.startBar ? `, ab Takt ${r.meta.startBar}` : ''}</span>
        <${Button} size="sm" icon="play" onClick=${() => playWithRecording(r)}>Zusammen abspielen<//>
      </div>`)}
    </div>`}
  </div>`;
}

// Metadaten aus einer Datei lesen, bevor sie gespeichert wird.
export async function inspectScoreFile(buffer) {
  const alphaTab = await loadAlphaTab();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buffer), new alphaTab.Settings());
  return { title: score.title || '', artist: score.artist || '', tempo: score.tempo, bars: score.masterBars.length, tracks: score.tracks.length };
}

export const saveLastSpeed = (item, speed) => scores.put({ ...item, lastSpeed: speed });
