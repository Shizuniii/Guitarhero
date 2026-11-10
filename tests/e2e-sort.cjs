// node tests/e2e-sort.cjs: Schritte im Plan per Ziehen (Maus und Finger) und per Pfeiltasten sortieren.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };
const titles = (p) => p.$$eval('.step-list li .step-title strong', (els) => els.map((e) => e.textContent));
const center = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const handle = (i) => `.step-list li:nth-child(${i}) .drag-handle`;
const row = (i) => `.step-list li:nth-child(${i})`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}#/`);
  await p.waitForSelector('.step-list li');
  const before = await titles(p);

  // Maus: Schritt 1 unter Schritt 3 ziehen
  const h = await center(p, handle(1));
  const target = await p.locator(row(3)).boundingBox();
  await p.mouse.move(h.x, h.y);
  await p.mouse.down();
  for (let k = 1; k <= 12; k += 1) await p.mouse.move(h.x, h.y + ((target.y + target.height * 0.75 - h.y) * k) / 12);
  await p.waitForTimeout(100);
  const during = await p.$$eval('.step-list li .step-index', (els) => els.map((e) => e.textContent));
  ok('Beim Ziehen zeigen die Nummern die neue Reihenfolge', JSON.stringify(during) === JSON.stringify(['3', '1', '2', '4', '5']), during.join(','));
  await p.mouse.up();
  await p.waitForTimeout(200);
  const afterMouse = await titles(p);
  ok('Maus: Schritt 1 landet an Stelle 3', JSON.stringify(afterMouse) === JSON.stringify([before[1], before[2], before[0], before[3], before[4]]), afterMouse.join(' | '));

  // Escape bricht ab
  const h2 = await center(p, handle(1));
  await p.mouse.move(h2.x, h2.y);
  await p.mouse.down();
  for (let k = 1; k <= 8; k += 1) await p.mouse.move(h2.x, h2.y + 25 * k);
  await p.keyboard.press('Escape');
  await p.mouse.up();
  await p.waitForTimeout(200);
  ok('Escape bricht das Ziehen ab', JSON.stringify(await titles(p)) === JSON.stringify(afterMouse));

  // Tastatur: Griff von Schritt 3 fokussieren, zweimal nach oben
  await p.focus(handle(3));
  await p.keyboard.press('ArrowUp');
  await p.waitForTimeout(150);
  await p.keyboard.press('ArrowUp');
  await p.waitForTimeout(150);
  const afterKeys = await titles(p);
  ok('Pfeiltasten verschieben und der Fokus bleibt am Schritt', afterKeys[0] === afterMouse[2] && afterKeys[1] === afterMouse[0], afterKeys.join(' | '));

  // Gespeichert: nach Neuladen gleiche Reihenfolge
  await p.reload();
  await p.waitForSelector('.step-list li');
  ok('Reihenfolge bleibt nach dem Neuladen', JSON.stringify(await titles(p)) === JSON.stringify(afterKeys));

  // Finger am Handy: Schritt 5 nach oben an Stelle 2
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const m = await ctx.newPage();
  m.on('pageerror', (e) => errors.push(e.message));
  await m.goto(`${BASE}#/`);
  await m.waitForSelector('.step-list li');
  await m.locator(row(5)).scrollIntoViewIfNeeded();
  const startOrder = await titles(m);
  const cdp = await ctx.newCDPSession(m);
  const t0 = await center(m, handle(5));
  const goal = await m.locator(row(2)).boundingBox();
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: t0.x, y }] });
  await touch('touchStart', t0.y);
  const endY = goal.y + goal.height * 0.3;
  for (let k = 1; k <= 14; k += 1) { await touch('touchMove', t0.y + ((endY - t0.y) * k) / 14); await m.waitForTimeout(16); }
  await m.waitForTimeout(80);
  await touch('touchEnd', endY);
  await m.waitForTimeout(250);
  const afterTouch = await titles(m);
  ok('Finger: Schritt 5 landet an Stelle 2', afterTouch[1] === startOrder[4] && afterTouch.length === 5, afterTouch.join(' | '));
  await m.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});

  console.log(errors.length ? `Browser-Fehler: ${errors.join(' | ')}` : 'keine Browser-Fehler');
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e.message.slice(0, 500)); process.exit(1); });
