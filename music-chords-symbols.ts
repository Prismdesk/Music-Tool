import type { Note } from "./music-notes";
import { formatNote } from "./music-notes";
import { getPitchClass } from "./music-notes";
import { parseChordSymbol } from "./music-chords-parse";
import { formatChordSymbol } from "./music-chords-naming";
import { transposeChord, transposeNote } from "./music-chords-transposition";

/** Transpose a chord symbol. Text that isn't a chord is returned unchanged. */
export function transposeSymbol(symbol: string, semitones: number): string {
  if (semitones % 12 === 0) return symbol;
  const parsed = parseChordSymbol(symbol);
  return parsed ? formatChordSymbol(transposeChord(parsed.chord, semitones)) : symbol;
}

/** Name of a key after moving it by some semitones, e.g. G major up 2 = "A major". */
export function transposedKeyName(root: Note, mode: "major" | "minor", semitones: number): string {
  const moved = transposeNote({ letter: root.letter, accidental: root.accidental }, semitones, "automatic", mode === "minor");
  return `${formatNote(moved)}${mode === "minor" ? "m" : ""}`;
}

/** Semitones from one key to another (0–11), using the shortest direction for display (-5…+6). */
export function semitonesBetween(from: Note, to: Note): number {
  const diff = (((getPitchClass(to) - getPitchClass(from)) % 12) + 12) % 12;
  return diff > 6 ? diff - 12 : diff;
}

