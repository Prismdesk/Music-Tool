import type { Song, SongBlock, SongSection } from "./songs-types";

export const LEGACY_SONGS_KEY = "music-toolbox:songs:v1";

/** Convert a song saved by M5 (chord blocks held {chordId, label}) to the current shape. Returns null if it is unusable. */
export function upgradeLegacySong(raw: unknown): Song | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, any>;
  if (typeof s.id !== "string" || typeof s.title !== "string") return null;
  const now = new Date().toISOString();
  const sections: SongSection[] = Array.isArray(s.sections) ? s.sections.map((sec: any, i: number): SongSection => ({
    id: typeof sec?.id === "string" ? sec.id : `section-${i}`,
    name: typeof sec?.name === "string" ? sec.name : "Section",
    repeatCount: typeof sec?.repeatCount === "number" ? sec.repeatCount : undefined,
    blocks: (Array.isArray(sec?.blocks) ? sec.blocks : []).flatMap((b: any, j: number): SongBlock[] => {
      const id = typeof b?.id === "string" ? b.id : `block-${i}-${j}`;
      if (b?.type === "text") return [{ type: "text", id, text: String(b.text ?? "") }];
      if (b?.type === "chord") {
        const symbol = typeof b.symbol === "string" ? b.symbol : typeof b.label === "string" && b.label ? b.label : "C";
        return [{ type: "chord", id, symbol }];
      }
      return [];
    })
  })) : [];
  return {
    id: s.id,
    title: s.title,
    artist: typeof s.artist === "string" ? s.artist : undefined,
    originalKey: s.originalKey && typeof s.originalKey === "object" ? s.originalKey : undefined,
    tempo: s.tempo && typeof s.tempo.bpm === "number" ? s.tempo : undefined,
    capo: typeof s.capo === "number" ? s.capo : undefined,
    tuningId: typeof s.tuningId === "string" ? s.tuningId : undefined,
    transposition: typeof s.transposition === "number" ? s.transposition : 0,
    sections,
    notes: typeof s.notes === "string" ? s.notes : undefined,
    tags: Array.isArray(s.tags) ? s.tags.filter((t: unknown): t is string => typeof t === "string") : [],
    favorite: Boolean(s.favorite),
    createdAt: typeof s.createdAt === "string" ? s.createdAt : now,
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : now
  };
}
