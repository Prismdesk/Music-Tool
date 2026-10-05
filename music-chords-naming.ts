import type { Chord, ChordDefinition } from "./music-chords-types";
import { formatNote } from "./music-notes";
import { chordRegistry } from "./music-chords-registry";

export function formatChordName(chord: Chord, definition?: ChordDefinition): string {
  const quality = definition?.name ?? "";
  const base = `${formatNote(chord.root)}${quality}`;
  return chord.bass && formatNote(chord.bass) !== formatNote(chord.root) ? `${base}/${formatNote(chord.bass)}` : base;
}

/** Display symbol for any chord whose definition is registered (e.g. "F#m7/A"). */
export function formatChordSymbol(chord: Chord): string {
  const definition = chord.definitionId ? chordRegistry.all().find((d) => d.id === chord.definitionId) : undefined;
  return formatChordName(chord, definition);
}
