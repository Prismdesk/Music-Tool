import type { Chord } from "./music-chords";
import type { Note } from "./music-notes";
import { getPitchClass, mod12 } from "./music-notes";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const SUFFIXES: Record<string, string> = { "3:minor": "m", "5:diminished": "dim" };

export function toNashvilleNumber(chord: Chord, key: Note): string {
  const offset = mod12(getPitchClass(chord.root) - getPitchClass(key));
  const index = MAJOR_SCALE.indexOf(offset);
  if (index < 0) return `♯${offset}`;
  const third = chord.formula.find((i) => i.degree === 3);
  const fifth = chord.formula.find((i) => i.degree === 5);
  const suffix = fifth?.semitones === 6 ? "dim" : third ? (SUFFIXES[`${third.degree}:${third.quality}`] ?? "") : "";
  const seventh = chord.formula.find((i) => i.degree === 7);
  return `${index + 1}${suffix}${seventh ? (seventh.semitones === 11 ? "maj7" : "7") : ""}`;
}
