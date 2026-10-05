import type { Note } from "./music-notes";
import { getMidi, getPitchClass, mod12 } from "./music-notes";

const letters: Note["letter"][] = ["C","C","D","D","E","F","F","G","G","A","A","B"];
const accidentals = [0,1,0,1,0,0,1,0,1,0,1,0] as const;

export function noteAtFret(open: Note, fret: number, capo = 0): Note {
  const midi = getMidi(open) + capo + fret;
  const pc = mod12(midi);
  return {
    letter: letters[pc],
    accidental: accidentals[pc] as -1|0|1,
    octave: Math.floor(midi / 12) - 1,
  };
}

export function pitchClassMatches(note: Note, pitchClasses: number[]): boolean {
  return pitchClasses.includes(getPitchClass(note));
}
