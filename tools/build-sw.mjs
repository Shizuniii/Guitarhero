// Erzeugt sw.js mit einer Dateiliste und einem Inhalts-Hash als Version.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const include = ['index.html', 'manifest.webmanifest', 'css', 'data', 'fonts', 'icons', 'src', 'vendor'];
const files = [];

function walk(p) {
  if (statSync(p).isDirectory()) readdirSync(p).forEach((f) => walk(join(p, f)));
  else if (!/\.(txt|md|otf|svg\.map)$|LICENSE/.test(p)) files.push(p);
}
include.forEach((f) => walk(join(root, f)));

const hash = createHash('sha256');
files.sort().forEach((f) => hash.update(readFileSync(f)));
const list = ['./', ...files.map((f) => relative(root, f).split('\\').join('/'))];
const version = `guitarhero-${hash.digest('hex').slice(0, 10)}`;
const out = readFileSync(join(root, 'sw.template.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__FILES__', JSON.stringify(list, null, 2));
writeFileSync(join(root, 'sw.js'), out);
console.log(version, list.length, 'Dateien');
