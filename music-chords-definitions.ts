import type { ChordDefinition } from "./music-chords-types";
import type { IntervalFormula } from "./music-intervals";

const f = (degree: number, semitones: number, symbol: string, quality: IntervalFormula["quality"]): IntervalFormula => ({ degree, semitones, symbol, quality });
const ONE = f(1, 0, "1", "perfect");

export const CHORD_DEFINITIONS: ChordDefinition[] = [
  { id: "maj", name: "", aliases: ["major", "M", "maj"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect")], category: "major", builtIn: true, priority: 100 },
  { id: "5", name: "5", aliases: ["power", "power chord"], intervals: [ONE, f(5,7,"5","perfect")], category: "other", builtIn: true, priority: 95 },
  { id: "min", name: "m", aliases: ["minor", "-", "min", "mi"], intervals: [ONE, f(3,3,"b3","minor"), f(5,7,"5","perfect")], category: "minor", builtIn: true, priority: 100 },
  { id: "dim", name: "dim", aliases: ["diminished", "°"], intervals: [ONE, f(3,3,"b3","minor"), f(5,6,"b5","diminished")], category: "diminished", builtIn: true, priority: 95 },
  { id: "aug", name: "aug", aliases: ["+", "augmented", "aug5", "#5"], intervals: [ONE, f(3,4,"3","major"), f(5,8,"#5","augmented")], category: "augmented", builtIn: true, priority: 95 },
  { id: "sus2", name: "sus2", aliases: ["suspended 2"], intervals: [ONE, f(2,2,"2","major"), f(5,7,"5","perfect")], category: "suspended", builtIn: true, priority: 90 },
  { id: "sus4", name: "sus4", aliases: ["sus", "suspended 4", "sus4"], intervals: [ONE, f(4,5,"4","perfect"), f(5,7,"5","perfect")], category: "suspended", builtIn: true, priority: 90 },
  { id: "6", name: "6", aliases: ["six"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(6,9,"6","major")], category: "major", builtIn: true, priority: 90 },
  { id: "m6", name: "m6", aliases: ["minor 6"], intervals: [ONE, f(3,3,"b3","minor"), f(5,7,"5","perfect"), f(6,9,"6","major")], category: "minor", builtIn: true, priority: 90 },
  { id: "7", name: "7", aliases: ["dominant 7"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,10,"b7","minor")], category: "dominant", builtIn: true, priority: 100 },
  { id: "maj7", name: "maj7", aliases: ["M7", "major 7", "Maj7", "Δ7", "Δ"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,11,"7","major")], category: "major", builtIn: true, priority: 100 },
  { id: "m7", name: "m7", aliases: ["minor 7", "-7", "min7", "mi7"], intervals: [ONE, f(3,3,"b3","minor"), f(5,7,"5","perfect"), f(7,10,"b7","minor")], category: "minor", builtIn: true, priority: 100 },
  { id: "m7b5", name: "m7b5", aliases: ["half-diminished", "ø7", "ø", "min7b5"], intervals: [ONE, f(3,3,"b3","minor"), f(5,6,"b5","diminished"), f(7,10,"b7","minor")], category: "diminished", builtIn: true, priority: 95 },
  { id: "dim7", name: "dim7", aliases: ["°7", "diminished 7"], intervals: [ONE, f(3,3,"b3","minor"), f(5,6,"b5","diminished"), f(7,9,"bb7","diminished")], category: "diminished", builtIn: true, priority: 95 },
  { id: "9", name: "9", aliases: ["dominant 9"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,10,"b7","minor"), f(9,14,"9","major")], category: "extended", builtIn: true, priority: 90 },
  { id: "maj9", name: "maj9", aliases: ["major 9"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,11,"7","major"), f(9,14,"9","major")], category: "extended", builtIn: true, priority: 90 },
  { id: "m9", name: "m9", aliases: ["minor 9", "min9"], intervals: [ONE, f(3,3,"b3","minor"), f(5,7,"5","perfect"), f(7,10,"b7","minor"), f(9,14,"9","major")], category: "extended", builtIn: true, priority: 90 },
  { id: "11", name: "11", aliases: ["dominant 11"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,10,"b7","minor"), f(9,14,"9","major"), f(11,17,"11","perfect")], category: "extended", builtIn: true, priority: 80 },
  { id: "13", name: "13", aliases: ["dominant 13"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,10,"b7","minor"), f(9,14,"9","major"), f(11,17,"11","perfect"), f(13,21,"13","major")], category: "extended", builtIn: true, priority: 80 },
  { id: "add9", name: "add9", aliases: ["add 9", "add2"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(9,14,"9","major")], category: "added", builtIn: true, priority: 85 },
  { id: "madd9", name: "m(add9)", aliases: ["minor add 9", "madd9", "minadd9"], intervals: [ONE, f(3,3,"b3","minor"), f(5,7,"5","perfect"), f(9,14,"9","major")], category: "added", builtIn: true, priority: 85 },
  { id: "7sus4", name: "7sus4", aliases: ["sus7"], intervals: [ONE, f(4,5,"4","perfect"), f(5,7,"5","perfect"), f(7,10,"b7","minor")], category: "suspended", builtIn: true, priority: 85 },
  { id: "7b5", name: "7b5", aliases: ["7-5"], intervals: [ONE, f(3,4,"3","major"), f(5,6,"b5","diminished"), f(7,10,"b7","minor")], category: "altered", builtIn: true, priority: 80 },
  { id: "7#5", name: "7#5", aliases: ["7+5"], intervals: [ONE, f(3,4,"3","major"), f(5,8,"#5","augmented"), f(7,10,"b7","minor")], category: "altered", builtIn: true, priority: 80 },
  { id: "7b9", name: "7b9", aliases: ["7-9"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,10,"b7","minor"), f(9,13,"b9","minor")], category: "altered", builtIn: true, priority: 75 },
  { id: "7#9", name: "7#9", aliases: ["7+9"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,10,"b7","minor"), f(9,15,"#9","augmented")], category: "altered", builtIn: true, priority: 75 },
  { id: "7#11", name: "7#11", aliases: ["7+11"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,10,"b7","minor"), f(9,14,"9","major"), f(11,18,"#11","augmented")], category: "altered", builtIn: true, priority: 75 },
  { id: "7b13", name: "7b13", aliases: ["7-13"], intervals: [ONE, f(3,4,"3","major"), f(5,7,"5","perfect"), f(7,10,"b7","minor"), f(9,14,"9","major"), f(13,20,"b13","minor")], category: "altered", builtIn: true, priority: 75 }
];
