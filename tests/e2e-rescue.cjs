// Absicherungen beim Start: Fehlerbox statt leerer App, Rettung bei einem Hänger, Sicherung direkt aus IndexedDB.
// Braucht den lokalen Server auf Port 8123 (siehe README). Dauert etwa eine Minute, weil die Rettung erst
// nach 12 Sekunden ohne Anzeige erscheint.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };

const putPlan = (p, plan, settingsPatch) => p.evaluate(([plan, patch]) => new Promise((res) => {
  const r = indexedDB.open('griffbrett');
  r.onsuccess = () => {
    const tx = r.result.transaction(['plans', 'kv'], 'readwrite');
    tx.objectStore('plans').put(plan);
    const kv = tx.objectStore('kv');
    const g = kv.get('settings');
    g.onsuccess = () => kv.put({ ...g.result, ...patch }, 'settings');
    tx.oncomplete = () => { r.result.close(); res(); };
  };
}), [plan, settingsPatch]);

async function download(p) {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.click('#rescue-save')]);
  if (!dl) return null;
  return { name: dl.suggestedFilename(), json: JSON.parse(fs.readFileSync(await dl.path(), 'utf8')) };
}

(async () => {
  const b = await chromium.launch();

  // 1. Normaler Start: keine Rettung, keine Fehlerbox
  let ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, acceptDownloads: true });
  let p = await ctx.newPage();
  await p.goto(BASE);
  await p.waitForSelector('.step-list');
  ok('Normaler Start ohne Rettung', await p.locator('#rescue').count() === 0);
  ok('Normaler Start ohne Fehlerbox', await p.locator('.crash').count() === 0);

  // 2. Kaputter Plan (Schritt ohne Einstellungen): Fehlerbox auf der Seite, Menü bleibt
  await putPlan(p, { id: 'kaputt', name: 'Kaputt', steps: [{ id: 's1', type: 'change', config: null }], createdAt: 1 }, { lastPlanId: 'kaputt' });
  await p.reload();
  await p.waitForSelector('.crash', { timeout: 8000 }).catch(() => {});
  ok('Fehlerbox statt leerer Seite', await p.locator('.crash').count() === 1);
  ok('Menü bleibt sichtbar', await p.locator('nav.rail').count() === 1);
  ok('Fehlerbox nennt den Fehler', /\(Seite Üben\): TypeError/.test(await p.textContent('.crash')));
  await p.click('.crash >> text=Zu den Einstellungen');
  await p.waitForSelector('h3:has-text("Sicherung")', { timeout: 5000 }).catch(() => {});
  ok('Einstellungen erreichbar', await p.locator('h3:has-text("Sicherung")').count() === 1);
  ok('Fehlerbox weg', await p.locator('.crash').count() === 0);
  await ctx.close();

  // 3. Start hängt beim Laden der Pläne: Rettung zeigt den Schritt, Sicherung holt die Daten trotzdem
  ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, acceptDownloads: true });
  p = await ctx.newPage();
  await p.goto(BASE);
  await p.waitForSelector('.step-list');
  await p.close();
  p = await ctx.newPage();
  await p.addInitScript(() => {
    const real = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (names, mode) {
      if (names === 'plans' && !window.__erlaubt) return { objectStore: () => ({ getAll: () => ({}) }) };
      return real.call(this, names, mode);
    };
  });
  await p.goto(BASE);
  await p.waitForSelector('#rescue', { timeout: 20000 }).catch(() => {});
  ok('Rettung erscheint bei Hänger', await p.locator('#rescue').count() === 1);
  const msg = await p.textContent('#rescue-msg').catch(() => '');
  ok('Rettung nennt den Schritt', msg.includes('Daten laden (plans)') && msg.includes('Datenbank offen'), `(${msg})`);
  await p.evaluate(() => { window.__erlaubt = true; });
  const saved = await download(p);
  ok('Sicherung heruntergeladen', !!saved && /^guitarhero-sicherung-\d{4}-\d\d-\d\d\.json$/.test(saved.name));
  ok('Sicherung im Format von Einstellungen', saved?.json.app === 'guitarhero' && saved.json.version === 1 && !!saved.json.settings);
  ok('Sicherung enthält die Pläne', (saved?.json.stores.plans || []).length >= 1, `(${(saved?.json.stores.plans || []).length})`);
  ok('Rettung meldet Erfolg', /Gesichert: \d+ Einträge/.test(await p.textContent('#rescue-state')));
  await ctx.close();

  // 4. Datenbank öffnet gar nicht: Rettung sagt das, Sichern meldet sich nach 15 Sekunden statt ewig zu warten
  ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, acceptDownloads: true });
  p = await ctx.newPage();
  await p.addInitScript(() => {
    indexedDB.open = () => ({});
  });
  await p.goto(BASE);
  await p.waitForSelector('#rescue', { timeout: 20000 }).catch(() => {});
  const msg2 = await p.textContent('#rescue-msg').catch(() => '');
  ok('Rettung: Datenbank öffnet nicht', msg2.includes('Daten laden (Einstellungen)') && msg2.includes('Datenbank öffnet nicht'), `(${msg2})`);
  await p.click('#rescue-save');
  await p.waitForFunction(() => /antwortet seit 15 Sekunden nicht/.test(document.getElementById('rescue-state').textContent), null, { timeout: 20000 }).catch(() => {});
  ok('Sichern meldet den hängenden Speicher', /antwortet seit 15 Sekunden nicht/.test(await p.textContent('#rescue-state')));
  await ctx.close();

  await b.close();
})();
