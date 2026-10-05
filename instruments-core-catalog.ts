import type { InstrumentDefinition, Tuning } from "./instruments-core-types";
import type { Note } from "./music-notes";

const n = (letter: Note["letter"], octave: number): Note => ({ letter, accidental: 0, octave });

export const INSTRUMENTS: InstrumentDefinition[] = [
  { id: "piano", name: "Piano", kind: "piano" },
  { id: "guitar", name: "Guitar", kind: "stringed", stringCount: 6, fretCount: 24 },
  { id: "ukulele", name: "Ukulele", kind: "stringed", stringCount: 4, fretCount: 24 },
];

export const TUNINGS: Tuning[] = [
  { id: "guitar-standard", name: "Standard · E A D G B E", instrumentId: "guitar", strings: [
    { id: "g6", name: "6", pitch: n("E", 2) }, { id: "g5", name: "5", pitch: n("A", 2) }, { id: "g4", name: "4", pitch: n("D", 3) },
    { id: "g3", name: "3", pitch: n("G", 3) }, { id: "g2", name: "2", pitch: n("B", 3) }, { id: "g1", name: "1", pitch: n("E", 4) },
  ]},
  { id: "ukulele-high-g", name: "High-G · G C E A", instrumentId: "ukulele", strings: [
    { id: "u4", name: "4", pitch: n("G", 4) }, { id: "u3", name: "3", pitch: n("C", 4) }, { id: "u2", name: "2", pitch: n("E", 4) }, { id: "u1", name: "1", pitch: n("A", 4) },
  ]},
  { id: "ukulele-low-g", name: "Low-G · G C E A", instrumentId: "ukulele", strings: [
    { id: "u4-low", name: "4", pitch: n("G", 3) }, { id: "u3-low", name: "3", pitch: n("C", 4) }, { id: "u2-low", name: "2", pitch: n("E", 4) }, { id: "u1-low", name: "1", pitch: n("A", 4) },
  ]},
];

export function getInstrument(id: string): InstrumentDefinition { return INSTRUMENTS.find(i => i.id === id) ?? INSTRUMENTS[0]; }
export function getTuningsForInstrument(id: string): Tuning[] { return TUNINGS.filter(t => t.instrumentId === id); }
