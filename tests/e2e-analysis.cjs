const { chromium } = require('playwright');
const OUT = process.argv[2];
const BASE = 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

async function withMic(file, fn) {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${OUT}/${file}`] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark', permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await p.goto(BASE);
  await p.waitForSelector('.step-list');
  // Kurzer Countdown für die Tests
  await p.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('griffbrett');
    r.onsuccess = () => {
      const tx = r.result.transaction('kv', 'readwrite');
      const os = tx.objectStore('kv');
      const g = os.get('settings');
      g.onsuccess = () => { os.put({ ...g.result, countdownSeconds: 1, tailSeconds: 1 }, 'settings'); };
      tx.oncomplete = res;
    };
  }));
  await p.reload();
  await p.waitForSelector('.step-list');
  try { await fn(p); } finally {
    console.log(`  ${file}:`, errors.length ? errors.join(' | ') : 'keine Browser-Fehler');
    await b.close();
  }
}

async function setDuration(p, sec) {
  await p.click('.step-side .timer-digits');
  await p.fill('input[aria-label="Sekunden"]', String(sec));
  await p.press('input[aria-label="Sekunden"]', 'Tab');
}

(async () => {
  await withMic('c-no-a.wav', async (p) => {
    await p.evaluate(() => { location.hash = '#/frei/chord?chord=C'; });
    await p.waitForSelector('.chord-title');
    await setDuration(p, 8);
    await p.click('.timer-actions .btn-primary');
    await p.waitForSelector('.verdict-sum', { timeout: 30000 });
    const text = await p.textContent('.verdict');
    ok('Akkord: Bewertung erscheint', /Anschlägen klangen sauber/.test(text), text.slice(0, 90));
    ok('Akkord: A-Saite fehlt gemeldet', text.includes('A-Saite klingt nicht mit'), '');
    ok('Akkord: Zeitstrahl hat Abschnitte', (await p.locator('.verdict-seg').count()) >= 5);
    await p.locator('.take').first().screenshot({ path: `${OUT}/a-chord.png` });
    await p.locator('.verdict-seg').first().click();
    await p.waitForTimeout(300);
    ok('Akkord: Klick spielt Stelle ab', (await p.locator('.take [aria-label="Anhalten"]').count()) === 1);
    await p.click('.take >> text=Behalten');
    await p.waitForSelector('.kept');
    await p.evaluate(() => { location.hash = '#/aufnahmen'; });
    await p.waitForSelector('.rec-open');
    await p.click('.rec-open');
    await p.waitForSelector('.rec-row .verdict-sum');
    ok('Behaltene Aufnahme zeigt Bewertung', true);
  });

  await withMic('am-c.wav', async (p) => {
    await p.evaluate(() => { location.hash = '#/frei/change?a=Am&b=C'; });
    await p.waitForSelector('.change-pair');
    await setDuration(p, 14);
    await p.click('.timer-actions .btn-primary');
    await p.waitForTimeout(9000);
    const liveN = Number(await p.textContent('.counter-now b'));
    ok('Wechsel: zählt live mit', liveN >= 4, `live=${liveN}`);
    await p.waitForSelector('.counter >> text=Eintragen', { timeout: 30000 });
    const entry = await p.textContent('.counter .stack p');
    const n = Number(entry.match(/(\d+)/)[1]);
    ok('Wechsel: Auswertung zählt ~9', n >= 8 && n <= 11, entry);
    await p.locator('.step-change').screenshot({ path: `${OUT}/a-change.png` });
  });

  await withMic('c-strings.wav', async (p) => {
    await p.evaluate(() => { location.hash = '#/frei/chord?chord=C'; });
    await p.waitForSelector('.string-check');
    await p.click('text=Saiten einzeln prüfen');
    await p.waitForFunction(() => document.querySelectorAll('.sc-row .sc-result').length && [...document.querySelectorAll('.sc-result')].filter((e) => e.textContent.trim()).length >= 5 && !document.querySelector('.sc-row.now'), null, { timeout: 25000 }).catch(() => {});
    const rows = await p.$$eval('.sc-row', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    console.log('   ', rows.join(' | '));
    ok('Saiten-Check: D-Saite einen Bund zu hoch', rows.some((r) => r.startsWith('D') && r.includes('einen Bund zu hoch')));
    ok('Saiten-Check: A-Saite sauber', rows.some((r) => r.startsWith('A') && r.includes('klingt sauber')));
    await p.locator('.string-check').screenshot({ path: `${OUT}/a-strings.png` });
  });

  await withMic('am-c.wav', async (p) => {
    await p.evaluate(() => { location.hash = '#/strums'; });
    await p.waitForSelector('.strum-grid');
    await p.click('.step-main .timer-digits');
    await p.fill('input[aria-label="Sekunden"]', '6');
    await p.press('input[aria-label="Sekunden"]', 'Tab');
    await p.click('.timer-actions .btn-primary');
    await p.waitForSelector('.verdict-sum', { timeout: 30000 });
    ok('Strum: Bewertung erscheint', /im Takt/.test(await p.textContent('.verdict-sum')), await p.textContent('.verdict-sum'));
    await p.locator('.take').first().screenshot({ path: `${OUT}/a-strum.png` });

    await p.evaluate(() => { location.hash = '#/riffs'; });
    await p.click('.score-list >> text=Am-Pentatonik');
    await p.waitForFunction(() => window.__player?.isReadyForPlayback, null, { timeout: 15000 });
    await p.click('.transport >> text=Mitschneiden');
    await p.click('[aria-label="Abspielen"]');
    await p.waitForTimeout(4500);
    await p.click('[aria-label="Anhalten"]');
    await p.waitForSelector('.take .verdict-sum, .take .verdict-note', { timeout: 30000 });
    await p.waitForFunction(() => !document.querySelector('.take .verdict-note'), null, { timeout: 30000 }).catch(() => {});
    const v = await p.textContent('.take .wave-body');
    ok('Riff: Bewertung erscheint', /Tönen richtig|Keine Anschläge/.test(v), v.slice(0, 120));
    await p.locator('.take').first().screenshot({ path: `${OUT}/a-riff.png` });

    await p.evaluate(() => { location.hash = '#/einstellungen'; });
    await p.click('text=Abgleich starten');
    await p.waitForSelector('.cal-count');
    await p.waitForFunction(() => /Fertig|Nur|unterschiedlich/.test(document.querySelector('.settings').textContent), null, { timeout: 20000 });
    ok('Abgleich läuft durch', true, (await p.textContent('.settings section:nth-of-type(2)')).match(/(Fertig[^.]*|Nur[^.]*|Die Anschläge[^.]*)/)?.[0] || '');
  });
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 600)); process.exit(1); });
