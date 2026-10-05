import { describe, expect, it } from "vitest";
import { parseChordSymbol } from "./music-chords";
import { generateShapes, positionsFromFrets } from "./instruments-stringed-shapes";
import { TUNINGS } from "./instruments-core-catalog";
import { noteAtFret } from "./instruments-core-note-utils";
import { getPitchClass } from "./music-notes";
import { sameFrets, sanitizeName, shapesFor, suggestName, upsertShape, type ShapeDraft } from "./saved-shapes";
import { search } from "./search-engine";
import type { SavedShape } from "./storage-models";

const guitar = TUNINGS.find((t) => t.id === "guitar-standard")!;
const uke = TUNINGS.find((t) => t.id === "ukulele-high-g")!;

const shape = (over: Partial<SavedShape> = {}): SavedShape => ({
  id: "x1", instrumentId: "guitar", tuningId: "guitar-standard", capo: 0, symbol: "C", name: "My C", frets: [null, 3, 2, 0, 1, 0], createdAt: "2026-01-01T00:00:00Z", ...over
});
const draft = (over: Partial<ShapeDraft> = {}): ShapeDraft => ({ name: "My C", symbol: "C", instrumentId: "guitar", tuningId: "guitar-standard", capo: 0, frets: [null, 3, 2, 0, 1, 0], ...over });

describe("positionsFromFrets", () => {
  it("rebuilds positions and notes from a saved fret list", () => {
    const p = positionsFromFrets([null, 3, 2, 0, 1, 0], guitar)!;
    expect(p.map((x) => x.state)).toEqual(["muted", "fretted", "fretted", "open", "fretted", "open"]);
    expect(getPitchClass(p[1].note!)).toBe(0); // C on the A string
    expect(getPitchClass(p[4].note!)).toBe(0);
  });
  it("round-trips every generated shape", () => {
    for (const sym of ["C", "Am7", "F", "Bbmaj7"]) {
      for (const g of generateShapes(parseChordSymbol(sym)!.chord, guitar, { limit: 10 })) {
        const rebuilt = positionsFromFrets(g.frets, guitar)!;
        expect(rebuilt.map((x) => (x.state === "muted" ? null : x.fret))).toEqual(g.frets);
        expect(rebuilt.map((x) => (x.note ? getPitchClass(x.note) : -1))).toEqual(g.positions.map((x) => (x.note ? getPitchClass(x.note) : -1)));
      }
    }
  });
  it("applies the capo to the notes", () => {
    const p = positionsFromFrets([0, 0, 0, 0], uke, 2)!;
    expect(getPitchClass(p[0].note!)).toBe(getPitchClass(noteAtFret(uke.strings[0].pitch, 0, 2)));
  });
  it("rejects lists that don't fit the tuning or are nonsense", () => {
    expect(positionsFromFrets([0, 0, 0], guitar)).toBeNull();
    expect(positionsFromFrets([null, 3, 2, 0, 1, -1], guitar)).toBeNull();
    expect(positionsFromFrets([null, 3, 2, 0, 1, 99], guitar)).toBeNull();
    expect(positionsFromFrets([null, 3, 2, 0, 1, 0.5], guitar)).toBeNull();
    expect(positionsFromFrets([null, 3, 2, 0, 1, 0], uke)).toBeNull();
  });
});

describe("saved shape bookkeeping", () => {
  it("cleans names", () => {
    expect(sanitizeName("  my   favourite\n C  ", "x")).toBe("my favourite C");
    expect(sanitizeName("   ", "fallback")).toBe("fallback");
    expect(sanitizeName("a".repeat(100), "x")).toHaveLength(40);
  });
  it("files shapes under the chord whatever it is called, for the same tuning and capo only", () => {
    const all = [
      shape({ id: "a", symbol: "C#" }),
      shape({ id: "b", symbol: "Db", createdAt: "2026-02-01T00:00:00Z" }),
      shape({ id: "c", symbol: "C#", tuningId: "ukulele-high-g", instrumentId: "ukulele" }),
      shape({ id: "d", symbol: "C#", capo: 2 }),
      shape({ id: "e", symbol: "C#m" }),
      shape({ id: "f", symbol: undefined })
    ];
    expect(shapesFor(all, { symbol: "Db", tuningId: "guitar-standard", capo: 0 }).map((s) => s.id)).toEqual(["a", "b"]);
    expect(shapesFor(all, { symbol: "C#", tuningId: "guitar-standard", capo: 2 }).map((s) => s.id)).toEqual(["d"]);
    expect(shapesFor(all, { symbol: "nonsense", tuningId: "guitar-standard", capo: 0 })).toEqual([]);
  });
  it("adds a new shape", () => {
    const { shape: s, created } = upsertShape([], draft(), "new1", "2026-03-01T00:00:00Z");
    expect(created).toBe(true);
    expect(s).toMatchObject({ id: "new1", name: "My C", symbol: "C", frets: [null, 3, 2, 0, 1, 0], createdAt: "2026-03-01T00:00:00Z" });
  });
  it("renames instead of duplicating when the same fingering is saved again", () => {
    const { shape: s, created } = upsertShape([shape()], draft({ name: "Open C" }), "new2", "later");
    expect(created).toBe(false);
    expect(s).toMatchObject({ id: "x1", name: "Open C", createdAt: "2026-01-01T00:00:00Z" });
  });
  it("keeps different fingerings of the same chord apart", () => {
    const { created } = upsertShape([shape()], draft({ frets: [3, 3, 2, 0, 1, 0] }), "n", "t");
    expect(created).toBe(true);
  });
  it("does not copy the caller's array", () => {
    const d = draft();
    const { shape: s } = upsertShape([], d, "n", "t");
    d.frets[0] = 9;
    expect(s.frets[0]).toBeNull();
  });
  it("compares fret lists and suggests names", () => {
    expect(sameFrets([null, 1], [null, 1])).toBe(true);
    expect(sameFrets([null, 1], [0, 1])).toBe(false);
    expect(sameFrets([1], [1, 1])).toBe(false);
    expect(suggestName("Cmaj7", [shape(), shape({ id: "y" })])).toBe("Cmaj7 – shape 3");
  });
});

describe("searching your shapes", () => {
  const savedShapes = [
    shape({ id: "1", name: "Campfire C", symbol: "C" }),
    shape({ id: "2", name: "Jazzy voicing", symbol: "Cmaj7", frets: [null, 3, 5, 4, 5, null] }),
    shape({ id: "3", name: "Uke open", symbol: "C", instrumentId: "ukulele", tuningId: "ukulele-high-g", frets: [0, 0, 0, 3] })
  ];
  const d = { songs: [], setlists: [], savedChords: [], savedShapes };
  it("finds by name", () => expect(search("campfire", d).shapes.map((h) => h.shape.id)).toEqual(["1"]));
  it("finds by the chord they are filed under, under any spelling", () => {
    expect(search("CM7", d).shapes.map((h) => h.shape.id)).toEqual(["2"]);
    expect(search("C", d).shapes.map((h) => h.shape.id).sort()).toEqual(["1", "3"]);
  });
  it("finds by instrument word", () => expect(search("ukulele", d).shapes.map((h) => h.shape.id)).toEqual(["3"]));
  it("works when there are no shapes at all", () => expect(search("C", { songs: [], setlists: [], savedChords: [] }).shapes).toEqual([]));
});
