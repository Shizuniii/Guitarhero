// Sicherung: alles in eine Datei und wieder zurück.
import { base64ToBytes, bytesToBase64, downloadBlob } from './core.js';
import { dbAll, dbGet, dbKeys, dbPut, STORES } from './db.js';
import { bootState } from './state.js';

const TEXT_STORES = STORES.filter((s) => s !== 'blobs' && s !== 'kv');

function encodeValue(value) {
  if (value instanceof ArrayBuffer) {
    return { __bin: bytesToBase64(new Uint8Array(value)) };
  }
  if (value instanceof Blob) throw new Error('blob-in-value');
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeValue(v)]));
  }
  return value;
}

function decodeValue(value) {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === 'object') {
    if (typeof value.__bin === 'string') return base64ToBytes(value.__bin).buffer;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeValue(v)]));
  }
  return value;
}

export async function exportBackup({ withRecordings }) {
  const out = { app: 'guitarhero', version: 1, exportedAt: new Date().toISOString(), stores: {}, blobs: {} };
  for (const name of TEXT_STORES) {
    if (name === 'recordings' && !withRecordings) continue;
    out.stores[name] = (await dbAll(name)).map(encodeValue);
  }
  out.settings = await dbGet('kv', 'settings');
  const recordingIds = new Set((await dbAll('recordings')).map((r) => r.id));
  for (const key of await dbKeys('blobs')) {
    if (!withRecordings && recordingIds.has(key)) continue;
    const blob = await dbGet('blobs', key);
    out.blobs[key] = { type: blob.type, data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) };
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([JSON.stringify(out)], { type: 'application/json' }), `guitarhero-sicherung-${stamp}.json`);
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (!['guitarhero', 'griffbrett'].includes(data.app)) throw new Error('Das ist keine Guitarhero-Sicherung.');
  for (const [name, items] of Object.entries(data.stores || {})) {
    if (!TEXT_STORES.includes(name)) continue;
    for (const item of items) await dbPut(name, decodeValue(item));
  }
  for (const [key, val] of Object.entries(data.blobs || {})) {
    await dbPut('blobs', new Blob([base64ToBytes(val.data)], { type: val.type }), key);
  }
  if (data.settings) await dbPut('kv', { ...data.settings, seeded: true }, 'settings');
  await bootState();
}
