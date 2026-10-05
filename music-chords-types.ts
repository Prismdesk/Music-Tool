import type { IntervalFormula } from "./music-intervals";
import type { Note } from "./music-notes";

export type ChordCategory = "major" | "minor" | "dominant" | "diminished" | "augmented" | "suspended" | "extended" | "added" | "altered" | "other";

export interface ChordDefinition {
  id: string;
  name: string;
  aliases: string[];
  intervals: IntervalFormula[];
  category: ChordCategory;
  builtIn: boolean;
  priority: number;
}

export interface Chord {
  id: string;
  root: Note;
  definitionId?: string;
  formula: IntervalFormula[];
  bass?: Note;
}

export interface CustomChord {
  id: string;
  chord: Chord;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChordIdentificationCandidate {
  chord: Chord;
  definition?: ChordDefinition;
  confidence: number;
  exact: boolean;
  incomplete: boolean;
  rootless: boolean;
  missingDegrees: number[];
  extraPitchClasses: number[];
  reason: string;
}

export interface ChordIdentificationResult {
  inputNotes: Note[];
  likely: ChordIdentificationCandidate | null;
  alternatives: ChordIdentificationCandidate[];
}
