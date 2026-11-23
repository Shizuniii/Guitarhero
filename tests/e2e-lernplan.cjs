// Lernplan im Browser: Heute, Einheit durchlaufen, Lektion abhaken, Prüfpunkt, eigene Pläne bleiben gleich.
// Braucht den lokalen Server auf Port 8123 (siehe README).
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

const CHORDS = ['D', 'Dm', 'A', 'Am', 'E', 'Em', 'C'];
const chord = (name) => ({ name, voicing: 0 });
function myPlan(patternIds, riffIds) {
  const steps = [{ id: 'fs', type: 'timer', config: { seconds: 120, label: 'Finger Stretch' } }];
  for (const c of CHORDS) steps.push({ id: `c-${c}`, type: 'chord', config: { seconds: 60, chord: chord(c) } });
  for (let i = 0; i < CHORDS.length; i++) {
    for (let j = i + 1; j < CHORDS.length; j++) steps.push({ id: `w-${i}-${j}`, type: 'change', config: { seconds: 60, a: chord(CHORDS[i]), b: chord(CHORDS[j]) } });
  }
  patternIds.forEach((id) => steps.push({ id: `s-${id}`, type: 'strum', config: { seconds: 60, patternId: id, bpm: 80 } }));
  riffIds.forEach((id) => steps.push({ id: `r-${id}`, type: 'riff', config: { scoreId: id } }));
  return { id: 'mein-plan', name: 'Übungsplan', steps, createdAt: 1 };
}

const readStore = (p, name) => p.evaluate((n) => new Promise((res) => {
  const r = indexedDB.open('griffbrett');
  r.onsuccess = () => { const q = r.result.transaction(n).objectStore(n).getAll(); q.onsuccess = () => { r.result.close(); res(q.result); }; };
}), name);
const readSettings = (p) => p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('griffbrett');
  r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('settings'); q.onsuccess = () => { r.result.close(); res(q.result); }; };
}));

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  await p.goto(BASE);
  await p.waitForSelector('.step-list');
  // Eigener Plan mit den Mustern und Riffs aus den Beispielen
  const patterns = await readStore(p, 'patterns');
  const scores = await readStore(p, 'scores');
  const riffs = scores.filter((s) => s.kind === 'riff').map((s) => s.id);
  const plan = myPlan(patterns.slice(0, 3).map((x) => x.id), riffs);
  await p.evaluate((pl) => new Promise((res) => {
    const r = indexedDB.open('griffbrett');
    r.onsuccess = () => {
      const tx = r.result.transaction(['plans', 'kv'], 'readwrite');
      const os = tx.objectStore('plans');
      os.clear();
      os.put(pl);
      const kv = tx.objectStore('kv');
      const g = kv.get('settings');
      g.onsuccess = () => kv.put({ ...g.result, lastPlanId: pl.id }, 'settings');
      tx.oncomplete = () => { r.result.close(); res(); };
    };
  }), plan);
  const plansBefore = JSON.stringify(await readStore(p, 'plans'));

  // 1. Menü und Heute
  await p.goto(`${BASE}#/lernplan`);
  await p.reload();
  await p.waitForSelector('.lp-page');
  ok('Menüpunkt Lernplan', (await p.locator('nav.rail a[aria-current="page"]').textContent()).includes('Lernplan'));
  const items = await p.locator('.lp-seglist li').count();
  ok('Ablauf für heute', items >= 10, `(${items} Schritte)`);
  ok('Erster Schritt Finger Stretch', (await p.locator('.lp-seglist li').first().textContent()).includes('Finger Stretch'));
  ok('Gesamtzeit um 20 Minuten', /^(19|20) Min\.$/.test((await p.textContent('.lp-big')).trim()), await p.textContent('.lp-big'));
  ok('Nächste Lektion: Guitar Strumming Tips', (await p.textContent('.lp-lesson h3')).includes('Guitar Strumming Tips'));

  // 1b. Noch kein Song: Karte statt Song-Arbeit, Song eintragen
  ok('Karte „Noch kein Song“', (await p.locator('.lp-songcard').count()) === 1);
  ok('Ohne Song keine Song-Arbeit im Ablauf', !(await p.textContent('.lp-seglist')).includes('Song'));
  await p.fill('.lp-songcard input', 'Eleanor Rigby');
  await p.click('.lp-songcard button[type=submit]');
  await p.waitForTimeout(250);
  ok('Song steht im Ablauf', (await p.textContent('.lp-seglist')).includes('Song: Eleanor Rigby'));
  ok('Karte verschwindet', (await p.locator('.lp-songcard').count()) === 0);
  ok('Song gespeichert', JSON.stringify((await readSettings(p)).lernplan.songList) === '["Eleanor Rigby"]');
  ok('Mit Song um 20 Minuten', /^(19|20) Min\.$/.test((await p.textContent('.lp-big')).trim()), await p.textContent('.lp-big'));

  // 2. Kurz-Einheit
  await p.click('.lp-today .segmented >> text=Kurz');
  await p.waitForTimeout(200);
  ok('Kurz: 5 Minuten', (await p.textContent('.lp-big')).trim() === '5 Min.', await p.textContent('.lp-big'));
  const kurzItems = await p.locator('.lp-seglist li').count();

  // 3. Einheit durchlaufen bis zum Ende
  await p.click('text=Einheit starten');
  await p.waitForSelector('.run-head');
  ok('Lauf startet bei Schritt 1', (await p.textContent('.run-index')).startsWith(`Schritt 1 von ${kurzItems}`), await p.textContent('.run-index'));
  ok('Hinweis über dem Schritt', (await p.locator('.step-hint').count()) === 1);
  for (let i = 0; i < kurzItems; i++) {
    await p.click('.step-nav .btn-primary');
    await p.waitForTimeout(150);
  }
  await p.waitForSelector('text=Einheit geschafft');
  ok('Fertig-Seite', true);
  await p.waitForTimeout(300);
  let s = await readSettings(p);
  const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  ok('Heute als erledigt eingetragen', s.lernplan.days.includes(today));
  await p.click('text=Zum Lernplan');
  await p.waitForSelector('.lp-today');
  ok('Heute zeigt erledigt', (await p.textContent('.lp-today')).includes('Heute erledigt'));
  ok('Einheit bleibt am selben Tag gleich', (await p.textContent('.lp-today h2')).trim() === 'Einheit 1');

  // 4. Lektion abhaken
  await p.click('.lp-lesson >> text=Gesehen');
  await p.waitForTimeout(200);
  ok('Nächste Lektion rückt weiter', (await p.textContent('.lp-lesson h3')).includes('Exploring Strumming'));
  await p.click('.lp-tabs >> text=Kurs');
  await p.waitForSelector('.lp-lessons');
  ok('Kurs zeigt 5.2 als gesehen', await p.locator('.lp-lessons li').nth(1).locator('input').isChecked());
  ok('Links zu JustinGuitar', (await p.locator('.lp-lessons a[href^="https://www.justinguitar.com/guitar-lessons/"]').count()) === 29);

  // 5. Prüfpunkt abhaken
  await p.click('.lp-tabs >> text=Plan');
  await p.waitForSelector('.lp-stage.cur');
  const box = p.locator('.lp-stage.cur .lp-checks li').nth(1).locator('input');
  await box.check();
  await p.waitForTimeout(200);
  ok('Prüfpunkt gespeichert', (await readSettings(p)).lernplan.checks['m5-chords'] === true);
  ok('Prüfpunkte zählen mit', (await p.textContent('.lp-stage.cur summary')).includes('Prüfpunkte 1/5'));
  ok('Abdeckung ohne Lücken', (await p.locator('.lp-cov li.zero').count()) === 0);
  ok('Songs-Liste im Plan', (await p.textContent('.lp-songs')).includes('Eleanor Rigby'));
  await p.click('.lp-songs button');
  await p.waitForTimeout(250);
  ok('Song entfernt', (await p.locator('.lp-songs').count()) === 0 && (await readSettings(p)).lernplan.songList.length === 0);

  // 6. Eigene Pläne unverändert, Üben-Seite wie vorher
  ok('Eigene Pläne unverändert', JSON.stringify(await readStore(p, 'plans')) === plansBefore);
  await p.goto(`${BASE}#/`);
  await p.waitForSelector('.step-list');
  ok('Üben zeigt deinen Plan', (await p.textContent('.page-head h1')).trim() === 'Übungsplan');
  s = await readSettings(p);
  ok('Letzter Plan bleibt deiner', s.lastPlanId === 'mein-plan');

  ok('Keine Fehler im Browser', errors.length === 0, errors.join(' | '));
  await b.close();
})();
