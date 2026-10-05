import { describe, expect, it } from "vitest";
import { calculateInterval, chordNotes, chordRegistry, createChord, formatNote, getPitchClass, identifyChord, spellPitchClass, transposeChord } from "./music";

const C = { letter: "C" as const, accidental: 0 as const };
const E = { letter: "E" as const, accidental: 0 as const };
const G = { letter: "G" as const, accidental: 0 as const };

function pcs(notes: ReturnType<typeof chordNotes>): number[] { return notes.map(getPitchClass).sort((a, b) => a - b); }

describe("notes", () => {
  it("calculates pitch classes", () => {
    expect(getPitchClass(C)).toBe(0);
    expect(getPitchClass({ letter: "C", accidental: 1 })).toBe(1);
    expect(getPitchClass({ letter: "B", accidental: 1 })).toBe(0);
  });

  it("supports enharmonic spellings", () => {
    expect(getPitchClass({ letter: "C", accidental: 1 })).toBe(getPitchClass({ letter: "D", accidental: -1 }));
    expect(formatNote({ letter: "F", accidental: 2 })).toBe("F##");
    expect(formatNote(spellPitchClass(1, "flats"))).toBe("Db");
  });
});

describe("intervals", () => {
  it("recognizes a major third", () => {
    expect(calculateInterval(C, E)).toEqual({ number: 3, quality: "major", semitones: 4 });
  });

  it("distinguishes augmented fourth spelling", () => {
    expect(calculateInterval(C, { letter: "F", accidental: 1 })).toEqual({ number: 4, quality: "augmented", semitones: 6 });
  });
});

describe("chords", () => {
  it("builds a C major chord", () => {
    const chord = createChord(C, chordRegistry.get("maj"));
    expect(pcs(chordNotes(chord))).toEqual([0, 4, 7]);
  });

  it("builds a theoretically spelled C7", () => {
    const chord = createChord(C, chordRegistry.get("7"));
    expect(chordNotes(chord).map(formatNote)).toEqual(["C", "E", "G", "Bb"]);
  });

  it("transposes a chord without changing its formula", () => {
    const chord = createChord(C, chordRegistry.get("maj"));
    const transposed = transposeChord(chord, 2);
    expect(formatNote(transposed.root)).toBe("D");
    expect(transposed.formula).toEqual(chord.formula);
  });
});

describe("identification", () => {
  it("identifies exact triads", () => {
    const result = identifyChord([C, E, G]);
    expect(result.likely?.definition?.id).toBe("maj");
    expect(formatNote(result.likely!.chord.root)).toBe("C");
    expect(result.likely!.confidence).toBeGreaterThan(0.9);
  });

  it("can recognize an incomplete chord", () => {
    const result = identifyChord([C, E]);
    expect(result.likely).not.toBeNull();
    expect(result.likely!.incomplete).toBe(true);
  });
});
