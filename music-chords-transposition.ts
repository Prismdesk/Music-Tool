import type { Chord } from "./music-chords-types";
import type { Note, NoteNamePreference } from "./music-notes";
import { getPitchClass } from "./music-notes";
import { spellChordRoot, spellPitchClass } from "./music-notes-spelling";

function isMinorThird(chord: Chord): boolean {
  return chord.formula.some((i) => i.degree === 3 && i.semitones === 3);
}

export function transposeNote(note: Note, semitones: number, preference: NoteNamePreference = "automatic", minor = false): Note {
  const pc = getPitchClass(note) + semitones;
  let spelled: Note;
  if (preference === "automatic") {
    // Keep the sharp/flat family of the source note; natural notes use common chord-root spellings.
    spelled = note.accidental > 0 ? spellPitchClass(pc, "sharps") : note.accidental < 0 ? spellPitchClass(pc, "flats") : spellChordRoot(pc, minor);
  } else {
    spelled = spellPitchClass(pc, preference);
  }
  return { ...spelled, octave: note.octave === undefined ? undefined : note.octave + Math.floor(pc / 12) };
}

export function transposeChord(chord: Chord, semitones: number, preference: NoteNamePreference = "automatic"): Chord {
  const minor = isMinorThird(chord);
  const root = transposeNote(chord.root, semitones, preference, minor);
  const bass = chord.bass ? transposeNote(chord.bass, semitones, preference === "automatic" ? (root.accidental < 0 ? "flats" : root.accidental > 0 ? "sharps" : "automatic") : preference) : undefined;
  return { ...chord, id: `${chord.id}-t${semitones}`, root, bass };
}
