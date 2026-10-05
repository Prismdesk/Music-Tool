import { describe, expect, it } from "vitest";
import {
  calculateInterval, chordNotes, formatChordSymbol, formatNote, getPitchClass, identifyChord, parseChordSymbol,
  spellPitchClass, transposeChord, type Note
} from "./music";

const n = (s: string): Note => {
  const m = /^([A-G])(##|bb|#|b)?$/.exec(s)!;
  return { letter: m[1] as Note["letter"], accidental: (m[2] ? (m[2][0] === "#" ? 1 : -1) * m[2].length : 0) as Note["accidental"] };
};
const ids = (notes: string[], bass?: string) => {
  const r = identifyChord(notes.map(n), bass ? n(bass) : undefined);
  const name = (c: typeof r.likely) => (c ? formatChordSymbol(c.chord) : "none");
  return { primary: name(r.likely), alts: r.alternatives.map(name), result: r };
};

describe("spec: notes", () => {
  it("pitch classes and enharmonics", () => {
    expect(getPitchClass(n("C"))).toBe(0);
    expect(getPitchClass(n("C#"))).toBe(1);
    expect(getPitchClass(n("Db"))).toBe(1);
    expect(getPitchClass(n("B#"))).toBe(0);
    expect(getPitchClass(n("Cb"))).toBe(11);
  });
  it("spells naturals as naturals whatever the preference", () => {
    for (const pref of ["automatic", "sharps", "flats"] as const) {
      expect(formatNote(spellPitchClass(0, pref))).toBe("C");
      expect(formatNote(spellPitchClass(5, pref))).toBe("F");
      expect(formatNote(spellPitchClass(11, pref))).toBe("B");
    }
    expect(formatNote(spellPitchClass(1, "sharps"))).toBe("C#");
    expect(formatNote(spellPitchClass(10, "flats"))).toBe("Bb");
    expect(formatNote(spellPitchClass(3))).toBe("Eb");
  });
});

describe("spec: intervals", () => {
  it("names intervals by spelling", () => {
    expect(calculateInterval(n("C"), n("E"))).toMatchObject({ number: 3, quality: "major", semitones: 4 });
    expect(calculateInterval(n("C"), n("Eb"))).toMatchObject({ number: 3, quality: "minor", semitones: 3 });
    expect(calculateInterval(n("C"), n("F#"))).toMatchObject({ number: 4, quality: "augmented", semitones: 6 });
    expect(calculateInterval(n("C"), n("Gb"))).toMatchObject({ number: 5, quality: "diminished", semitones: 6 });
  });
});

describe("spec: chord identification", () => {
  it("identifies the spec chords", () => {
    expect(ids(["C", "E", "G"]).primary).toBe("C");
    expect(ids(["C", "Eb", "G"]).primary).toBe("Cm");
    expect(ids(["C", "E", "G", "Bb"]).primary).toBe("C7");
    expect(ids(["C", "E", "G", "B"]).primary).toBe("Cmaj7");
    expect(ids(["D", "F", "A"]).primary).toBe("Dm");
  });
  it("keeps flats as flats", () => {
    expect(ids(["Bb", "D", "F"]).primary).toBe("Bb");
    expect(ids(["Eb", "G", "Bb"]).primary).toBe("Eb");
    expect(ids(["F#", "A", "C#"]).primary).toBe("F#m");
    expect(ids(["C", "Eb", "G"]).alts.some((a) => a.startsWith("D#"))).toBe(false);
  });
  it("recognises inversions as the same chord", () => {
    expect(ids(["E", "G", "C"]).primary).toBe("C");
    expect(ids(["G", "C", "E"]).primary).toBe("C");
  });
  it("uses the lowest note to decide Am7 vs C6", () => {
    expect(ids(["A", "C", "E", "G"]).primary).toBe("Am7");
    expect(ids(["C", "E", "G", "A"]).primary).toBe("C6");
    expect(ids(["C", "E", "A", "G"], "A").primary).toBe("Am7");
  });
  it("handles slash chords", () => {
    expect(ids(["C", "E", "G"], "E").primary).toBe("C/E");
    expect(ids(["C", "E", "G"], "Bb").primary).toBe("C/Bb");
    expect(ids(["C", "E", "G"], "Bb").alts).toContain("C7/Bb");
    expect(ids(["C", "E", "G"], "C").primary).toBe("C");
  });
  it("reports incomplete and power chords", () => {
    expect(ids(["C", "G"]).primary).toBe("C5");
    const r = identifyChord([n("C"), n("Bb"), n("E")]);
    expect(r.likely?.incomplete).toBe(true);
    expect(formatChordSymbol(r.likely!.chord)).toBe("C7");
  });
  it("returns nothing for no notes", () => {
    expect(identifyChord([]).likely).toBeNull();
  });
});

describe("spec: transposition", () => {
  const t = (sym: string, by: number) => formatChordSymbol(transposeChord(parseChordSymbol(sym)!.chord, by));
  it("transposes chords", () => {
    expect(t("C", 2)).toBe("D");
    expect(t("C7", 2)).toBe("D7");
    expect(t("F#m", 2)).toBe("G#m");
    expect(t("Bb", 2)).toBe("C");
    expect(t("Eb", -2)).toBe("Db");
    expect(t("G", 1)).toBe("Ab");
    expect(t("Gm", 1)).toBe("G#m");
    expect(t("C/E", 2)).toBe("D/F#");
    expect(t("Bbmaj7/D", 1)).toBe("Bmaj7/Eb");
  });
  it("round-trips an octave", () => {
    for (const sym of ["C", "F#m7", "Bbmaj7", "Ab/C", "Dsus4"]) expect(t(sym, 12)).toBe(sym);
  });
});

describe("chord symbol parser", () => {
  it("parses common symbols", () => {
    const sym = (s: string) => parseChordSymbol(s)?.symbol;
    expect(sym("C")).toBe("C");
    expect(sym("Cm")).toBe("Cm");
    expect(sym("Cmin7")).toBe("Cm7");
    expect(sym("CM7")).toBe("Cmaj7");
    expect(sym("Bbmaj7")).toBe("Bbmaj7");
    expect(sym("F#m7b5")).toBe("F#m7b5");
    expect(sym("E♭")).toBe("Eb");
    expect(sym("D/F#")).toBe("D/F#");
    expect(sym("Gsus")).toBe("Gsus4");
    expect(sym("Am(add9)")).toBe("Am(add9)");
    expect(sym("Eb5")).toBe("Eb5");
  });
  it("builds the right notes", () => {
    const names = (s: string) => chordNotes(parseChordSymbol(s)!.chord).map(formatNote);
    expect(names("Bbmaj7")).toEqual(["Bb", "D", "F", "A"]);
    expect(names("F#m")).toEqual(["F#", "A", "C#"]);
  });
  it("rejects things that aren't chords", () => {
    expect(parseChordSymbol("")).toBeNull();
    expect(parseChordSymbol("Hello")).toBeNull();
    expect(parseChordSymbol("H7")).toBeNull();
    expect(parseChordSymbol("C/")).toBeNull();
    expect(parseChordSymbol("Cxyz")).toBeNull();
  });
});
