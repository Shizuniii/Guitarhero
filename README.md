# Guitarhero

Gitarren-Übungsprogramm als installierbare Web-App. Läuft ohne Build-Schritt auf GitHub Pages.

## Bereitstellen

In den Repository-Einstellungen unter Pages: Deploy from a branch, Branch `main`, Ordner `/ (root)`.

## Ändern

- `src/` Programmcode, `css/` Gestaltung, `data/chords.json` Griffe, `vendor/` Bibliotheken
- Nach jeder Änderung `node tools/build-sw.mjs` ausführen. Das aktualisiert die Offline-Dateiliste in `sw.js`.
- `helper/tab-leser.html` ist die KI-Helfer-Seite in Claude und wird dort veröffentlicht.

## Bewertung

Die Auswertung läuft im Browser (`src/lib/dsp.js`, `src/lib/analysis.js`, im Hintergrund über `analysis-worker.js`).
Sie ist auf eine Konzertgitarre mit Nylonsaiten eingestellt und mit künstlichem Gitarrenklang getestet.
Der Plan „Testaufnahmen“ in der App sammelt echte Aufnahmen mit absichtlichen Fehlern für die Feinabstimmung.

## Tests

Statischen Server auf Port 8123 starten (`python3 -m http.server 8123 --bind 127.0.0.1`), dann:

- `node tests/tabformat.test.mjs`
- `node tests/analysis.test.mjs` (Erkennung mit künstlicher Gitarre)
- `node tests/make-wavs.mjs <ordner>` und `node tests/e2e-analysis.cjs <ordner>`
- `node tests/e2e-flow.cjs <ordner-mit-testaudio>`
- `node tests/e2e-tuner.cjs <ordner-mit-testaudio>`

## Lizenzen

alphaTab: MPL-2.0. Sonivox-Soundfont und Bravura: siehe Dateien in `vendor/alphatab`. chords-db: MIT. Preact und htm: MIT/Apache-2.0. Schriften Big Shoulders und Atkinson Hyperlegible Next: OFL.
