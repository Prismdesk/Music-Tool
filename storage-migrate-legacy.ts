import { LEGACY_SONGS_KEY, upgradeLegacySong } from "./songs-legacy";
import { settingsRepo, songRepo } from "./storage-repositories";

/** Move songs saved by the M5 localStorage version into IndexedDB, once. The old data is kept as a fallback copy. */
export async function migrateLegacySongs(storage: Pick<Storage, "getItem" | "setItem"> = localStorage): Promise<number> {
  if (await settingsRepo.getFlag("legacy-songs-migrated")) return 0;
  let raw: string | null = null;
  try { raw = storage.getItem(LEGACY_SONGS_KEY); } catch { /* storage blocked */ }
  let moved = 0;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const existing = new Set((await songRepo.list()).map((s) => s.id));
        const songs = parsed.map(upgradeLegacySong).filter((s): s is NonNullable<typeof s> => s !== null && !existing.has(s.id));
        await songRepo.saveMany(songs);
        moved = songs.length;
      }
    } catch { /* unreadable legacy data is left untouched */ return 0; }
    try { storage.setItem(`${LEGACY_SONGS_KEY}:backup`, raw); } catch { /* ignore */ }
  }
  await settingsRepo.setFlag("legacy-songs-migrated");
  return moved;
}
