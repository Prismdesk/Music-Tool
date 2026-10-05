import type { Note } from "./music-notes";

/** A chord in a song is stored as its symbol ("F#m7/A") so it survives reloads, transposition and engine changes. */
export type SongBlock =
  | { type: "text"; id: string; text: string }
  | { type: "chord"; id: string; symbol: string };

export interface SongSection { id: string; name: string; blocks: SongBlock[]; repeatCount?: number; }
export interface SongKey { root: Note; mode: "major" | "minor"; }
export interface Tempo { bpm: number; marking?: string; }

export interface Song {
  id: string;
  title: string;
  artist?: string;
  originalKey?: SongKey;
  tempo?: Tempo;
  capo?: number;
  tuningId?: string;
  transposition: number;
  sections: SongSection[];
  notes?: string;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}
