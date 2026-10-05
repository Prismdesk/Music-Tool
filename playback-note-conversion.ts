import type { Note } from "./music-notes";
import { getMidi } from "./music-notes";
import type { VoicedNote } from "./music-voicings-types";

export function noteToMidi(note: Note, fallbackOctave = 4): number {
  return getMidi({ ...note, octave: note.octave ?? fallbackOctave });
}

export function voicedNotesToMidi(notes: VoicedNote[]): number[] {
  return notes.map(note => note.midi ?? noteToMidi(note.note, 4));
}

/** Put chord tones into a compact playable register, preserving their order. */
export function chordNotesToMidi(notes: Note[], startOctave = 4): number[] {
  return notes.map((note, index) => {
    const octave = startOctave + (index > 0 && getMidi({ ...note, octave: startOctave }) <= (getMidi({ ...notes[0], octave: startOctave }) + 12) ? 1 : 0);
    return noteToMidi(note, octave);
  });
}
