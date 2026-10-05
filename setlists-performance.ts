import { transposeSymbol, transposedKeyName } from "./music-chords";
import type { Song, SongBlock, SongSection } from "./songs";
import type { SetlistEntry } from "./setlists-types";

export interface PerformanceItem {
  entryId: string;
  songId: string;
  title: string;
  artist?: string;
  /** Key as it will be played, if the song has a key set. */
  keyName?: string;
  capo: number;
  bpm?: number;
  /** Total semitones applied on top of what is stored in the song. */
  transpose: number;
  notes?: string;
  songNotes?: string;
  sections: SongSection[];
  missing: boolean;
}

/** Sections to show, starting from the entry's chosen section (earlier sections follow after, so nothing is lost). */
export function sectionsFrom(song: Song, startingSectionId?: string): SongSection[] {
  const i = startingSectionId ? song.sections.findIndex((s) => s.id === startingSectionId) : -1;
  return i <= 0 ? song.sections : [...song.sections.slice(i), ...song.sections.slice(0, i)];
}

function transposeBlocks(blocks: SongBlock[], by: number): SongBlock[] {
  return blocks.map((b) => (b.type === "chord" ? { ...b, symbol: transposeSymbol(b.symbol, by) } : b));
}

/** Everything the performance screen needs for one setlist entry, with the entry's overrides applied. */
export function resolveEntry(entry: SetlistEntry, song: Song | undefined): PerformanceItem {
  if (!song) {
    return { entryId: entry.id, songId: entry.songId, title: "Song not found", capo: 0, transpose: 0, sections: [], missing: true, notes: entry.notes };
  }
  const by = entry.transpose ?? 0;
  const key = song.originalKey;
  return {
    entryId: entry.id,
    songId: song.id,
    title: song.title,
    artist: song.artist,
    keyName: key ? transposedKeyName(key.root, key.mode, song.transposition + by) : undefined,
    capo: entry.capoOverride ?? song.capo ?? 0,
    bpm: entry.tempoOverride ?? song.tempo?.bpm,
    transpose: by,
    notes: entry.notes,
    songNotes: song.notes,
    sections: sectionsFrom(song, entry.startingSectionId).map((s) => ({ ...s, blocks: transposeBlocks(s.blocks, by) })),
    missing: false
  };
}

/** Total time at a glance, e.g. for planning. Unknown tempos are ignored. */
export function summarize(items: PerformanceItem[]): { songs: number; missing: number } {
  return { songs: items.filter((i) => !i.missing).length, missing: items.filter((i) => i.missing).length };
}
