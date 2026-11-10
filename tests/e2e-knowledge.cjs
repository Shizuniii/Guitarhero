// node tests/e2e-knowledge.cjs: Stimmung, Tempo und Wissen der KI kommen vom Tab-Leser bis in Editor und Wiedergabe.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

const riff = {
  format: 3, title: 'Testriff', artist: 'Testband', tempo: 124, ts: [4, 4], tuning: 'dropd', capo: 0,
  bars: [{ beats: [{ d: 2, notes: [{ s: 6, f: 0 }] }, { d: 2, notes: [{ s: 6, f: 2 }] }] }],
  uncertain: ['Takt 1: Rhythmus geschätzt'],
  info: ['Tempo 124 BPM: Originaltempo des Songs.', 'Stimmung Drop D wie im Original.'],
};

async function importJson(p, data) {
  await p.click('text=Screenshot per KI');
  await p.fill('.tab-paste', JSON.stringify(data));
  await p.click('dialog >> text=Übernehmen');
  await p.waitForSelector('.tabed-grid');
}

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}#/riffs`);
  await p.click('text=Riff hinzufügen');
  await p.waitForSelector('.edit-grid');
  await importJson(p, riff);

  const tuning = await p.$$eval('.tabed-meta select', (ss) => ss.map((s) => s.value).find((v) => !v.includes('/'))).catch(() => '');
  ok('Editor übernimmt die Stimmung', tuning === 'dropd', tuning);
  const names = await p.$$eval('.tabed-names span', (els) => els.map((e) => e.textContent).join(''));
  ok('Saitennamen passen zur Stimmung', names === 'eBGDAD', names);
  const id = (await p.evaluate(() => location.hash)).split('/')[2];

  await p.evaluate((x) => { location.hash = `#/frei/riff?score=${x}`; }, id);
  await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  const notes = await p.textContent('.score-notes');
  ok('Wissen der KI steht in den Notizen', /Aus dem Wissen der KI: Tempo 124 BPM/.test(notes), notes.replace(/\n/g, ' | '));
  const played = await p.evaluate(() => {
    const s = window.__player.score;
    const beats = s.tracks[0].staves[0].bars[0].voices[0].beats;
    return { tempo: s.tempo, tuning: s.tracks[0].staves[0].tuning.join(','), first: beats[0].notes[0].realValue };
  });
  ok('Wiedergabe im Originaltempo', played.tempo === 124, String(played.tempo));
  ok('Tiefe Saite klingt als D', played.first === 38, `${played.first} (Stimmung ${played.tuning})`);

  // Erneut einlesen: alte KI-Zeilen werden ersetzt, eigene Notizen bleiben
  await p.evaluate((x) => { location.hash = `#/score/${x}`; }, id);
  await p.waitForSelector('.edit-grid');
  const area = p.locator('.edit-grid textarea').first();
  await area.fill(`Eigene Notiz\n${await area.inputValue()}`);
  await area.blur();
  await importJson(p, { ...riff, tuning: 'standard', format: 2, info: ['Tempo 124 BPM: Originaltempo des Songs.'] });
  await p.evaluate((x) => { location.hash = `#/score/${x}`; }, id);
  await p.waitForSelector('.edit-grid');
  const after = await area.inputValue();
  ok('Eigene Notiz bleibt, KI-Zeilen werden ersetzt',
    /^Eigene Notiz/.test(after) && (after.match(/Aus dem Wissen der KI/g) || []).length === 1 && !/Drop D/.test(after), after.replace(/\n/g, ' | '));

  console.log(errors.length ? `Browser-Fehler: ${errors.join(' | ')}` : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
