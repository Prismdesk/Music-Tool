import type { ScaleDefinition } from "./music-scales-types";
import type { IntervalFormula } from "./music-intervals";

const i = (degree: number, semitones: number, symbol: string): IntervalFormula => ({ degree, semitones, symbol, quality: "major" });

export const SCALE_DEFINITIONS: ScaleDefinition[] = [
  { id: "major", name: "Major", aliases: ["Ionian"], category: "major", intervals: [i(1,0,"1"),i(2,2,"2"),i(3,4,"3"),i(4,5,"4"),i(5,7,"5"),i(6,9,"6"),i(7,11,"7")] },
  { id: "natural-minor", name: "Natural Minor", aliases: ["Aeolian"], category: "minor", intervals: [i(1,0,"1"),i(2,2,"2"),i(3,3,"b3"),i(4,5,"4"),i(5,7,"5"),i(6,8,"b6"),i(7,10,"b7")] },
  { id: "harmonic-minor", name: "Harmonic Minor", aliases: [], category: "minor", intervals: [i(1,0,"1"),i(2,2,"2"),i(3,3,"b3"),i(4,5,"4"),i(5,7,"5"),i(6,8,"b6"),i(7,11,"7")] },
  { id: "melodic-minor", name: "Melodic Minor", aliases: [], category: "minor", intervals: [i(1,0,"1"),i(2,2,"2"),i(3,3,"b3"),i(4,5,"4"),i(5,7,"5"),i(6,9,"6"),i(7,11,"7")] },
  { id: "major-pentatonic", name: "Major Pentatonic", aliases: [], category: "pentatonic", intervals: [i(1,0,"1"),i(2,2,"2"),i(3,4,"3"),i(5,7,"5"),i(6,9,"6")] },
  { id: "minor-pentatonic", name: "Minor Pentatonic", aliases: [], category: "pentatonic", intervals: [i(1,0,"1"),i(3,3,"b3"),i(4,5,"4"),i(5,7,"5"),i(7,10,"b7")] },
  { id: "chromatic", name: "Chromatic", aliases: [], category: "chromatic", intervals: Array.from({ length: 12 }, (_, n) => i(n + 1, n, String(n + 1))) }
];
