const { chromium } = require('playwright');
const OUT = process.argv[2];
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${OUT}/e-in-tune.wav`] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'light', permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/');
  await p.waitForSelector('.step-list');

  // Plan anlegen, Schritte hinzufügen, verschieben, entfernen
  await p.click('.page-head >> text=Neuer Plan');
  await p.fill('dialog input', 'Mein Plan');
  await p.click('dialog >> text=Speichern');
  await p.waitForFunction(() => document.querySelector('h1').textContent === 'Mein Plan');
  await p.click('text=Schritt hinzufügen');
  await p.click('.type-tile >> text=Akkordwechsel');
  await p.fill('dialog input >> nth=0', 'E');
  await p.fill('dialog input >> nth=1', 'Am');
  await p.click('dialog .btn-primary');
  await p.waitForSelector('.step-list li');
  await p.click('text=Schritt hinzufügen');
  await p.click('.type-tile >> text=Song');
  await p.selectOption('dialog select', { label: 'Ode an die Freude' });
  await p.click('dialog .btn-primary');
  await p.waitForFunction(() => document.querySelectorAll('.step-list li').length === 2);
  await p.focus('.step-list li:nth-child(2) .drag-handle');
  await p.keyboard.press('ArrowUp');
  await p.waitForFunction(() => document.querySelector('.step-list li strong').textContent === 'Ode an die Freude');
  ok('Plan bauen und sortieren', true);
  await p.screenshot({ path: `${OUT}/d-plan-light.png` });
  await p.click('.step-list li:nth-child(1) [aria-label="Schritt entfernen"]');
  await p.waitForFunction(() => document.querySelectorAll('.step-list li').length === 1);
  await p.reload();
  await p.waitForSelector('.step-list');
  ok('Plan bleibt nach Neuladen gewählt', (await p.textContent('h1')) === 'Mein Plan');

  // Eigener Griff
  await p.evaluate(() => { location.hash = '#/akkorde'; });
  await p.click('text=Eigenen Griff anlegen');
  await p.fill('dialog input', 'Mein Em9');
  await p.locator('dialog .chord-hit').nth(4 * 1 + 1).click();
  await p.locator('dialog .chord-hit').nth(4 * 2 + 1).click();
  await p.screenshot({ path: `${OUT}/d-chord-editor.png` });
  await p.click('dialog >> text=Griff speichern');
  await p.waitForSelector('.plain-list');
  await p.click('.plain-list >> text=Mein Em9');
  await p.waitForSelector('.chord-title');
  ok('Eigener Griff lässt sich üben', (await p.textContent('.chord-title')) === 'Mein Em9');

  // Unbekannter Akkord
  await p.fill('.step-side .chord-input input', 'Xyz');
  await p.press('.step-side .chord-input input', 'Tab');
  await p.waitForTimeout(150);
  ok('Unbekannter Akkord zeigt Hinweis', (await p.textContent('.page')).includes('kenne ich nicht') || (await p.textContent('.page')).includes('keinen Griff'));

  // Strum mit Klang und Timer
  await p.evaluate(() => { location.hash = '#/strums'; });
  await p.waitForSelector('.strum-grid');
  await p.click('text=Neues Muster');
  await p.fill('dialog input', 'Test 16tel');
  await p.click('dialog >> text=Speichern');
  await p.waitForTimeout(200);
  await p.click('.strum-options >> text=16tel');
  await p.waitForFunction(() => document.querySelectorAll('.strum-cell').length === 16);
  ok('16tel-Raster', true);
  await p.locator('.strum-cell').first().click();
  await p.click('text=Muster mit Gitarrenklang vorspielen');
  await p.click('.metro-actions >> text=Start');
  await p.waitForTimeout(1500);
  await p.click('.metro-actions >> text=Stoppen');
  await p.screenshot({ path: `${OUT}/d-strum16.png` });
  ok('Vorspielen ohne Fehler', errors.length === 0, errors.join(' | '));

  // Alleinstehendes Metronom und Tastenkürzel
  await p.evaluate(() => { location.hash = '#/fortschritt'; });
  await p.waitForSelector('.stats');
  await p.keyboard.press('m');
  await p.waitForTimeout(600);
  const led = await p.locator('.pedal:nth-child(2) .led.on').count();
  ok('Taste M startet Metronom', led === 1);
  await p.keyboard.press('m');
  await p.keyboard.press('g');
  await p.waitForSelector('.tuner');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.tuner'));
  ok('Taste G und Esc für Panels', true);

  // Fehlerhafte Datei
  await p.evaluate(() => { location.hash = '#/songs'; });
  await p.click('text=Song hinzufügen');
  await p.waitForSelector('.edit-grid');
  await p.setInputFiles('input[type=file][accept*=".gp"]', { name: 'kaputt.gp', mimeType: 'application/octet-stream', buffer: Buffer.from('das ist keine tab datei') });
  await p.waitForSelector('.toast.warn', { timeout: 8000 });
  ok('Kaputte Datei wird sauber abgelehnt', (await p.textContent('.toast.warn')).includes('lässt sich nicht lesen'));

  // Link, YouTube, Bild
  await p.fill('input[type=url]', 'https://www.ultimate-guitar.com/tab/irgendwas');
  await p.click('text=Link hinzufügen');
  await p.fill('input[type=url]', 'https://youtu.be/dQw4w9WgXcQ');
  await p.click('text=Link hinzufügen');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('input[type=file][accept*="image"]', { name: 'tab.png', mimeType: 'image/png', buffer: png });
  await p.waitForFunction(() => document.querySelectorAll('.plain-list li').length === 3);
  ok('Links und Bilder hinzugefügt', true);
  await p.click('.page-head >> text=Üben');
  await p.waitForSelector('.attachments');
  await p.waitForSelector('.score-image');
  ok('Bild und Link beim Üben sichtbar', (await p.locator('.link-row').count()) === 1);
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/d-attachments.png` });
  console.log(errors.length ? errors : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
