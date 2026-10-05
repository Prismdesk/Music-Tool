import { describe, expect, it } from "vitest";
import { addSong, createSetlist, duplicateEntry, duplicateSetlist, moveEntry, pruneMissingSongs, removeEntry, resolveEntry, sectionsFrom, sortedEntries, updateEntry } from "./setlists";
import { transposeSymbol, transposedKeyName, semitonesBetween } from "./music-chords";
import type { Song } from "./songs";

const song = (over: Partial<Song> = {}): Song => ({
  id: "s1", title: "Amazing Grace", artist: "Trad.", transposition: 0, tags: [], favorite: false, createdAt: "t", updatedAt: "t",
  originalKey: { root: { letter: "G", accidental: 0 }, mode: "major" }, capo: 0, tempo: { bpm: 90 }, notes: "Hold the last chord",
  sections: [
    { id: "v", name: "Verse", blocks: [{ type: "chord", id: "1", symbol: "G" }, { type: "text", id: "2", text: "Amazing grace" }, { type: "chord", id: "3", symbol: "Em7" }] },
    { id: "c", name: "Chorus", blocks: [{ type: "chord", id: "4", symbol: "C/E" }, { type: "chord", id: "5", symbol: "N.C." }] },
    { id: "b", name: "Bridge", blocks: [{ type: "chord", id: "6", symbol: "D" }] }
  ],
  ...over
});
const ids = (l: ReturnType<typeof createSetlist>) => sortedEntries(l).map((e) => e.songId);

describe("setlist operations", () => {
  it("adds songs in order and allows the same song twice", () => {
    let l = createSetlist("Sunday");
    l = addSong(l, "a"); l = addSong(l, "b"); l = addSong(l, "a");
    expect(ids(l)).toEqual(["a", "b", "a"]);
    expect(sortedEntries(l).map((e) => e.order)).toEqual([0, 1, 2]);
    expect(new Set(l.entries.map((e) => e.id)).size).toBe(3);
  });
  it("inserts at a position", () => {
    let l = addSong(addSong(createSetlist(), "a"), "c");
    l = addSong(l, "b", 1);
    expect(ids(l)).toEqual(["a", "b", "c"]);
  });
  it("moves entries and clamps at the ends", () => {
    let l = ["a", "b", "c", "d"].reduce((acc, s) => addSong(acc, s), createSetlist());
    const idOf = (song: string) => l.entries.find((e) => e.songId === song)!.id;
    l = moveEntry(l, idOf("d"), 0); expect(ids(l)).toEqual(["d", "a", "b", "c"]);
    l = moveEntry(l, idOf("d"), 99); expect(ids(l)).toEqual(["a", "b", "c", "d"]);
    l = moveEntry(l, idOf("a"), -5); expect(ids(l)).toEqual(["a", "b", "c", "d"]);
    expect(moveEntry(l, "nope", 1)).toBe(l);
  });
  it("removes, duplicates and edits one slot without touching others", () => {
    let l = addSong(addSong(createSetlist(), "a"), "a");
    const [first, second] = sortedEntries(l);
    l = updateEntry(l, first.id, { transpose: 2, capoOverride: 3 });
    expect(sortedEntries(l)[0]).toMatchObject({ transpose: 2, capoOverride: 3 });
    expect(sortedEntries(l)[1].transpose).toBeUndefined();
    l = duplicateEntry(l, first.id);
    expect(sortedEntries(l)).toHaveLength(3);
    expect(sortedEntries(l)[1]).toMatchObject({ songId: "a", transpose: 2 });
    expect(sortedEntries(l)[1].id).not.toBe(first.id);
    l = removeEntry(l, second.id);
    expect(sortedEntries(l)).toHaveLength(2);
    expect(sortedEntries(l).map((e) => e.order)).toEqual([0, 1]);
  });
  it("duplicates a setlist with fresh ids", () => {
    const l = addSong(addSong(createSetlist("Gig"), "a"), "b");
    const copy = duplicateSetlist(l);
    expect(copy.name).toBe("Gig (copy)");
    expect(copy.id).not.toBe(l.id);
    expect(ids(copy)).toEqual(["a", "b"]);
    expect(copy.entries.some((e) => l.entries.some((o) => o.id === e.id))).toBe(false);
  });
  it("prunes entries for deleted songs", () => {
    const l = ["a", "b", "c"].reduce((acc, s) => addSong(acc, s), createSetlist());
    expect(ids(pruneMissingSongs(l, new Set(["a", "c"])))).toEqual(["a", "c"]);
    expect(pruneMissingSongs(l, new Set(["a", "b", "c"]))).toBe(l);
  });
  it("does not mutate its input", () => {
    const l = addSong(createSetlist(), "a");
    const snapshot = JSON.stringify(l);
    addSong(l, "b"); moveEntry(l, l.entries[0].id, 0); removeEntry(l, l.entries[0].id);
    expect(JSON.stringify(l)).toBe(snapshot);
  });
});

describe("performance resolution", () => {
  it("applies transposition to chords but not lyrics, and leaves non-chords alone", () => {
    const item = resolveEntry({ id: "e", songId: "s1", order: 0, transpose: 2 }, song());
    const chords = item.sections.flatMap((s) => s.blocks).filter((b) => b.type === "chord").map((b) => (b as any).symbol);
    expect(chords).toEqual(["A", "F#m7", "D/F#", "N.C.", "E"]);
    expect(item.sections[0].blocks[1]).toMatchObject({ type: "text", text: "Amazing grace" });
    expect(item.keyName).toBe("A");
  });
  it("stacks the slot's transpose on the song's own transposition for the key", () => {
    const item = resolveEntry({ id: "e", songId: "s1", order: 0, transpose: 3 }, song({ transposition: 2 }));
    expect(item.keyName).toBe("C");
  });
  it("uses overrides for capo and tempo, falling back to the song", () => {
    expect(resolveEntry({ id: "e", songId: "s1", order: 0 }, song({ capo: 2 }))).toMatchObject({ capo: 2, bpm: 90 });
    expect(resolveEntry({ id: "e", songId: "s1", order: 0, capoOverride: 0, tempoOverride: 70 }, song({ capo: 2 }))).toMatchObject({ capo: 0, bpm: 70 });
  });
  it("starts at the chosen section and wraps the earlier ones after it", () => {
    expect(sectionsFrom(song(), "c").map((s) => s.name)).toEqual(["Chorus", "Bridge", "Verse"]);
    expect(sectionsFrom(song()).map((s) => s.name)).toEqual(["Verse", "Chorus", "Bridge"]);
    expect(sectionsFrom(song(), "gone").map((s) => s.name)).toEqual(["Verse", "Chorus", "Bridge"]);
  });
  it("copes with a deleted song and a song with no key", () => {
    expect(resolveEntry({ id: "e", songId: "x", order: 0, notes: "hi" }, undefined)).toMatchObject({ missing: true, title: "Song not found", sections: [], notes: "hi" });
    expect(resolveEntry({ id: "e", songId: "s1", order: 0 }, song({ originalKey: undefined })).keyName).toBeUndefined();
  });
});

describe("symbol helpers", () => {
  it("transposeSymbol", () => {
    expect(transposeSymbol("Bbmaj7", 2)).toBe("Cmaj7");
    expect(transposeSymbol("F#m/C#", -2)).toBe("Em/B");
    expect(transposeSymbol("C", 12)).toBe("C");
    expect(transposeSymbol("N.C.", 3)).toBe("N.C.");
  });
  it("transposedKeyName", () => {
    expect(transposedKeyName({ letter: "G", accidental: 0 }, "major", 2)).toBe("A");
    expect(transposedKeyName({ letter: "A", accidental: 0 }, "minor", 1)).toBe("Bbm");
    expect(transposedKeyName({ letter: "B", accidental: -1 }, "major", 2)).toBe("C");
    expect(transposedKeyName({ letter: "F", accidental: 1 }, "minor", 2)).toBe("G#m");
  });
  it("semitonesBetween picks the short way round", () => {
    expect(semitonesBetween({ letter: "C", accidental: 0 }, { letter: "D", accidental: 0 })).toBe(2);
    expect(semitonesBetween({ letter: "C", accidental: 0 }, { letter: "A", accidental: 0 })).toBe(-3);
  });
});
