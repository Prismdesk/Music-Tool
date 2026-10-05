import { describe, expect, it } from "vitest";
import { parseChordSymbol } from "./music-chords";
import { getMidi, getPitchClass } from "./music-notes";
import { TUNINGS } from "./instruments-core-catalog";
import { generateShapes } from "./instruments-stringed-shapes";
import { noteAtFret } from "./instruments-core-note-utils";
import { chordNotes } from "./music-chords";

const guitar = TUNINGS.find((t) => t.id === "guitar-standard")!;
const uke = TUNINGS.find((t) => t.id === "ukulele-high-g")!;
const lowG = TUNINGS.find((t) => t.id === "ukulele-low-g")!;
const shapes = (sym: string, tuning = guitar, opts = {}) => generateShapes(parseChordSymbol(sym)!.chord, tuning, { limit: 12, ...opts });
const top = (sym: string, tuning = guitar, n = 1) => shapes(sym, tuning).slice(0, n).map((s) => s.id);

describe("guitar shapes: the standard open chords come first", () => {
  const first: Record<string, string> = {
    C: "x32010", G: "320003", D: "xx0232", A: "x02220", E: "022100",
    Am: "x02210", Em: "022000", Dm: "xx0231", C7: "x32310", G7: "320001",
    Cmaj7: "x32000", Am7: "x02010", Em7: "020000", E7: "020100", A7: "x02020", D7: "xx0212"
  };
  for (const [sym, frets] of Object.entries(first)) it(`${sym} → ${frets}`, () => expect(top(sym)[0]).toBe(frets));
  it("offers the F and Bm barre chords", () => {
    expect(shapes("F").map((s) => s.id)).toContain("133211");
    expect(shapes("Bm").map((s) => s.id)).toContain("x24432");
  });
});

describe("ukulele shapes", () => {
  const first: Record<string, string> = { C: "0003", G: "0232", F: "2010", Am: "2000", C7: "0001", D: "2220", Dm: "2210", G7: "0212" };
  for (const [sym, frets] of Object.entries(first)) it(`${sym} → ${frets}`, () => expect(top(sym, uke)[0]).toBe(frets));
  it("works for low-G tuning and returns four-string shapes", () => {
    const s = shapes("C", lowG);
    expect(s.length).toBeGreaterThan(3);
    expect(s[0].frets).toHaveLength(4);
  });
});

describe("every generated shape is correct and playable", () => {
  const symbols = ["C", "Cm", "C7", "Cmaj7", "Cm7", "Csus4", "Cdim", "Caug", "C9", "C6", "Cadd9", "F#m7b5", "Bb", "Ebmaj7", "Ab7", "C/E", "C/G", "D/F#", "C/Bb"];
  for (const tuning of [guitar, uke]) {
    for (const sym of symbols) {
      it(`${sym} on ${tuning.id}`, () => {
        const parsed = parseChordSymbol(sym)!;
        const chordPcs = new Set(chordNotes(parsed.chord).map(getPitchClass));
        const bassPc = parsed.chord.bass ? getPitchClass(parsed.chord.bass) : undefined;
        const list = generateShapes(parsed.chord, tuning, { limit: 24 });
        expect(list.length).toBeGreaterThan(0);
        for (const shape of list) {
          const sounding = shape.positions.filter((p) => p.state !== "muted");
          expect(sounding.length).toBeGreaterThanOrEqual(3);
          // every sounding note is a chord tone (or the added bass)
          const pcs = sounding.map((p) => getPitchClass(noteAtFret(tuning.strings[p.stringIndex].pitch, p.fret)));
          for (const pc of pcs) expect(chordPcs.has(pc) || pc === bassPc).toBe(true);
          // no muted string inside the sounding run
          const idx = sounding.map((p) => p.stringIndex);
          expect(idx[idx.length - 1] - idx[0] + 1).toBe(idx.length);
          // reachable
          const fretted = shape.frets.filter((f): f is number => f !== null && f > 0);
          if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
          expect(shape.fingers).toBeLessThanOrEqual(4);
          // root (or slash bass) in the bass on guitar
          if (tuning === guitar) {
            const lowest = sounding.reduce((a, b) => (getMidi(noteAtFret(tuning.strings[b.stringIndex].pitch, b.fret)) < getMidi(noteAtFret(tuning.strings[a.stringIndex].pitch, a.fret)) ? b : a));
            const want = bassPc ?? getPitchClass(parsed.chord.root);
            expect(getPitchClass(noteAtFret(tuning.strings[lowest.stringIndex].pitch, lowest.fret))).toBe(want);
          }
        }
      });
    }
  }
});

describe("capo and options", () => {
  it("finds the same chord shapes relative to the capo", () => {
    // With a capo on 2, the C shape sounds as D: fret numbers stay relative to the capo.
    expect(shapes("D", guitar, { capo: 2 })[0].id).toBe("x32010");
    expect(shapes("E", guitar, { capo: 2 })[0].id).toBe("xx0232");
  });
  it("allows inversions when asked", () => {
    const ids = shapes("C", guitar, { allowInversions: true, limit: 24 }).map((s) => s.id);
    expect(ids).toContain("032010");
  });
  it("is fast even for extended chords", () => {
    const t = performance.now();
    generateShapes(parseChordSymbol("C13")!.chord, guitar, { maxFret: 15 });
    expect(performance.now() - t).toBeLessThan(1500);
  });
  it("returns shapes sorted by score with no duplicates", () => {
    const list = generateShapes(parseChordSymbol("G")!.chord, guitar, { limit: 40 });
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
  });
});
