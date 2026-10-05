export type NoteLetter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type Accidental = -2 | -1 | 0 | 1 | 2;

export interface Note {
  letter: NoteLetter;
  accidental: Accidental;
  octave?: number;
}

export interface PitchedNote extends Note {
  pitchClass: number;
  midi?: number;
}

export type NoteNamePreference = "automatic" | "sharps" | "flats";
