// Optionaler Aufnahme-Ordner auf deinem Rechner (Chrome und Edge).
import { createStore } from './core.js';
import { dbDelete, dbGet, dbPut } from './db.js';

export const folderState = createStore({
  supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  name: '',
  permission: 'none', // none | granted | prompt
});

let handle = null;

async function queryPermission(request = false) {
  if (!handle) return 'none';
  const opts = { mode: 'readwrite' };
  let state = await handle.queryPermission(opts);
  if (state !== 'granted' && request) state = await handle.requestPermission(opts);
  folderState.patch({ permission: state === 'granted' ? 'granted' : 'prompt' });
  return state;
}

export async function loadFolder() {
  if (!folderState.get().supported) return;
  handle = (await dbGet('kv', 'folderHandle')) || null;
  if (handle) {
    folderState.patch({ name: handle.name });
    await queryPermission();
  }
}

export async function pickFolder() {
  handle = await window.showDirectoryPicker({ id: 'guitarhero-aufnahmen', mode: 'readwrite' });
  await dbPut('kv', handle, 'folderHandle');
  folderState.patch({ name: handle.name, permission: 'granted' });
}

export async function reconnectFolder() {
  return queryPermission(true);
}

export async function forgetFolder() {
  handle = null;
  await dbDelete('kv', 'folderHandle');
  folderState.patch({ name: '', permission: 'none' });
}

export async function writeToFolder(fileName, blob) {
  if (!handle || folderState.get().permission !== 'granted') return false;
  try {
    const file = await handle.getFileHandle(fileName, { create: true });
    const w = await file.createWritable();
    await w.write(blob);
    await w.close();
    return true;
  } catch {
    return false;
  }
}

export async function deleteFromFolder(fileName) {
  if (!handle || folderState.get().permission !== 'granted') return;
  try {
    await handle.removeEntry(fileName);
  } catch {
    // Datei ist schon weg oder wurde verschoben: nichts zu tun.
  }
}

export async function listFolderAudio() {
  if (!handle || folderState.get().permission !== 'granted') return [];
  const out = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && /\.(webm|m4a|ogg)$/i.test(entry.name)) out.push(entry);
  }
  return out;
}
