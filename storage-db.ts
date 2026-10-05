/** IndexedDB access with explicit, versioned migrations. Never change an existing migration: add a new one. */

export const DB_NAME = "music-toolbox";

export const STORE_NAMES = ["songs", "setlists", "savedChords", "savedShapes", "customChords", "voicings", "tunings", "favorites", "history", "settings"] as const;
export type StoreName = (typeof STORE_NAMES)[number];

type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

/** MIGRATIONS[n] upgrades a database from version n-1 to n. */
export const MIGRATIONS: Record<number, Migration> = {
  1: (db) => {
    for (const name of STORE_NAMES) {
      const store = db.createObjectStore(name, { keyPath: name === "settings" ? "key" : "id" });
      if (name === "favorites") store.createIndex("entityId", "entityId");
      if (name === "history") store.createIndex("createdAt", "createdAt");
    }
  }
};
export const DB_VERSION = Math.max(...Object.keys(MIGRATIONS).map(Number));

let connection: Promise<IDBDatabase> | null = null;

export function openDatabase(name = DB_NAME): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      for (let v = event.oldVersion + 1; v <= DB_VERSION; v += 1) MIGRATIONS[v]?.(db, tx);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };
    request.onerror = () => { connection = null; reject(request.error ?? new Error("Could not open the local database.")); };
    request.onblocked = () => { connection = null; reject(new Error("The local database is open in another tab and could not be upgraded. Close other tabs and retry.")); };
  });
  return connection;
}

/** Test helper: drop the cached connection (and optionally the database). */
export async function resetDatabase(deleteData = false, name = DB_NAME): Promise<void> {
  if (connection) { try { (await connection).close(); } catch { /* ignore */ } }
  connection = null;
  if (deleteData) await new Promise<void>((res, rej) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res(); });
}

export function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted."));
  });
}
