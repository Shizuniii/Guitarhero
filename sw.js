// Macht Guitarhero offline nutzbar. Wird von tools/build-sw.mjs erzeugt.
const VERSION = 'guitarhero-1eaee7cc5b';
const FILES = [
  "./",
  "css/app.css",
  "css/fonts.css",
  "data/chords.json",
  "fonts/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2",
  "fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2",
  "fonts/big-shoulders-display-latin-ext-wght-normal.woff2",
  "fonts/big-shoulders-display-latin-wght-normal.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon.svg",
  "index.html",
  "manifest.webmanifest",
  "src/config.js",
  "src/lib/analysis-worker.js",
  "src/lib/analysis.js",
  "src/lib/analyze.js",
  "src/lib/audio.js",
  "src/lib/backup.js",
  "src/lib/chords.js",
  "src/lib/core.js",
  "src/lib/db.js",
  "src/lib/dsp.js",
  "src/lib/feedback.js",
  "src/lib/folder.js",
  "src/lib/metronome.js",
  "src/lib/mic.js",
  "src/lib/pitch.js",
  "src/lib/recorder.js",
  "src/lib/router.js",
  "src/lib/seed.js",
  "src/lib/state.js",
  "src/lib/synth.js",
  "src/lib/tabformat.js",
  "src/lib/take-control.js",
  "src/lib/tap-worklet.js",
  "src/lib/timer.js",
  "src/lib/ui-state.js",
  "src/main.js",
  "src/pages/chords.js",
  "src/pages/practice.js",
  "src/pages/progress.js",
  "src/pages/recordings.js",
  "src/pages/scores.js",
  "src/pages/settings.js",
  "src/pages/strums.js",
  "src/steps/change.js",
  "src/steps/chord.js",
  "src/steps/common.js",
  "src/steps/metronome.js",
  "src/steps/record.js",
  "src/steps/score.js",
  "src/steps/strum.js",
  "src/steps/timer.js",
  "src/ui/chord.js",
  "src/ui/common.js",
  "src/ui/fretboard.js",
  "src/ui/icons.js",
  "src/ui/metronome-face.js",
  "src/ui/score-player.js",
  "src/ui/shell.js",
  "src/ui/string-check.js",
  "src/ui/tab-editor.js",
  "src/ui/timer-face.js",
  "src/ui/tuner.js",
  "src/ui/wave.js",
  "src/ui/youtube.js",
  "vendor/alphatab/alphaTab.min.js",
  "vendor/alphatab/font/Bravura.woff",
  "vendor/alphatab/font/Bravura.woff2",
  "vendor/alphatab/soundfont/guitarhero.sf2",
  "vendor/htm-preact.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(request);
    } catch (err) {
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw err;
    }
  })());
});
