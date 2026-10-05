import { describe, expect, it } from "vitest";
import { chordsOverLyricsToInline, isChordLine, parseChordSheet, serializeSections, songToChordPro, toLines, type Song, type SongBlock } from "./songs";

let n = 0;
const newId = () => `id${n++}`;
const parse = (t: string, o = {}) => { n = 0; return parseChordSheet(t, { newId, ...o }); };
const chordsOf = (blocks: SongBlock[]) => blocks.filter((b) => b.type === "chord").map((b) => (b as any).symbol);

describe("chord line detection", () => {
  it("recognises chord lines", () => {
    expect(isChordLine("G   D/F#  Em7   C")).toBe(true);
    expect(isChordLine("| Am | F | C | G |")).toBe(true);
    expect(isChordLine("(G) (C) x2")).toBe(true);
    expect(isChordLine("Bbmaj7   F#m7b5")).toBe(true);
  });
  it("rejects lyrics and blanks", () => {
    expect(isChordLine("Amazing grace how sweet")).toBe(false);
    expect(isChordLine("")).toBe(false);
    expect(isChordLine("I once was lost")).toBe(false);
    expect(isChordLine("x2")).toBe(false);
  });
});

describe("chords above lyrics → inline", () => {
  it("places chords at their columns", () => {
    const src = `G${" ".repeat(7)}C${" ".repeat(9)}G\nAmazing grace how sweet`;
    expect(chordsOverLyricsToInline(src)).toBe("[G]Amazing [C]grace how [G]sweet");
  });
  it("handles a chord line with no lyric and keeps normal lines", () => {
    expect(chordsOverLyricsToInline("Am  F  C\n\nhello")).toBe("[Am] [F] [C]\n\nhello");
  });
  it("pads when a chord sits past the end of the lyric", () => {
    expect(chordsOverLyricsToInline("C       G\nhi")).toBe("[C]hi      [G]");
  });
  it("leaves inline notation alone and doesn't pair a chord line with a header", () => {
    expect(chordsOverLyricsToInline("[G]Amazing [C]grace")).toBe("[G]Amazing [C]grace");
    expect(chordsOverLyricsToInline("G C\n[Chorus]")).toBe("[G] [C]\n[Chorus]");
  });
  it("converts several verses", () => {
    const src = "Verse 1\nC      F\nOne two three\nG\nFour\n\nChorus\nAm\nLa la";
    const out = chordsOverLyricsToInline(src);
    expect(out).toBe("Verse 1\n[C]One two[F] three\n[G]Four\n\nChorus\n[Am]La la");
  });
});

describe("parseChordSheet", () => {
  it("reads sections, inline chords and lyrics", () => {
    const r = parse("[Verse 1]\n[G]Amazing [C]grace\nhow [D]sweet\n\n[Chorus]\n[Em]Oh");
    expect(r.sections.map((s) => s.name)).toEqual(["Verse 1", "Chorus"]);
    expect(chordsOf(r.sections[0].blocks)).toEqual(["G", "C", "D"]);
    expect(r.sections[0].blocks.filter((b) => b.type === "text").map((b) => (b as any).text)).toEqual(["Amazing ", "grace\nhow ", "sweet"]);
    expect(r.chordCount).toBe(4);
    expect(r.unrecognised).toEqual([]);
  });
  it("understands ChordPro directives", () => {
    const r = parse("{title: Amazing Grace}\n{artist: John Newton}\n{key: Em}\n{capo: 2}\n{tempo: 84}\n{start_of_chorus}\n[Em]La\n{end_of_chorus}\n{sov: Intro}\n[C]x");
    expect(r.meta).toMatchObject({ title: "Amazing Grace", artist: "John Newton", capo: 2, bpm: 84 });
    expect(r.meta.key).toEqual({ root: { letter: "E", accidental: 0 }, mode: "minor" });
    expect(r.sections.map((s) => s.name)).toEqual(["Chorus", "Intro"]);
  });
  it("recognises plain-word headers like 'Verse 2:' and 'Chorus'", () => {
    const r = parse("Verse 2:\nG\nhello\nChorus\nC\nworld");
    expect(r.sections.map((s) => s.name)).toEqual(["Verse 2", "Chorus"]);
    expect(chordsOf(r.sections[1].blocks)).toEqual(["C"]);
  });
  it("puts lines before any header in a first section", () => {
    const r = parse("[G]Hello");
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].name).toBe("Verse");
  });
  it("treats non-chord brackets as text and flags unknown chords", () => {
    const r = parse("[Verse]\nSing [x2] [G]now [Cadd11]end");
    const text = r.sections[0].blocks.filter((b) => b.type === "text").map((b) => (b as any).text).join("");
    expect(text).toContain("[x2]");
    expect(r.unrecognised).toEqual(["Cadd11"]);
    expect(r.chordCount).toBe(2);
  });
  it("converts a pasted chord sheet end to end", () => {
    const r = parse("Verse 1\nG        C\nAmazing grace\nD\nhow sweet\n\nChorus\nEm\nOh");
    expect(r.sections).toHaveLength(2);
    expect(chordsOf(r.sections[0].blocks)).toEqual(["G", "C", "D"]);
  });
  it("reuses section ids by name, then by position", () => {
    const old = parse("[Verse]\na\n\n[Chorus]\nb").sections;
    const next = parseChordSheet("[Chorus]\nb2\n\n[Verse]\na2\n\n[Bridge]\nc", { reuse: old, newId: () => "fresh" });
    expect(next.sections.map((s) => s.id)).toEqual([old[1].id, old[0].id, "fresh"]);
    expect(next.sections[0].blocks[0].id).toBe(`${old[1].id}:0`);
  });
  it("copes with Windows line endings, blank input and odd whitespace", () => {
    expect(parse("[Verse]\r\n[G]hi\r\n").sections[0].blocks).toHaveLength(2);
    expect(parse("").sections).toEqual([]);
    expect(parse("   \n\n  ").sections).toEqual([]);
  });
});

describe("round trip", () => {
  const sample = "[Intro]\n[G] [C] [G]\n\n[Verse]\n[G]Amazing [C]grace, how [G]sweet the [D]sound\nThat [G]saved a [C]wretch like [G]me\n\n{section: A}\n[Em]Bridge line";
  it("serialize(parse(x)) is stable", () => {
    const once = serializeSections(parse(sample).sections);
    expect(once).toBe(sample);
    expect(serializeSections(parse(once).sections)).toBe(once);
  });
  it("exports a full ChordPro file that imports back to the same song", () => {
    const parsed = parse(sample);
    const song: Song = { id: "s", title: "Amazing Grace", artist: "Newton", originalKey: { root: { letter: "G", accidental: 0 }, mode: "major" }, capo: 2, tempo: { bpm: 84 }, transposition: 0, tags: [], favorite: false, createdAt: "", updatedAt: "", sections: parsed.sections };
    const file = songToChordPro(song);
    expect(file.startsWith("{title: Amazing Grace}\n{artist: Newton}\n{key: G}\n{capo: 2}\n{tempo: 84}")).toBe(true);
    const back = parse(file);
    expect(back.meta).toMatchObject({ title: "Amazing Grace", artist: "Newton", capo: 2, bpm: 84 });
    expect(serializeSections(back.sections)).toBe(sample);
  });
});

describe("toLines", () => {
  it("pairs each chord with the words that follow it", () => {
    const blocks = parse("[G]Amazing [C]grace\nhow [D]sweet").sections[0].blocks;
    expect(toLines(blocks)).toEqual([
      [{ chord: { id: expect.any(String), symbol: "G" }, text: "Amazing " }, { chord: { id: expect.any(String), symbol: "C" }, text: "grace" }],
      [{ text: "how " }, { chord: { id: expect.any(String), symbol: "D" }, text: "sweet" }]
    ]);
  });
  it("keeps blank lines between verses and drops trailing ones", () => {
    const lines = toLines([{ type: "text", id: "1", text: "one\n\ntwo\n\n" }]);
    expect(lines.map((l) => l.map((c) => c.text).join(""))).toEqual(["one", "", "two"]);
  });
  it("handles chords with no lyric and old block-by-block songs", () => {
    const lines = toLines([{ type: "chord", id: "1", symbol: "C" }, { type: "chord", id: "2", symbol: "G" }, { type: "text", id: "3", text: "la" }]);
    expect(lines).toHaveLength(1);
    expect(lines[0].map((c) => [c.chord?.symbol, c.text])).toEqual([["C", ""], ["G", "la"]]);
    expect(toLines([])).toEqual([]);
  });
});
