const { chromium } = require('playwright');
const OUT = process.argv[2];
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${OUT}/e-in-tune.wav`] });
  // Offline über Service Worker (nur auf localhost oder https aktiv)
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.waitForSelector('.step-list');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  await p.reload();
  await p.waitForSelector('.step-list');
  const cached = await p.evaluate(async () => (await caches.keys()).length);
  ok('Offline-Speicher angelegt', cached === 1);
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('.step-list', { timeout: 8000 });
  ok('App startet ohne Internet', true);
  await p.click('.step-list li:nth-child(5) .step-title');
  await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
  ok('Song spielt ohne Internet', true);
  await ctx.setOffline(false);

  // Aufnahme-Ordner mit Ersatz-Ordner aus dem Browser
  await p.addInitScript(() => { window.showDirectoryPicker = () => navigator.storage.getDirectory(); });
  await p.goto('http://localhost:8123/#/einstellungen');
  await p.reload();
  await p.waitForSelector('.settings');
  await p.click('text=Ordner wählen');
  await p.waitForSelector('.toast.good');
  await p.evaluate(() => { location.hash = '#/aufnahmen'; });
  await p.waitForSelector('.rec-button');
  await p.click('.rec-button');
  await p.waitForTimeout(1300);
  await p.click('.rec-button');
  await p.waitForSelector('.rec-row');
  await p.waitForTimeout(600);
  const listFiles = () => p.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const out = [];
    for await (const e of root.values()) out.push(e.name);
    return out;
  });
  const files = await listFiles();
  ok('Aufnahme landet als Datei im Ordner', files.some((f) => f.endsWith('.webm')), files.join(', '));
  await p.click('[aria-label="Löschen"]');
  await p.click('dialog .btn-danger');
  await p.waitForTimeout(600);
  ok('Löschen entfernt auch die Datei', !(await listFiles()).some((f) => f.endsWith('.webm')));

  // Verbindung trennen, damit der Ersatz-Ordner nicht in den nächsten Start wandert
  await p.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('griffbrett');
    r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').delete('folderHandle'); tx.oncomplete = res; };
  }));

  // Deutsche Notennamen
  await p.evaluate(() => { location.hash = '#/einstellungen'; });
  await p.waitForSelector('.settings');
  await p.click('text=H und B wie in der Schule');
  await p.evaluate(() => { location.hash = '#/akkorde'; });
  await p.waitForSelector('.chord-tiles');
  ok('Bm heißt nun Hm', (await p.textContent('.chord-tiles')).includes('Hm'));
  await p.fill('input[type=search]', 'B');
  await p.waitForTimeout(200);
  const first = await p.textContent('.chord-tile b');
  await p.click('.chord-tile');
  await p.waitForSelector('.chord-title');
  ok('Akkord B in deutscher Schreibweise öffnet B-Dur (international Bb)', (await p.textContent('.chord-title')) === first, `${first}`);
  const frets = await p.getAttribute('.chord', 'aria-label');
  ok('Griff gehört zu Bb', frets.includes('x 1 3 3 3 1') || frets.includes('1 1 3 3 3 1'), frets);

  // Wechsel aus der Akkord-Seite
  await p.goto('http://localhost:8123/#/einstellungen');
  await p.waitForSelector('.settings');
  await p.click('text=B wie in Tabs aus dem Netz');
  await p.evaluate(() => { location.hash = '#/akkorde'; });
  await p.waitForSelector('.change-launch');
  await p.fill('.change-launch input >> nth=0', 'G');
  await p.fill('.change-launch input >> nth=1', 'D7');
  await p.click('.change-launch .btn-primary');
  await p.waitForSelector('.change-pair');
  await p.waitForTimeout(300);
  const names = await p.locator('.chord-title').allTextContents();
  ok('Wechsel übernimmt die Akkorde', names.join(',') === 'G,D7', names.join(','));

  // Panel-Timer ist derselbe wie der im Schritt
  await p.click('.pedal:nth-child(1)');
  await p.click('.drawer .timer-actions .btn-primary');
  await p.waitForTimeout(400);
  ok('Panel und Schritt zeigen denselben Timer', (await p.locator('.timer-count b').count()) === 2);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  await p.click('.timer-actions >> text=Zurücksetzen');
  console.log(errors.length ? errors : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
