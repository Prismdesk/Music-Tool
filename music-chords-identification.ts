import type { Note } from "./music-notes";
import { formatNote, getPitchClass, mod12 } from "./music-notes";
import { spellChordRoot } from "./music-notes-spelling";
import { createChord } from "./music-chords-factory";
import { chordRegistry } from "./music-chords-registry";
import type { ChordDefinition, ChordIdentificationCandidate, ChordIdentificationResult } from "./music-chords-types";

function uniquePitchClasses(notes: Note[]): number[] {
  return [...new Set(notes.map(getPitchClass))].sort((a, b) => a - b);
}

function offsets(rootPitch: number, definition: ChordDefinition): Set<number> {
  return new Set(definition.intervals.map((i) => mod12(rootPitch + i.semitones)));
}

function isMinorThird(definition: ChordDefinition): boolean {
  return definition.intervals.some((i) => i.degree === 3 && i.semitones === 3);
}

/** Prefer the spelling the player actually gave us for the root; otherwise use a conventional chord-root spelling. */
function spellRoot(pitch: number, notes: Note[], definition: ChordDefinition): Note {
  const given = notes.find((n) => getPitchClass(n) === pitch);
  if (given) return { letter: given.letter, accidental: given.accidental };
  return spellChordRoot(pitch, isMinorThird(definition));
}

function score(exact: boolean, missing: number, rootless: boolean, rootIsBass: boolean, definition: ChordDefinition): number {
  const bassBonus = rootIsBass ? 0.04 : 0;
  if (exact) return Math.min(0.99, 0.85 + definition.priority / 1000 + bassBonus);
  const completeness = 1 - missing / Math.max(definition.intervals.length, 1);
  return Math.min(0.9, Math.max(0.25, 0.6 * completeness + (rootless ? 0 : 0.15) + definition.priority / 2000 + bassBonus));
}

function collect(notes: Note[], referenceBass: Note | undefined, slashBass: Note | undefined, penalty: number): ChordIdentificationCandidate[] {
  const input = uniquePitchClasses(notes);
  const refPc = referenceBass ? getPitchClass(referenceBass) : undefined;
  const out: ChordIdentificationCandidate[] = [];
  for (let rootPitch = 0; rootPitch < 12; rootPitch += 1) {
    for (const definition of chordRegistry.all()) {
      const expected = offsets(rootPitch, definition);
      const missingDegrees = definition.intervals.filter((i) => !input.includes(mod12(rootPitch + i.semitones))).map((i) => i.degree);
      const extraPitchClasses = input.filter((p) => !expected.has(p));
      if (extraPitchClasses.length > 0) continue;
      if (missingDegrees.length > Math.max(3, Math.floor(definition.intervals.length / 2))) continue;
      const exact = missingDegrees.length === 0;
      const rootless = !input.includes(rootPitch);
      const root = spellRoot(rootPitch, notes, definition);
      const bass = slashBass && getPitchClass(slashBass) !== rootPitch ? { letter: slashBass.letter, accidental: slashBass.accidental } : undefined;
      const confidence = Math.max(0.2, score(exact, missingDegrees.length, rootless, refPc === rootPitch, definition) - penalty);
      out.push({
        chord: createChord(root, definition, bass),
        definition,
        confidence,
        exact,
        incomplete: !exact,
        rootless,
        missingDegrees,
        extraPitchClasses,
        reason: exact ? "All chord tones match the definition." : rootless ? "Possible rootless/incomplete voicing." : "Selected notes form a subset of the chord definition."
      });
    }
  }
  return out;
}

/**
 * Identify a chord from notes. The `bass` (or, if omitted, the first note given) is treated as the lowest note:
 * it breaks ties (Am7 vs C6) and becomes the slash bass when it isn't the root.
 */
export function identifyChord(notes: Note[], bass?: Note): ChordIdentificationResult {
  if (notes.length === 0) return { inputNotes: [], likely: null, alternatives: [] };
  const referenceBass = bass ?? notes[0];
  let candidates = collect(notes, referenceBass, bass, 0);

  // A bass that isn't among the notes: C E G over Bb reads as C/Bb, but C7/Bb is also a fair reading.
  if (bass && !notes.some((n) => getPitchClass(n) === getPitchClass(bass))) {
    candidates = candidates.concat(collect([...notes, bass], bass, bass, 0.05));
  }

  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = `${formatNote(c.chord.root)}|${c.definition?.id}|${c.chord.bass ? formatNote(c.chord.bass) : ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => b.confidence - a.confidence || Number(b.exact) - Number(a.exact) || (b.definition?.priority ?? 0) - (a.definition?.priority ?? 0));
  
  return { inputNotes: notes, likely: unique[0] ?? null, alternatives: unique.slice(1, 6) };
}
