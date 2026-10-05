import { openDatabase, promisify, transactionDone, type StoreName } from "./storage-db";

export interface Identified { id: string }

/** Typed access to one object store. UI code uses repositories, never IndexedDB directly. */
export class Repository<T extends Identified> {
  constructor(readonly store: StoreName) {}

  async list(): Promise<T[]> {
    const db = await openDatabase();
    return promisify<T[]>(db.transaction(this.store).objectStore(this.store).getAll());
  }

  async get(id: string): Promise<T | undefined> {
    const db = await openDatabase();
    return promisify<T | undefined>(db.transaction(this.store).objectStore(this.store).get(id));
  }

  async count(): Promise<number> {
    const db = await openDatabase();
    return promisify(db.transaction(this.store).objectStore(this.store).count());
  }

  async save(item: T): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(this.store, "readwrite");
    tx.objectStore(this.store).put(item);
    await transactionDone(tx);
  }

  async saveMany(items: T[]): Promise<void> {
    if (!items.length) return;
    const db = await openDatabase();
    const tx = db.transaction(this.store, "readwrite");
    const store = tx.objectStore(this.store);
    for (const item of items) store.put(item);
    await transactionDone(tx);
  }

  async remove(id: string): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(this.store, "readwrite");
    tx.objectStore(this.store).delete(id);
    await transactionDone(tx);
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(this.store, "readwrite");
    tx.objectStore(this.store).clear();
    await transactionDone(tx);
  }
}
