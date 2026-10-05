import { describe, expect, it } from "vitest";
import { chordKey, normalize, search, totalResults } from "./search-engine";
import type { Song } from "./songs";
import type { Setlist } from "./setlists";

let n = 0;
const song = (title: string, chords: string[], extra: Partial<Song> & { lyrics?: string } = {}): Song => {
  const { lyrics = "", ...rest } = extra;
  return {
    id: `s${n++}`, title, transposition: 0, tags: [], favorite: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    sections: [{ id: "v", name: "Verse", blocks: [...chords.map((c, i) => ({ type: "chord" as const, id: `c${i}`, symbol: c })), { type: "text" as const, id: "t", text: lyrics }] }],
    ...rest
  };
};
const setlist = (name: string, songs: Song[], extra: Partial<Setlist> = {}): Setlist => ({
  id: `l${n++}`, name, favorite: false, createdAt: "", updatedAt: "2026-01-01T00:00:00Z", entries: songs.map((s, i) => ({ id: `e${i}`, songId: s.id, order: i })), ...extra
});

const grace = song("Amazing Grace", ["G", "C", "D", "Em"], { artist: "John Newton", tags: ["hymn"], lyrics: "Amazing grace how sweet the sound that saved a wretch like me" });
const reasons = song("10,000 Reasons", ["G", "D", "Em", "C"], { artist: "Matt Redman", tags: ["worship"], lyrics: "Bless the Lord O my soul" });
const blues = song("Blue Sky", ["Am7", "Dm7", "G7", "Cmaj7"], { lyrics: "Under a blue sky" });
const flats = song("Flat Song", ["Db", "Bbm", "Gb"], { lyrics: "nothing" });
const senor = song("Señor Mío", ["A"], { lyrics: "hola" });
const data = (extra = {}) => ({ songs: [grace, reasons, blues, flats, senor], setlists: [], savedChords: [], ...extra });

describe("normalize and chordKey", () => {
  it("strips accents and case", () => expect(normalize("Señor ÉCOLE")).toBe("senor ecole"));
  it("gives one key per chord however it is written", () => {
    expect(chordKey("CM7")).toBe(chordKey("Cmaj7"));
    expect(chordKey("Cmaj7/E")).toBe(chordKey("Cmaj7"));
    expect(chordKey("C#")).toBe(chordKey("Db"));
    expect(chordKey("Cm")).not.toBe(chordKey("C"));
    expect(chordKey("Hello")).toBeNull();
  });
});

describe("word search", () => {
  it("finds by title, artist, tag and lyrics", () => {
    expect(search("amazing", data()).songs.map((h) => h.song.title)).toEqual(["Amazing Grace"]);
    expect(search("newton", data()).songs[0].where).toContain("artist");
    expect(search("worship", data()).songs[0].song.title).toBe("10,000 Reasons");
    expect(search("wretch", data()).songs[0].where).toContain("lyrics");
  });
  it("needs every word, in any order", () => {
    expect(search("grace amazing", data()).songs).toHaveLength(1);
    expect(search("amazing blue", data()).songs).toHaveLength(0);
  });
  it("ignores case and accents", () => {
    expect(search("SENOR", data()).songs[0].song.title).toBe("Señor Mío");
    expect(search("mio", data()).songs).toHaveLength(1);
  });
  it("ranks title matches above lyric matches", () => {
    const a = song("Sky High", ["C"], { lyrics: "nothing" });
    const b = song("Other", ["C"], { lyrics: "the sky is blue" });
    expect(search("sky", { songs: [b, a], setlists: [], savedChords: [] }).songs.map((h) => h.song.title)).toEqual(["Sky High", "Other"]);
  });
  it("short words only match the start of a word", () => {
    const r = search("mo", { songs: [song("Moon River", ["C"]), song("Salmon", ["C"])], setlists: [], savedChords: [] });
    expect(r.songs.map((h) => h.song.title)).toEqual(["Moon River"]);
  });
  it("returns nothing for an empty or blank query", () => {
    expect(totalResults(search("", data()))).toBe(0);
    expect(totalResults(search("   ", data()))).toBe(0);
  });
  it("breaks ties with favourites", () => {
    const a = song("Hymn One", ["C"], { tags: ["hymn"] });
    const b = song("Hymn Two", ["C"], { tags: ["hymn"], favorite: true });
    expect(search("hymn", { songs: [a, b], setlists: [], savedChords: [] }).songs[0].song.title).toBe("Hymn Two");
  });
});

describe("chord search", () => {
  it("understands a chord name and finds songs using it", () => {
    const r = search("Am7", data());
    expect(r.chords.map((c) => c.symbol)).toEqual(["Am7"]);
    expect(r.songs.map((h) => h.song.title)).toEqual(["Blue Sky"]);
  });
  it("matches other spellings of the same chord", () => {
    expect(search("CM7", data()).songs.map((h) => h.song.title)).toEqual(["Blue Sky"]);
    expect(search("C#", data()).songs.map((h) => h.song.title)).toEqual(["Flat Song"]);
    expect(search("A#m", data()).songs.map((h) => h.song.title)).toEqual(["Flat Song"]);
  });
  it("finds songs that use all the chords listed", () => {
    expect(search("C G Em", data()).songs.map((h) => h.song.title).sort()).toEqual(["10,000 Reasons", "Amazing Grace"]);
    expect(search("G D Em C", data()).songs).toHaveLength(2);
    expect(search("G D Em C Am", data()).songs).toHaveLength(0);
  });
  it("does not treat a multi-chord query as letters", () => {
    expect(search("C G Em", { songs: [song("C G Em tribute", ["Fm"])], setlists: [], savedChords: [] }).songs).toHaveLength(0);
  });
  it("still finds a title for a one-letter query that is also a chord", () => {
    const d = { songs: [song("A Hard Day", ["F"]), song("Zzz", ["A"])], setlists: [], savedChords: [] };
    expect(search("A", d).songs.map((h) => h.song.title).sort()).toEqual(["A Hard Day", "Zzz"]);
  });
  it("reports which query chords a song uses", () => {
    expect(search("D Em", data()).songs[0].chords.sort()).toEqual(["D", "Em"]);
  });
  it("a query that mixes words and chord-looking words searches by word", () => {
    expect(search("grace newton", data()).songs.map((h) => h.song.title)).toEqual(["Amazing Grace"]);
    expect(search("grace Am7", data()).songs).toHaveLength(0);
  });
});

describe("setlists and saved chords", () => {
  const set = setlist("Sunday Worship", [grace, reasons], { location: "Main Hall", notes: "Soundcheck 8am" });
  it("finds by name, place, notes and the songs inside", () => {
    const d = data({ setlists: [set] });
    expect(search("sunday", d).setlists).toHaveLength(1);
    expect(search("hall", d).setlists).toHaveLength(1);
    expect(search("soundcheck", d).setlists).toHaveLength(1);
    expect(search("amazing", d).setlists).toHaveLength(1);
    expect(search("blue", d).setlists).toHaveLength(0);
  });
  it("finds saved chords by name or by equivalent spelling", () => {
    const d = data({ savedChords: ["Cmaj7", "Am", "F#m7"] });
    expect(search("CM7", d).savedChords).toEqual(["Cmaj7"]);
    expect(search("Gbm7", d).savedChords).toEqual(["F#m7"]);
    expect(search("am", d).savedChords).toEqual(["Am"]);
  });
  it("copes with entries whose song was deleted", () => {
    const orphan = setlist("Orphan", [], { entries: [{ id: "e", songId: "gone", order: 0 }] });
    expect(() => search("orphan", data({ setlists: [orphan] }))).not.toThrow();
  });
});
