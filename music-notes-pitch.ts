import type { Accidental, Note, NoteLetter, PitchedNote } from "./music-notes-types";

export const NOTE_LETTERS: readonly NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];
export const NATURAL_PITCH_CLASSES: Record<NoteLetter, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
};

export function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function getPitchClass(note: Note): number {
  return mod12(NATURAL_PITCH_CLASSES[note.letter] + note.accidental);
}

export function getMidi(note: Note): number {
  if (note.octave === undefined) throw new Error("MIDI conversion requires an octave.");
  return (note.octave + 1) * 12 + getPitchClass(note);
}

export function toPitchedNote(note: Note): PitchedNote {
  return { ...note, pitchClass: getPitchClass(note), midi: note.octave === undefined ? undefined : getMidi(note) };
}

export function transposePitchClass(pitchClass: number, semitones: number): number {
  return mod12(pitchClass + semitones);
}

export function accidentalFromOffset(offset: number): Accidental {
  if (offset < -2 || offset > 2 || !Number.isInteger(offset)) {
    throw new RangeError(`Accidental ${offset} is outside supported range -2..2.`);
  }
  return offset as Accidental;
}
