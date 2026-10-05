import { openDatabase, promisify, transactionDone } from "./storage-db";
import { Repository } from "./storage-repository";
import { DEFAULT_SETTINGS, type AppSettings, type CustomChord, type CustomTuning, type Favorite, type HistoryItem, type SavedChord, type SavedShape, type SavedVoicing } from "./storage-models";
import type { Setlist } from "./setlists";
import type { Song } from "./songs";

export const songRepo = new Repository<Song>("songs");
export const setlistRepo = new Repository<Setlist>("setlists");
export const savedChordRepo = new Repository<SavedChord>("savedChords");
export const savedShapeRepo = new Repository<SavedShape>("savedShapes");
export const customChordRepo = new Repository<CustomChord>("customChords");
export const voicingRepo = new Repository<SavedVoicing>("voicings");
export const tuningRepo = new Repository<CustomTuning>("tunings");
export const favoriteRepo = new Repository<Favorite>("favorites");
export const historyRepo = new Repository<HistoryItem>("history");

const HISTORY_LIMIT = 100;

// Timestamps must strictly increase so "newest first" is never ambiguous, even for two saves in the same millisecond.
let lastStamp = 0;
function nextStamp(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp).toISOString();
}

/** Record a recent item, newest first, capped so history cannot grow forever. */
export async function addHistory(item: Omit<HistoryItem, "id" | "createdAt">): Promise<void> {
  const all = (await historyRepo.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const dup = all.find((h) => h.kind === item.kind && h.label === item.label);
  if (dup) await historyRepo.remove(dup.id);
  await historyRepo.save({ ...item, id: `hist-${crypto.randomUUID()}`, createdAt: nextStamp() });
  const fresh = (await historyRepo.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const old of fresh.slice(HISTORY_LIMIT)) await historyRepo.remove(old.id);
}

/** Remember something the user looked at. Never throws: history is a convenience, not data worth interrupting for. */
export async function recordRecent(kind: HistoryItem["kind"], label: string, payload?: unknown): Promise<void> {
  try { await addHistory({ kind, label, payload }); } catch { /* ignore */ }
}

export async function recentHistory(kinds?: HistoryItem["kind"][], limit = 12): Promise<HistoryItem[]> {
  try {
    const all = await historyRepo.list();
    return all.filter((h) => !kinds || kinds.includes(h.kind)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  } catch { return []; }
}

export async function clearHistory(): Promise<void> { await historyRepo.clear(); }

export const settingsRepo = {
  async get(): Promise<AppSettings> {
    const db = await openDatabase();
    const stored = await promisify<(Partial<AppSettings> & { key: string }) | undefined>(db.transaction("settings").objectStore("settings").get("app"));
    const { key: _key, ...rest } = stored ?? { key: "app" };
    return { ...DEFAULT_SETTINGS, ...rest };
  },
  async save(settings: AppSettings): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ key: "app", ...settings });
    await transactionDone(tx);
  },
  async getFlag(name: string): Promise<boolean> {
    const db = await openDatabase();
    const row = await promisify<{ value?: boolean } | undefined>(db.transaction("settings").objectStore("settings").get(`flag:${name}`));
    return Boolean(row?.value);
  },
  async setFlag(name: string, value = true): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ key: `flag:${name}`, value });
    await transactionDone(tx);
  }
};

export async function clearAllUserData(): Promise<void> {
  await Promise.all([songRepo, setlistRepo, savedChordRepo, savedShapeRepo, customChordRepo, voicingRepo, tuningRepo, favoriteRepo, historyRepo].map((r) => r.clear()));
  const db = await openDatabase();
  const tx = db.transaction("settings", "readwrite");
  tx.objectStore("settings").clear();
  await transactionDone(tx);
}

export async function libraryStats() {
  const [songs, setlists, savedChords, savedShapes, customChords] = await Promise.all([songRepo.count(), setlistRepo.count(), savedChordRepo.count(), savedShapeRepo.count(), customChordRepo.count()]);
  return { songs, setlists, savedChords, savedShapes, customChords };
}
