import type { Note } from "./music-notes";

export type InstrumentKind = "piano" | "stringed";
export type StringState = "open" | "fretted" | "muted" | "unused";

export interface InstrumentDefinition {
  id: string;
  name: string;
  kind: InstrumentKind;
  stringCount?: number;
  fretCount?: number;
}

export interface TuningString {
  id: string;
  name: string;
  pitch: Note;
}

export interface Tuning {
  id: string;
  name: string;
  instrumentId: string;
  strings: TuningString[];
}

export interface StringPosition {
  stringIndex: number;
  fret: number;
  state: StringState;
  note?: Note;
}

export type MusicalFunction = "root" | "third" | "fifth" | "seventh" | "extension" | "other";
