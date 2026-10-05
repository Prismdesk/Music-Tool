import type { Note } from "./music-notes";
import { getPitchClass } from "./music-notes";
import { createChord } from "./music-chords-factory";
import { chordRegistry } from "./music-chords-registry";
import type { Chord, ChordDefinition } from "./music-chords-types";

export interface ParsedChord {
  chord: Chord;
  definition: ChordDefinition;
  /** Canonical symbol, e.g. "F#m7/A". */
  symbol: string;
}

const ACCIDENTAL: Record<string, -2 | -1 | 1 | 2> = { "#": 1, "##": 2, b: -1, bb: -2 };

function parseNote(text: string, upperOnly = false): Note | null {
  const m = /^([A-Ga-g])(##|bb|#|b)?$/.exec(text);
  if (!m) return null;
  if (upperOnly && m[1] !== m[1].toUpperCase()) return null;
  return { letter: m[1].toUpperCase() as Note["letter"], accidental: m[2] ? ACCIDENTAL[m[2]] : 0 };
}

let qualityLookup: Map<string, ChordDefinition> | null = null;
function lookup(): Map<string, ChordDefinition> {
  if (qualityLookup) return qualityLookup;
  const map = new Map<string, ChordDefinition>();
  // Names win over aliases so "m" always means minor and "M"/"maj" always mean major.
  for (const d of chordRegistry.all()) for (const alias of d.aliases) if (!map.has(alias)) map.set(alias, d);
  for (const d of chordRegistry.all()) { map.set(d.name, d); map.set(d.id, map.get(d.id) ?? d); }
  qualityLookup = map;
  return map;
}

function findQuality(text: string): ChordDefinition | null {
  const q = text.replace(/\s+/g, "");
  const map = lookup();
  if (map.has(q)) return map.get(q)!;
  if (q.length > 2) {
    const lower = q.toLowerCase();
    for (const [key, d] of map) if (key.length > 2 && key.toLowerCase() === lower) return d;
  }
  return null;
}

/** Parse a chord symbol such as "C", "Bbmaj7", "F#m7b5" or "C/E". Returns null when it isn't a chord we know. */
export function parseChordSymbol(input: string): ParsedChord | null {
  const text = input.trim().replace(/♯/g, "#").replace(/♭/g, "b");
  if (!text) return null;
  let main = text;
  let bass: Note | undefined;
  const slash = text.lastIndexOf("/");
  if (slash > 0) {
    const maybeBass = parseNote(text.slice(slash + 1));
    if (!maybeBass) return null;
    bass = maybeBass;
    main = text.slice(0, slash);
  }
  const m = /^([A-G])(##|bb|#|b)?(.*)$/.exec(main);
  if (!m) return null;
  const attempts: [Note, string][] = [];
  if (m[2]) attempts.push([{ letter: m[1] as Note["letter"], accidental: ACCIDENTAL[m[2]] }, m[3]]);
  attempts.push([{ letter: m[1] as Note["letter"], accidental: 0 }, (m[2] ?? "") + m[3]]);
  for (const [root, rest] of attempts) {
    const definition = findQuality(rest);
    if (!definition) continue;
    const useBass = bass && getPitchClass(bass) !== getPitchClass(root) ? bass : undefined;
    const chord = createChord(root, definition, useBass);
    const acc = ["bb", "b", "", "#", "##"][root.accidental + 2];
    const symbol = `${root.letter}${acc}${definition.name}${useBass ? `/${useBass.letter}${["bb", "b", "", "#", "##"][useBass.accidental + 2]}` : ""}`;
    return { chord, definition, symbol };
  }
  return null;
}
