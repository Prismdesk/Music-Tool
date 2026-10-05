import type { Chord, ChordDefinition } from "./music-chords-types";
import type { Note } from "./music-notes";
import { getPitchClass } from "./music-notes";
import { noteForDegreeAndPitch } from "./music-notes-spelling";
import { formatChordName } from "./music-chords-naming";

let nextId = 1;

export function createChord(root: Note, definition: ChordDefinition, bass?: Note): Chord {
  const formula = definition.intervals.map((interval) => ({ ...interval }));
  const id = `chord-${nextId++}`;
  return { id, root, definitionId: definition.id, formula, bass };
}

export function chordNotes(chord: Chord): Note[] {
  return chord.formula.map((interval) => noteForDegreeAndPitch(chord.root, interval.degree, getPitchClass(chord.root) + interval.semitones));
}

export function nameChord(chord: Chord, definition?: ChordDefinition): string {
  return formatChordName(chord, definition);
}
