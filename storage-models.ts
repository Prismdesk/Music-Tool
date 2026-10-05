import type { Song } from "./songs";
import type { Setlist } from "./setlists";

export type EntityType = "song" | "setlist" | "savedChord" | "savedShape" | "customChord" | "voicing" | "tuning";

export interface SavedChord { id: string; symbol: string; createdAt: string }
export interface SavedShape { id: string; instrumentId: string; tuningId: string; capo: number; symbol?: string; name: string; frets: (number | null)[]; createdAt: string }
export interface CustomChord { id: string; name: string; root: string; intervals: { degree: number; semitones: number; symbol: string }[]; createdAt: string }
export interface SavedVoicing { id: string; symbol?: string; name: string; midi: number[]; createdAt: string }
export interface CustomTuning { id: string; instrumentId: string; name: string; strings: { name: string; midi: number }[] }
export interface Favorite { id: string; entityType: EntityType; entityId: string; createdAt: string }
export interface HistoryItem { id: string; kind: "chord" | "shape" | "voicing" | "song" | "setlist"; label: string; payload?: unknown; createdAt: string }

export interface AppSettings {
  noteNaming: "automatic" | "sharps" | "flats";
  theme: "system" | "light" | "dark";
  defaultInstrument: "piano" | "guitar" | "ukulele";
  defaultGuitarTuning: string;
  defaultUkuleleTuning: string;
  metronomeBpm: number;
  playbackVolume: number;
  showNonChordNotes: boolean;
  fretCount: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  noteNaming: "automatic", theme: "system", defaultInstrument: "guitar", defaultGuitarTuning: "guitar-standard",
  defaultUkuleleTuning: "ukulele-high-g", metronomeBpm: 100, playbackVolume: 0.8, showNonChordNotes: false, fretCount: 12
};

export type { Song, Setlist };
