import type { Chord } from "./music-chords";
import type { Note } from "./music-notes";
import { getPitchClass, mod12 } from "./music-notes";

const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

export function toRomanNumeral(chord: Chord, key: Note): string {
  const offset = mod12(getPitchClass(chord.root) - getPitchClass(key));
  const degree = MAJOR_SCALE.indexOf(offset);
  if (degree < 0) return `♯${offset}`;
  const hasMinorThird = chord.formula.some((i) => i.degree === 3 && i.semitones === 3);
  const hasDiminishedFifth = chord.formula.some((i) => i.degree === 5 && i.semitones === 6);
  let numeral = hasMinorThird ? ROMANS[degree].toLowerCase() : ROMANS[degree];
  if (hasDiminishedFifth) numeral += "°";
  const seventh = chord.formula.find((i) => i.degree === 7);
  if (seventh) numeral += seventh.semitones === 11 ? "maj7" : "7";
  return numeral;
}
