import type { Chord } from "./music-chords";
import { chordNotes } from "./music-chords";
import type { Note, NoteNamePreference } from "./music-notes";
import { getPitchClass, formatNote } from "./music-notes";
import { spellPitchClass } from "./music-notes-spelling";

/** Maps every pitch class to a spelling that agrees with the chord (Bb chords show Bb, not A#). */
export function chordSpelling(chord: Chord): (pc: number) => Note {
  const known = new Map<number, Note>();
  for (const n of chordNotes(chord)) known.set(getPitchClass(n), { letter: n.letter, accidental: n.accidental });
  const flats = chord.root.accidental < 0 || [...known.values()].some((n) => n.accidental < 0);
  const preference: NoteNamePreference = flats ? "flats" : chord.root.accidental > 0 ? "sharps" : "automatic";
  return (pc: number) => known.get(((pc % 12) + 12) % 12) ?? spellPitchClass(pc, preference);
}

const SYMBOL = ["𝄫", "♭", "", "♯", "𝄪"];
export function prettyNote(n: Note): string { return `${n.letter}${SYMBOL[n.accidental + 2]}`; }
export function plainNote(n: Note): string { return formatNote({ ...n, octave: undefined }); }

export type ChordFunction = "root" | "third" | "fifth" | "seventh" | "extension" | "other";
export function functionOf(chord: Chord, pc: number): ChordFunction | null {
  const root = getPitchClass(chord.root);
  const interval = chord.formula.find((i) => (((root + i.semitones) % 12) + 12) % 12 === ((pc % 12) + 12) % 12);
  if (!interval) return null;
  if (interval.degree === 1) return "root";
  if (interval.degree === 3) return "third";
  if (interval.degree === 5) return "fifth";
  if (interval.degree === 7) return "seventh";
  if (interval.degree > 7) return "extension";
  return "other"; // 2nds and 4ths of suspended chords
}
