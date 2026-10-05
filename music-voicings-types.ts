import type { Note } from "./music-notes";

export interface VoicedNote {
  note: Note;
  midi?: number;
  order: number;
}

export interface Voicing {
  id: string;
  chordId?: string;
  notes: VoicedNote[];
  bass?: VoicedNote;
  inversion?: number;
  name?: string;
  notesText?: string;
}
