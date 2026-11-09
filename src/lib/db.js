// IndexedDB: alles Dauerhafte liegt lokal auf deinem Gerät.
const DB_NAME = 'griffbrett';
const DB_VERSION = 1;
export const STORES = ['kv', 'plans', 'chords', 'patterns', 'scores', 'recordings', 'blobs', 'sessions', 'records'];

let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, name === 'kv' || name === 'blobs' ? undefined : { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    const req = fn(os);
    tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const dbGet = (store, key) => run(store, 'readonly', (os) => os.get(key));
export const dbAll = (store) => run(store, 'readonly', (os) => os.getAll());
export const dbKeys = (store) => run(store, 'readonly', (os) => os.getAllKeys());
export const dbPut = (store, value, key) =>
  run(store, 'readwrite', (os) => (key === undefined ? os.put(value) : os.put(value, key)));
export const dbDelete = (store, key) => run(store, 'readwrite', (os) => os.delete(key));
export const dbClear = (store) => run(store, 'readwrite', (os) => os.clear());
