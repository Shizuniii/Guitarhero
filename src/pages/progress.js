import { html, useState } from '../../vendor/htm-preact.js';
import { dayKey, fmtDate, fmtMinutes, fmtTime, useStore } from '../lib/core.js';
import { displayChordName } from '../lib/chords.js';
import { records, sessions, STEP_TYPES } from '../lib/state.js';
import { PageHead } from '../ui/common.js';

const DAYS = 14;

function lastDays() {
  const out = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push({ key: dayKey(d.getTime()), date: d });
  }
  return out;
}

function streak(byDay) {
  let n = 0;
  const d = new Date();
  if (!byDay[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  while (byDay[dayKey(d.getTime())]) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function DayChart({ days, byDay }) {
  const [hover, setHover] = useState(null);
  const values = days.map((d) => (byDay[d.key] || 0) / 60);
  const max = Math.max(10, ...values);
  const nice = Math.ceil(max / 10) * 10;
  const W = 640;
  const H = 200;
  const pad = { l: 34, r: 8, t: 12, b: 24 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const slot = plotW / days.length;
  const barW = Math.min(22, slot - 6);
  const y = (v) => pad.t + plotH * (1 - v / nice);
  const label = (d) => d.date.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
  return html`<figure class="chart">
    <figcaption>Übungszeit in Minuten, letzte 14 Tage</figcaption>
    <div class="chart-box">
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${`Übungsminuten pro Tag, zuletzt ${Math.round(values[values.length - 1])} Minuten heute`}>
        ${[0, nice / 2, nice].map((v) => html`<g>
          <line class="chart-grid" x1=${pad.l} x2=${W - pad.r} y1=${y(v)} y2=${y(v)}/>
          <text class="chart-axis" x=${pad.l - 8} y=${y(v) + 4} text-anchor="end">${v}</text>
        </g>`)}
        ${days.map((d, i) => {
          const v = values[i];
          const x = pad.l + i * slot + (slot - barW) / 2;
          const top = y(v);
          const h = pad.t + plotH - top;
          const r = Math.min(4, h);
          return html`<g onMouseEnter=${() => setHover(i)} onMouseLeave=${() => setHover(null)}>
            <rect x=${pad.l + i * slot} y=${pad.t} width=${slot} height=${plotH + pad.b} fill="transparent"/>
            ${v > 0 && html`<path class="chart-bar" d=${`M${x} ${top + h}V${top + r}q0 ${-r} ${r} ${-r}h${barW - 2 * r}q${r} 0 ${r} ${r}V${top + h}z`}/>`}
            ${(i % 2 === 1) && html`<text class="chart-axis" x=${x + barW / 2} y=${H - 6} text-anchor="middle">${label(d)}</text>`}
          </g>`;
        })}
      </svg>
      ${hover !== null && html`<div class="chart-tip" style=${`left:${((pad.l + hover * slot + slot / 2) / W) * 100}%`}>
        <b>${Math.round(values[hover])} Min.</b> am ${days[hover].date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
      </div>`}
    </div>
  </figure>`;
}

function Spark({ history }) {
  if (history.length < 2) return null;
  const w = 120;
  const h = 32;
  const vals = history.map((e) => e.count);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = Math.max(1, max - min);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * (w - 8) + 4},${h - 5 - ((v - min) / span) * (h - 10)}`);
  const last = pts[pts.length - 1].split(',');
  return html`<svg class="spark" width=${w} height=${h} viewBox=${`0 0 ${w} ${h}`} role="img" aria-label=${`Verlauf von ${vals[0]} bis ${vals[vals.length - 1]} Wechseln`}>
    <polyline points=${pts.join(' ')}/>
    <circle cx=${last[0]} cy=${last[1]} r="4"/>
  </svg>`;
}

export function ProgressPage() {
  const log = useStore(sessions.store);
  const recs = useStore(records.store);
  const byDay = {};
  const byType = {};
  let total = 0;
  for (const s of log) {
    const k = dayKey(s.at);
    byDay[k] = (byDay[k] || 0) + s.seconds;
    byType[s.type] = (byType[s.type] || 0) + s.seconds;
    total += s.seconds;
  }
  const days = lastDays();
  const week = days.slice(-7).reduce((n, d) => n + (byDay[d.key] || 0), 0);
  const series = streak(byDay);
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  return html`<div class="page">
    <${PageHead} title="Fortschritt"/>
    <dl class="stats">
      <div><dt>Diese 7 Tage</dt><dd>${fmtMinutes(week)}</dd></div>
      <div><dt>Gesamt</dt><dd>${fmtMinutes(total)}</dd></div>
      <div><dt>Serie</dt><dd>${series} ${series === 1 ? 'Tag' : 'Tage'}</dd></div>
    </dl>
    ${total === 0
      ? html`<p class="muted">Hier erscheint deine Übungszeit, sobald du einen Timer gestartet oder einen Song abgespielt hast.</p>`
      : html`<${DayChart} days=${days} byDay=${byDay}/>`}
    ${types.length > 0 && html`<section>
      <h2>Wofür du geübt hast</h2>
      <table class="table">
        <thead><tr><th>Bereich</th><th class="num">Zeit</th></tr></thead>
        <tbody>${types.map(([t, s]) => html`<tr><td>${STEP_TYPES[t]?.label || t}</td><td class="num">${fmtMinutes(s)}</td></tr>`)}</tbody>
      </table>
    </section>`}
    <section>
      <h2>Rekorde bei Akkordwechseln</h2>
      ${!recs.length && html`<p class="muted">Trage nach einem Timer deine Wechsel ein, dann entstehen hier deine Rekorde.</p>`}
      ${recs.length > 0 && html`<table class="table">
        <thead><tr><th>Akkorde</th><th>Zeit</th><th class="num">Rekord</th><th>Am</th><th>Verlauf</th></tr></thead>
        <tbody>${recs.map((r) => html`<tr key=${r.id}>
          <td>${displayChordName(r.a)} und ${displayChordName(r.b)}</td>
          <td>${fmtTime(r.seconds)}</td>
          <td class="num"><b>${r.best}</b></td>
          <td>${r.bestAt ? fmtDate(r.bestAt) : ''}</td>
          <td><${Spark} history=${r.history || []}/></td>
        </tr>`)}</tbody>
      </table>`}
    </section>
  </div>`;
}
