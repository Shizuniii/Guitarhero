// node tests/e2e-bars.cjs: Zu lange Takte werden beim Üben gemeldet, neueres Tab-Leser-Format wird erkannt.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

const tri = (f) => ({ d: 4, t: 3, notes: [{ s: 5, f }] });
const bar1 = { beats: [{ d: 4, dot: true, notes: [{ s: 5, f: 7 }] }, { d: 8, notes: [{ s: 5, f: 7 }] }, tri(10), tri(7), tri(5)] };
const bar2 = { beats: [{ d: 2, notes: [{ s: 5, f: 3 }] }, { d: 2, notes: [{ s: 5, f: 2 }] }] };
const bar4 = { beats: [tri(3), tri(5), tri(3), { d: 2, notes: [{ s: 5, f: 2 }] }] };
const song = { title: 'Seven Nation Army', artist: 'The White Stripes', tempo: 90, ts: [4, 4], bars: [bar1, bar2, bar1, bar4], uncertain: ['Kein Tempo im Bild'] };
// So kam es bei Shy an: Eine ältere App-Version hat "t" verworfen.
const withoutT = JSON.parse(JSON.stringify(song));
withoutT.bars.forEach((b) => b.beats.forEach((x) => delete x.t));

async function importJson(p, data) {
  await p.click('text=Screenshot per KI');
  await p.fill('.tab-paste', JSON.stringify(data));
  await p.click('dialog >> text=Übernehmen');
}

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}#/riffs`);
  await p.click('text=Riff hinzufügen');
  await p.waitForSelector('.edit-grid');

  await importJson(p, withoutT);
  await p.waitForSelector('.tabed-grid');
  const toastText = await p.textContent('.toast.warn').catch(() => '');
  ok('Beim Einlesen warnt die App vor falschen Takten', /Takte 1, 3 und 4/.test(toastText), toastText);
  const id = (await p.evaluate(() => location.hash)).split('/')[2];

  await p.evaluate((x) => { location.hash = `#/frei/riff?score=${x}`; }, id);
  await p.waitForSelector('.bar-warning');
  const warn = await p.textContent('.bar-warning');
  ok('Beim Üben steht ein Hinweis über dem Player', /Takte 1, 3 und 4 passen nicht in den 4\/4-Takt/.test(warn) && /5 statt 4 Schlägen/.test(warn), warn.replace(/\s+/g, ' ').slice(0, 160));
  await p.click('.bar-warning >> text=Im Editor öffnen');
  await p.waitForSelector('.tabed-grid');
  ok('Hinweis führt in den Editor', (await p.locator('.tabed-bar.bad').count()) === 3);

  await p.evaluate((x) => { location.hash = `#/score/${x}`; }, id);
  await p.waitForSelector('.edit-grid');
  await importJson(p, { ...song, format: 3 });
  await p.waitForSelector('dialog .notice');
  ok('Neueres Format wird abgelehnt statt still verfälscht', /neueren Version des Tab-Lesers/.test(await p.textContent('dialog .notice')));
  await p.fill('.tab-paste', JSON.stringify({ ...song, format: 2 }));
  await p.click('dialog >> text=Übernehmen');
  await p.waitForSelector('.tabed-grid');
  ok('Korrekt neu eingelesen: alle Takte voll', (await p.locator('.tabed-bar.bad').count()) === 0);

  await p.evaluate((x) => { location.hash = `#/frei/riff?score=${x}`; }, id);
  await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  ok('Hinweis verschwindet nach dem Korrigieren', (await p.locator('.bar-warning').count()) === 0);
  const notes = await p.textContent('.score-notes');
  ok('KI-Hinweise werden ersetzt, nicht angehängt', (notes.match(/Unsichere Stellen laut KI/g) || []).length === 1, notes);
  const starts = await p.evaluate(() => window.__player.score.tracks[0].staves[0].bars[0].voices[0].beats.map((x) => x.playbackStart));
  ok('Triole spielt wieder richtig', JSON.stringify(starts) === JSON.stringify([0, 1440, 1920, 2560, 3200]), JSON.stringify(starts));

  console.log(errors.length ? `Browser-Fehler: ${errors.join(' | ')}` : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
