const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${OUT}/e-in-tune.wav`] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark', permissions: ['microphone'], acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  global.__errors = errors;
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await p.goto(BASE);
  await p.waitForSelector('.step-list');

  // 1. Plan starten, Timer mit Countdown und Mitschnitt
  await p.click('text=Plan starten');
  await p.waitForSelector('.chord-title');
  ok('Akkord Am sichtbar', (await p.textContent('.chord-title')) === 'Am');
  await p.click('.timer-digits');
  await p.fill('input[aria-label="Sekunden"]', '4');
  await p.press('input[aria-label="Sekunden"]', 'Tab');
  await p.click('.timer-actions .btn-primary');
  await p.waitForSelector('.timer-count b');
  ok('5 Sekunden Countdown', (await p.textContent('.timer-count b')) === '5');
  await p.screenshot({ path: `${OUT}/run-countdown.png` });
  await p.waitForSelector('.rec-line', { timeout: 7000 });
  ok('Aufnahme läuft', (await p.textContent('.rec-line')).includes('Aufnahme läuft'));
  await p.waitForSelector('.take', { timeout: 12000 });
  await p.waitForTimeout(600);
  ok('Take erscheint', (await p.locator('.take').count()) === 1);
  ok('Nachlauf markiert', await p.locator('.wave-tail-note').count() === 1);
  await p.screenshot({ path: `${OUT}/run-take.png`, fullPage: false });
  await p.click('.take >> text=Behalten');
  await p.waitForSelector('.kept');

  // 2. Weiter zum Wechsel: Takes verschwinden
  await p.click('.dock-slot >> text=Nächster Schritt');
  await p.waitForSelector('.change-pair');
  ok('Kurzzeit-Take weg nach Modulwechsel', (await p.locator('.take').count()) === 0);
  await p.click('.timer-digits');
  await p.fill('input[aria-label="Sekunden"]', '2');
  await p.press('input[aria-label="Sekunden"]', 'Tab');
  await p.click('.timer-actions .btn-primary');
  await p.waitForFunction(() => document.querySelector('.timer-digits') && document.querySelector('.rec-line'), null, { timeout: 8000 });
  await p.click('[aria-label="Einen Wechsel dazuzählen"]');
  await p.click('[aria-label="Einen Wechsel dazuzählen"]');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.counter >> text=Eintragen', { timeout: 15000 });
  ok('Zähler zählt', (await p.textContent('.counter-now b')) === '3' && (await p.textContent('.counter .stack p')).includes('3'));
  await p.click('.counter >> text=Eintragen');
  await p.waitForSelector('.record-line b');
  ok('Rekord gespeichert', (await p.textContent('.record-line b')) === '3');
  await p.waitForTimeout(3500);

  // 3. Strum
  await p.click('.dock-slot >> text=Nächster Schritt');
  await p.waitForSelector('.strum-grid');
  const first = await p.locator('.strum-cell').first().getAttribute('class');
  await p.locator('.strum-cell').nth(1).click();
  ok('Feld wechselt', (await p.locator('.strum-cell').nth(1).getAttribute('class')).includes('s-X'));
  await p.click('.metro-actions >> text=Start');
  await p.waitForTimeout(700);
  const hit1 = await p.evaluate(() => [...document.querySelectorAll('.strum-cell')].findIndex((c) => c.classList.contains('hit')));
  await p.waitForTimeout(400);
  const hit2 = await p.evaluate(() => [...document.querySelectorAll('.strum-cell')].findIndex((c) => c.classList.contains('hit')));
  ok('Cursor läuft im Takt', hit1 !== hit2 && hit1 >= 0, `${hit1} -> ${hit2}`);
  await p.screenshot({ path: `${OUT}/run-strum.png` });
  await p.click('.metro-actions >> text=Stoppen');

  // Muster bleibt gewählt nach Neuladen
  await p.goto(`${BASE}#/strums`);
  await p.waitForSelector('.strum-grid');
  await p.selectOption('.strum-head select', { label: 'Ab und auf' });
  await p.waitForTimeout(300);
  await p.reload();
  await p.waitForSelector('.strum-grid');
  const selected = await p.evaluate(() => { const s = document.querySelector('.strum-head select'); return s.options[s.selectedIndex].text; });
  ok('Letztes Muster bleibt gewählt', selected === 'Ab und auf', selected);

  // 4. Riff-Player
  await p.goto(`${BASE}#/riffs`);
  await p.waitForSelector('.score-list');
  await p.click('.score-list >> text=Chromatik-Spinne');
  await p.waitForSelector('.tab-host svg, .tab-host canvas, .tab-host .at-surface', { timeout: 10000 });
  await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  ok('Takte erkannt', (await p.textContent('.transport-bar span')).includes('3'));
  await p.click('[aria-label="Einen Takt vor"]');
  await p.waitForTimeout(200);
  ok('Takt vor', (await p.textContent('.transport-bar b')) === '2');
  await p.click('[aria-label="5 Prozent langsamer"]');
  await p.click('[aria-label="1 Prozent langsamer"]');
  ok('Tempo kleine Schritte', (await p.textContent('.speed-value b')).startsWith('94'));
  ok('Tempo wirkt im Player', Math.abs(await p.evaluate(() => window.__player.playbackSpeed) - 0.94) < 0.001);
  await p.click('.transport >> text=Mehr');
  const froms = p.locator('.player-more input[type=number]');
  await froms.nth(0).fill('2');
  await froms.nth(0).press('Tab');
  await froms.nth(1).fill('3');
  await froms.nth(1).press('Tab');
  await p.click('text=Bereich setzen');
  await p.click('.transport >> text=Loop');
  const range = await p.evaluate(() => ({ r: window.__player.playbackRange, loop: window.__player.isLooping, tick: window.__player.tickPosition }));
  ok('Bereich und Loop aktiv', range.r?.startTick === 3840 && range.r?.endTick === 11520 && range.loop, JSON.stringify(range));
  await p.locator('.player-more .toggle').first().click();
  const fr = await p.evaluate(() => window.__player.playbackSpeed);
  ok('Speed-Trainer setzt Starttempo', Math.abs(fr - 0.6) < 0.001, String(fr));
  await p.evaluate(() => { window.__player.playbackSpeed = 0.6; });
  await p.click('[aria-label="Abspielen"]');
  await p.waitForFunction(() => window.__player?.playerState === 1, null, { timeout: 6000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/run-riff.png` });
  await p.click('[aria-label="Anhalten"]');
  // Ansicht wechseln
  await p.click('.player-more >> text=Noten und Tabs');
  await p.waitForTimeout(800);
  await p.click('.player-more >> text=Tabs >> nth=0');
  await p.waitForTimeout(500);

  // 5. Importe
  await p.goto(`${BASE}#/songs`);
  await p.click('text=Song hinzufügen');
  await p.waitForSelector('.edit-grid');
  await p.click('text=Text-Tab einfügen');
  await p.fill('.tab-paste', 'Intro\ne|-----------------|-----------------|\nB|-----------------|-----------------|\nG|-----------------|-----------------|\nD|-----2---2---2---|-----2-----------|\nA|-0-3---3---3---3-|-0-3---5h7-------|\nE|-----------------|-----------------|\n');
  await p.click('dialog >> text=Übernehmen');
  await p.waitForSelector('.source-line');
  ok('Text-Tab übernommen', (await p.textContent('.source-line')).includes('Eigene Tabs'));

  await p.click('text=Screenshot per KI');
  await p.fill('.tab-paste', 'Quatsch');
  await p.click('dialog >> text=Übernehmen');
  await p.waitForSelector('dialog .notice');
  ok('Falsches KI-Ergebnis wird abgelehnt', true);
  await p.fill('.tab-paste', JSON.stringify({ title: 'Aus dem Screenshot', artist: 'KI', tempo: 110, ts: [4, 4], bars: [{ beats: [{ d: 4, notes: [{ s: 1, f: 3 }] }, { d: 4, notes: [{ s: 2, f: 1 }] }, { d: 2, notes: [{ s: 3, f: 0 }] }] }], uncertain: ['Takt 1'] }));
  await p.click('dialog >> text=Übernehmen');
  await p.waitForSelector('.tabed-grid');
  await p.waitForTimeout(800);
  ok('KI-Ergebnis öffnet Editor mit Titel', (await p.textContent('h1')) === 'Aus dem Screenshot', await p.textContent('h1'));

  // 6. Editor
  await p.locator('.tabed-cell').nth(5).click();
  await p.keyboard.type('12');
  await p.keyboard.press('Space');
  await p.keyboard.type('5');
  await p.keyboard.press('h');
  await p.waitForTimeout(900);
  const cells = await p.evaluate(() => [...document.querySelectorAll('.tabed-cell')].map((c) => c.textContent).filter(Boolean));
  ok('Editor nimmt Bünde an und zeigt das KI-Ergebnis', cells.includes('12') && cells.includes('5h') && cells.length === 5, cells.join(' '));
  await p.click('text=Achtel');
  await p.waitForTimeout(300);
  ok('Takt bleibt voll nach Notenwert-Wechsel', (await p.locator('.tabed-bar.bad').count()) === 0);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/editor.png`, fullPage: false });

  // 7. Guitar-Pro-Datei
  const gp = await p.evaluate(async () => {
    const t = window.alphaTab;
    const settings = new t.Settings();
    const score = t.importer.ScoreLoader.loadAlphaTex('\\title "GP Test"\n\\artist "Tester"\n\\tempo 100\n.\n:4 0.6 1.6 2.6 3.6 | 3.6 2.6 1.6 0.6', settings);
    const bytes = new t.exporter.Gp7Exporter().export(score, settings);
    return Array.from(bytes);
  });
  await p.goto(`${BASE}#/songs`);
  await p.click('text=Song hinzufügen');
  await p.waitForSelector('.edit-grid');
  await p.setInputFiles('input[type=file][accept*=".gp"]', { name: 'test.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(gp) });
  await p.waitForSelector('.source-line');
  ok('Guitar-Pro-Datei geladen', (await p.textContent('.source-line')).includes('Guitar Pro'));
  ok('Titel aus Datei', (await p.textContent('h1')) === 'GP Test', await p.textContent('h1'));
  await p.click('.page-head >> text=Üben');
  await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  ok('Guitar-Pro-Datei spielbar', (await p.textContent('.transport-bar span')).includes('2'));

  // 8. Mitschneiden und zusammen abspielen
  await p.click('.transport >> text=Mitschneiden');
  await p.click('[aria-label="Abspielen"]');
  await p.waitForFunction(() => window.__player?.playerState === 1, null, { timeout: 6000 });
  await p.waitForTimeout(1500);
  await p.click('[aria-label="Anhalten"]');
  await p.waitForSelector('.take', { timeout: 5000 });
  await p.click('.take >> text=Behalten');
  await p.waitForSelector('.linked-recs');
  ok('Aufnahme ist mit Song verknüpft', true);
  await p.click('.linked-recs >> text=Zusammen abspielen');
  await p.waitForFunction(() => window.__player?.playerState === 1, null, { timeout: 6000 });
  await p.waitForTimeout(500);
  await p.click('[aria-label="Anhalten"]');

  // 9. Aufnahmen und Fortschritt, auch nach Neuladen
  await p.goto(`${BASE}#/aufnahmen`);
  await p.reload();
  await p.waitForSelector('.rec-list');
  ok('Aufnahmen überleben Neuladen', (await p.locator('.rec-row').count()) === 2, String(await p.locator('.rec-row').count()));
  await p.locator('.rec-open').first().click();
  await p.waitForSelector('.rec-row .wave-canvas');
  await p.click('.rec-button');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/recording.png` });
  await p.click('.rec-button');
  await p.waitForFunction(() => document.querySelectorAll('.rec-row').length === 3, null, { timeout: 5000 });
  ok('Direkte Aufnahme dauerhaft gespeichert', true);
  await p.goto(`${BASE}#/fortschritt`);
  await p.waitForSelector('.stats');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/progress.png` });
  ok('Rekord im Fortschritt', (await p.textContent('.page')).includes('Am und C'));

  // 10. Sicherung
  await p.goto(`${BASE}#/einstellungen`);
  await p.waitForSelector('.settings');
  await p.locator('.toggle', { hasText: 'Aufnahmen einschließen' }).click();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Sicherung herunterladen')]);
  const path = `${OUT}/backup.json`;
  await dl.saveAs(path);
  const size = fs.statSync(path).size;
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  ok('Sicherung enthält Aufnahmen und GP-Datei', data.stores.recordings.length === 3 && Object.keys(data.blobs).length === 3 && JSON.stringify(data.stores.scores).includes('__bin'), `${(size / 1024).toFixed(0)} KB`);

  await p.evaluate(() => new Promise((res) => { const r = indexedDB.deleteDatabase('griffbrett'); r.onsuccess = res; r.onblocked = res; r.onerror = res; }));
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await p.close();
  await p2.goto(`${BASE}#/einstellungen`);
  await p2.waitForSelector('.settings');
  await p2.setInputFiles('input[type=file][accept*="json"]', path);
  await p2.waitForSelector('.toast.good', { timeout: 10000 });
  await p2.goto(`${BASE}#/aufnahmen`);
  await p2.reload();
  await p2.waitForSelector('.rec-list');
  ok('Sicherung wiederhergestellt', (await p2.locator('.rec-row').count()) === 3);
  await p2.goto(`${BASE}#/songs`);
  await p2.waitForSelector('.score-list');
  ok('Songs wiederhergestellt', (await p2.textContent('.score-list')).includes('GP Test'));

  console.log(errors.length ? `Fehler im Browser:\n${errors.join('\n')}` : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 600), global.__errors); process.exit(1); });
