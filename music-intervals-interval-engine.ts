import type { Note } from "./music-notes-types";
import { getPitchClass, NOTE_LETTERS } from "./music-notes";
import type { Interval, IntervalNumber, IntervalQuality } from "./music-intervals-types";

const PERFECT_BASE: Record<number, number> = { 1: 0, 4: 5, 5: 7 };
const MAJOR_BASE: Record<number, number> = { 2: 2, 3: 4, 6: 9, 7: 11 };

export function intervalNumber(from: Note, to: Note): IntervalNumber {
  const fromIndex = NOTE_LETTERS.indexOf(from.letter);
  const toIndex = NOTE_LETTERS.indexOf(to.letter);
  return (((toIndex - fromIndex + 7) % 7) + 1) as IntervalNumber;
}

export function intervalQuality(number: IntervalNumber, semitones: number): IntervalQuality {
  const base = PERFECT_BASE[number] ?? MAJOR_BASE[number];
  const delta = semitones - base;
  const perfectClass = number === 1 || number === 4 || number === 5;
  if (delta === 0) return perfectClass ? "perfect" : "major";
  if (!perfectClass && delta === -1) return "minor";
  if (delta === 1) return "augmented";
  if (delta === -1 && perfectClass) return "diminished";
  if (delta === -2 && !perfectClass) return "diminished";
  if (delta === -2 && perfectClass) return "diminished";
  throw new Error(`Unsupported interval quality: ${number} at ${semitones} semitones.`);
}

export function calculateInterval(from: Note, to: Note): Interval {
  const semitones = ((getPitchClass(to) - getPitchClass(from)) + 12) % 12;
  const number = intervalNumber(from, to);
  return { number, semitones, quality: intervalQuality(number, semitones) };
}

export function intervalSymbol(interval: Interval): string {
  const quality = interval.quality;
  const prefix = quality === "major" || quality === "perfect" ? "" : quality === "minor" ? "m" : quality === "augmented" ? "A" : "d";
  return `${prefix}${interval.number}`;
}
