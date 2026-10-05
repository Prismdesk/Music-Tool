import { openDatabase, promisify, transactionDone, type StoreName } from "./storage-db";
import { DEFAULT_SETTINGS, type AppSettings } from "./storage-models";

export const BACKUP_VERSION = 1;
export const APP_VERSION = "0.8.0";

/** Stores that hold user records (settings are handled separately). */
const RECORD_STORES = ["songs", "setlists", "savedChords", "savedShapes", "customChords", "voicings", "tunings", "favorites", "history"] as const satisfies readonly StoreName[];
type RecordStore = (typeof RECORD_STORES)[number];
type AnyRecord = { id: string } & Record<string, any>;

export interface BackupFile {
  app: "music-toolbox";
  backupVersion: number;
  appVersion: string;
  exportedAt: string;
  data: Record<RecordStore, AnyRecord[]> & { settings?: AppSettings };
}

export type ConflictStrategy = "skip" | "copy" | "overwrite";

export interface ImportReport {
  added: number;
  skipped: number;
  overwritten: number;
  copied: number;
  invalid: number;
  settingsApplied: boolean;
  perStore: Partial<Record<RecordStore, { added: number; conflicts: number; invalid: number }>>;
}

/** What each record type must look like to be worth importing. */
const VALIDATORS: Record<RecordStore, (r: any) => boolean> = {
  songs: (r) => typeof r.title === "string" && Array.isArray(r.sections) && Array.isArray(r.tags ?? []),
  setlists: (r) => typeof r.name === "string" && Array.isArray(r.entries),
  savedChords: (r) => typeof r.symbol === "string",
  savedShapes: (r) => typeof r.instrumentId === "string" && Array.isArray(r.frets),
  customChords: (r) => typeof r.name === "string" && Array.isArray(r.intervals),
  voicings: (r) => Array.isArray(r.midi),
  tunings: (r) => typeof r.instrumentId === "string" && Array.isArray(r.strings),
  favorites: (r) => typeof r.entityId === "string" && typeof r.entityType === "string",
  history: (r) => typeof r.kind === "string"
};

const isRecord = (v: unknown): v is AnyRecord => !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as any).id === "string" && (v as any).id.length > 0;

export async function createBackup(): Promise<BackupFile> {
  const db = await openDatabase();
  // One read transaction so the file is a consistent snapshot.
  const tx = db.transaction([...RECORD_STORES, "settings"], "readonly");
  const data: Partial<BackupFile["data"]> = {};
  for (const store of RECORD_STORES) data[store] = await promisify<AnyRecord[]>(tx.objectStore(store).getAll());
  const stored = await promisify<(Partial<AppSettings> & { key: string }) | undefined>(tx.objectStore("settings").get("app"));
  const { key: _key, ...rest } = stored ?? { key: "app" };
  data.settings = { ...DEFAULT_SETTINGS, ...rest };
  return { app: "music-toolbox", backupVersion: BACKUP_VERSION, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), data: data as BackupFile["data"] };
}

export function backupFileName(date = new Date()): string {
  return `music-toolbox-backup-${date.toISOString().slice(0, 10)}.json`;
}

export type ParseResult = { ok: true; file: BackupFile } | { ok: false; error: string };

/** Check that text is a backup this version can read, without touching the database. */
export function parseBackup(text: string): ParseResult {
  let value: any;
  try { value = JSON.parse(text); } catch { return { ok: false, error: "That file isn't valid JSON." }; }
  if (!value || typeof value !== "object" || value.app !== "music-toolbox") return { ok: false, error: "That doesn't look like a Music Toolbox backup." };
  if (typeof value.backupVersion !== "number") return { ok: false, error: "The backup has no version number." };
  if (value.backupVersion > BACKUP_VERSION) return { ok: false, error: "This backup was made by a newer version of the app. Update the app and try again." };
  if (!value.data || typeof value.data !== "object") return { ok: false, error: "The backup has no data." };
  for (const store of RECORD_STORES) {
    if (value.data[store] !== undefined && !Array.isArray(value.data[store])) return { ok: false, error: `The backup's "${store}" section is damaged.` };
  }
  const data = {} as BackupFile["data"];
  for (const store of RECORD_STORES) data[store] = (value.data[store] ?? []) as AnyRecord[];
  if (value.data.settings && typeof value.data.settings === "object") data.settings = { ...DEFAULT_SETTINGS, ...value.data.settings };
  return { ok: true, file: { ...value, data } };
}

function split(store: RecordStore, records: unknown[]) {
  const valid: AnyRecord[] = [];
  let invalid = 0;
  const seen = new Set<string>();
  for (const r of records) {
    if (isRecord(r) && VALIDATORS[store](r) && !seen.has(r.id)) { valid.push(r); seen.add(r.id); } else invalid += 1;
  }
  return { valid, invalid };
}

/** Count what an import would do, without changing anything. */
export async function previewImport(file: BackupFile): Promise<ImportReport> {
  return runImport(file, "skip", true);
}

/**
 * Import a backup in a single transaction: either everything is applied or nothing is.
 * skip = keep what you have, copy = keep both (imported records get new ids), overwrite = backup wins.
 */
export async function importBackup(file: BackupFile, strategy: ConflictStrategy): Promise<ImportReport> {
  return runImport(file, strategy, false);
}

async function runImport(file: BackupFile, strategy: ConflictStrategy, dryRun: boolean): Promise<ImportReport> {
  const db = await openDatabase();
  const tx = db.transaction([...RECORD_STORES, "settings"], dryRun ? "readonly" : "readwrite");
  const report: ImportReport = { added: 0, skipped: 0, overwritten: 0, copied: 0, invalid: 0, settingsApplied: false, perStore: {} };
  const idMap: Record<string, Map<string, string>> = {};
  const done = dryRun ? Promise.resolve() : transactionDone(tx);
  try {
    // Songs first, so setlists and favorites can follow any copied ids.
    const order: RecordStore[] = ["songs", ...RECORD_STORES.filter((s) => s !== "songs")];
    for (const store of order) {
      const { valid, invalid } = split(store, file.data[store] ?? []);
      const existing = new Set(await promisify<IDBValidKey[]>(tx.objectStore(store).getAllKeys()) as string[]);
      const info = { added: 0, conflicts: 0, invalid };
      report.invalid += invalid;
      idMap[store] = new Map();
      for (let record of valid) {
        if (store === "setlists") {
          const songMap = idMap.songs;
          record = { ...record, entries: record.entries.map((e: any) => (e && songMap.has(e.songId) ? { ...e, songId: songMap.get(e.songId) } : e)) };
        }
        if (store === "favorites") {
          const target = record.entityType === "song" ? idMap.songs : record.entityType === "setlist" ? idMap.setlists : undefined;
          if (target?.has(record.entityId)) record = { ...record, entityId: target.get(record.entityId) };
        }
        if (!existing.has(record.id)) {
          if (!dryRun) tx.objectStore(store).put(record);
          info.added += 1; report.added += 1;
          continue;
        }
        info.conflicts += 1;
        if (strategy === "skip") { report.skipped += 1; continue; }
        if (strategy === "overwrite") { if (!dryRun) tx.objectStore(store).put(record); report.overwritten += 1; continue; }
        const newId = `${record.id}-copy-${crypto.randomUUID().slice(0, 8)}`;
        idMap[store].set(record.id, newId);
        const copy: AnyRecord = { ...record, id: newId };
        if (store === "songs" && typeof copy.title === "string") copy.title = `${copy.title} (imported copy)`;
        if (store === "setlists" && typeof copy.name === "string") copy.name = `${copy.name} (imported copy)`;
        if (!dryRun) tx.objectStore(store).put(copy);
        report.copied += 1;
      }
      report.perStore[store] = info;
    }
    if (file.data.settings) {
      const current = await promisify(tx.objectStore("settings").get("app"));
      if (!current || strategy === "overwrite") {
        if (!dryRun) tx.objectStore("settings").put({ key: "app", ...file.data.settings });
        report.settingsApplied = true;
      }
    }
  } catch (error) {
    if (!dryRun) { try { tx.abort(); } catch { /* already finished */ } }
    await done.catch(() => undefined);
    throw error;
  }
  await done;
  return report;
}
