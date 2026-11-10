// node tests/e2e-triplets.cjs: Triolen vom Tab-Leser bis zur Wiedergabe.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

// Wie im Screenshot: Takt 1 endet mit einer Viertel-Triole 10-7-5, Takt 2 beginnt mit einer 3-5-3.
const helper = {
  title: 'Triolen-Test', tempo: 90, ts: [4, 4],
  bars: [
    { beats: [{ d: 4, notes: [{ s: 2, f: 8 }] }, { d: 4, notes: [{ s: 2, f: 10 }] }, { d: 4, t: 3, notes: [{ s: 1, f: 10 }] }, { d: 4, t: 3, notes: [{ s: 1, f: 7 }] }, { d: 4, t: 3, notes: [{ s: 1, f: 5 }] }] },
    { beats: [{ d: 4, t: 3, notes: [{ s: 2, f: 3 }] }, { d: 4, t: 3, notes: [{ s: 2, f: 5 }] }, { d: 4, t: 3, notes: [{ s: 2, f: 3 }] }, { d: 2, notes: [{ s: 3, f: 2 }] }] },
    { beats: [{ d: 4, notes: [{ s: 6, f: 0 }] }, { d: 4, notes: [] }, { d: 2, notes: [] }] },
  ],
  uncertain: [],
};

const starts = (p, bar) => p.evaluate((i) => window.__player.score.tracks[0].staves[0].bars[i].voices[0].beats.map((b) => b.playbackStart), bar);

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}#/songs`);
  await p.click('text=Song hinzufügen');
  await p.waitForSelector('.edit-grid');
  await p.click('text=Screenshot per KI');
  await p.fill('.tab-paste', JSON.stringify(helper));
  await p.click('dialog >> text=Übernehmen');
  await p.waitForSelector('.tabed-grid');

  ok('Kein Takt als zu lang oder zu kurz markiert', (await p.locator('.tabed-bar.bad').count()) === 0);
  ok('Triolen im Editor gekennzeichnet', (await p.locator('.tabed-dur sup').count()) === 6);
  await p.waitForFunction(() => window.__player?.score?.masterBars.length === 3, null, { timeout: 15000 });
  const s1 = await starts(p, 0);
  ok('Takt 1: Triole auf Schlag 3 mit ⅔-Abständen', JSON.stringify(s1) === JSON.stringify([0, 960, 1920, 2560, 3200]), JSON.stringify(s1));
  const s2 = await starts(p, 1);
  ok('Takt 2: Triole auf Schlag 1-2, danach Halbe auf Schlag 3', JSON.stringify(s2) === JSON.stringify([0, 640, 1280, 1920]), JSON.stringify(s2));

  // Triole im Editor setzen und wieder aufheben
  const bar3 = p.locator('.tabed-bar').nth(2);
  await bar3.locator('.tabed-cell').nth(5).click();
  await p.keyboard.press('t');
  await p.waitForTimeout(150);
  ok('Taste T macht eine Triole, Takt bleibt voll', (await bar3.locator('.tabed-dur sup').count()) === 3 && !(await bar3.getAttribute('class')).includes('bad'));
  await p.waitForTimeout(900);
  const s3 = await starts(p, 2);
  ok('Wiedergabe übernimmt die neue Triole', JSON.stringify(s3) === JSON.stringify([0, 640, 1280, 1920]), JSON.stringify(s3));
  await p.click('text=Triole aufheben');
  await p.waitForTimeout(150);
  ok('Triole aufheben macht wieder normale Viertel, Takt bleibt voll', (await bar3.locator('.tabed-dur sup').count()) === 0 && !(await bar3.getAttribute('class')).includes('bad'));
  await p.waitForTimeout(900);
  const s4 = await starts(p, 2);
  ok('Wiedergabe wieder in Vierteln', JSON.stringify(s4) === JSON.stringify([0, 960, 1920, 2880]), JSON.stringify(s4));
  await p.locator('.tabed').screenshot({ path: process.argv[2] ? `${process.argv[2]}/triolen-editor.png` : '/dev/null' }).catch(() => {});

  // Nach Neuladen noch da, und im Übungsmodus abspielbar
  await p.click('.page-head >> text=Üben');
  await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  ok('Song mit Triolen ist abspielbar', JSON.stringify(await starts(p, 0)) === JSON.stringify([0, 960, 1920, 2560, 3200]));
  await p.waitForFunction(() => /von 3 Takten/.test(document.querySelector('.transport-bar')?.textContent || '') && document.querySelector('.tab-host svg, .tab-host .at-surface svg'), null, { timeout: 15000 });
  await p.waitForTimeout(800);
  if (process.argv[2]) await p.locator('.tab-viewport').screenshot({ path: `${process.argv[2]}/triolen-tabs.png` });

  console.log(errors.length ? `Browser-Fehler: ${errors.join(' | ')}` : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
