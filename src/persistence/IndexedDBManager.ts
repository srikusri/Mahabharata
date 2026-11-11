/**
 * Tiny key-value store on IndexedDB with graceful fallback (localStorage, then
 * memory). iOS Safari can block or evict storage in private mode, so every call
 * is best-effort and never throws.
 */
const DB_NAME = 'mahabharata';
const STORE = 'kv';
const memory = new Map<string, unknown>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return;
  } catch {
    /* try localStorage */
  }
  try {
    localStorage.setItem(`mg:${key}`, JSON.stringify(value));
  } catch {
    /* memory only */
  }
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    const v = await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (v !== undefined) return v;
  } catch {
    /* try localStorage */
  }
  try {
    const raw = localStorage.getItem(`mg:${key}`);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* memory only */
  }
  return memory.get(key) as T | undefined;
}

export async function kvDelete(key: string): Promise<void> {
  memory.delete(key);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(`mg:${key}`);
  } catch {
    /* ignore */
  }
}

export interface Prefs {
  name: string;
  tokenId: string;
}

export const loadPrefs = () => kvGet<Prefs>('prefs');
export const savePrefs = (p: Prefs) => kvSet('prefs', p);

export interface SavedSessionRecord {
  roomId: string;
  playerId: string;
  secret: string;
}
export const loadSession = async () => (await kvGet<SavedSessionRecord>('session')) ?? null;
export const saveSession = (s: SavedSessionRecord) => kvSet('session', s);
export const clearSession = () => kvDelete('session');
