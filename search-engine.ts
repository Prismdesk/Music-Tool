import { parseChordSymbol } from "./music-chords";
import { getPitchClass } from "./music-notes";
import type { Setlist } from "./setlists";
import type { Song } from "./songs";
import type { SavedShape } from "./storage-models";

export interface SearchData { songs: Song[]; setlists: Setlist[]; savedChords: string[]; savedShapes?: SavedShape[] }

export interface ChordHit { symbol: string }
export interface SongHit { song: Song; score: number; /** chords from the query that this song uses */ chords: string[]; /** where the text matched, e.g. "title", "lyrics" */ where: string[] }
export interface SetlistHit { setlist: Setlist; score: number; where: string[] }
export interface ShapeHit { shape: SavedShape; score: number }
export interface SearchResults {
  query: string;
  /** Chord names the query was understood as, e.g. "CM7" → Cmaj7. */
  chords: ChordHit[];
  songs: SongHit[];
  setlists: SetlistHit[];
  savedChords: string[];
  shapes: ShapeHit[];
}

const EMPTY = (query: string): SearchResults => ({ query, chords: [], songs: [], setlists: [], savedChords: [], shapes: [] });

/** Lower-case and strip accents so "Señor" is found by "senor". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Same chord, whatever it is called: CM7, Cmaj7 and Cmaj7/E all give the same key; C# and Db match. */
export function chordKey(symbol: string): string | null {
  const parsed = parseChordSymbol(symbol);
  return parsed ? `${getPitchClass(parsed.chord.root)}:${parsed.definition.id}` : null;
}

function wordPrefix(hay: string, token: string): boolean {
  let from = 0;
  for (;;) {
    const i = hay.indexOf(token, from);
    if (i < 0) return false;
    if (i === 0 || !/[a-z0-9]/.test(hay[i - 1])) return true;
    from = i + 1;
  }
}

/** Short tokens only match the start of a word, so "a" doesn't match every song. */
function tokenMatches(hay: string, token: string): boolean {
  return token.length <= 2 ? wordPrefix(hay, token) : hay.includes(token);
}

interface Field { name: string; text: string; weight: number }

function scoreFields(fields: Field[], tokens: string[]): { score: number; where: string[] } | null {
  let score = 0;
  const where = new Set<string>();
  for (const token of tokens) {
    let best = 0;
    let bestField = "";
    for (const f of fields) {
      if (!f.text || !tokenMatches(f.text, token)) continue;
      let s = f.weight;
      if (f.text === token) s *= 1.6;
      else if (f.text.startsWith(token)) s *= 1.35;
      else if (wordPrefix(f.text, token)) s *= 1.15;
      if (s > best) { best = s; bestField = f.name; }
    }
    if (!best) return null; // every word must match somewhere
    score += best;
    where.add(bestField);
  }
  return { score, where: [...where] };
}

function songFields(song: Song): Field[] {
  const lyrics = song.sections.flatMap((s) => s.blocks).filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join(" ");
  return [
    { name: "title", text: normalize(song.title), weight: 100 },
    { name: "artist", text: normalize(song.artist ?? ""), weight: 45 },
    { name: "tags", text: normalize(song.tags.join(" ")), weight: 40 },
    { name: "sections", text: normalize(song.sections.map((s) => s.name).join(" ")), weight: 15 },
    { name: "lyrics", text: normalize(lyrics), weight: 25 },
    { name: "notes", text: normalize(song.notes ?? ""), weight: 10 }
  ];
}

function songChordKeys(song: Song): Map<string, string> {
  const keys = new Map<string, string>();
  for (const sec of song.sections) for (const b of sec.blocks) {
    if (b.type !== "chord") continue;
    const key = chordKey(b.symbol);
    if (key && !keys.has(key)) keys.set(key, b.symbol);
  }
  return keys;
}

const recency = (song: { updatedAt: string }) => (Date.parse(song.updatedAt) || 0) / 1e15;

/**
 * Search songs, setlists and saved chords.
 *  - Words: every word must appear (title, artist, tags, lyrics…), best matches first.
 *  - Chords: "Am7", or "C G Am F" finds songs that use all of those chords, under any spelling.
 */
export function search(rawQuery: string, data: SearchData, limit = 30): SearchResults {
  const query = rawQuery.trim();
  if (!query) return EMPTY(rawQuery);
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const rawWords = query.split(/\s+/).filter(Boolean);
  const parsedWords = rawWords.map((w) => parseChordSymbol(w));
  const allChords = parsedWords.every((p) => p !== null);
  const queryKeys = allChords ? parsedWords.map((p) => `${getPitchClass(p!.chord.root)}:${p!.definition.id}`) : [];
  const uniqueKeys = [...new Set(queryKeys)];

  const results: SearchResults = EMPTY(rawQuery);
  if (allChords && rawWords.length <= 6) {
    const seen = new Set<string>();
    for (const p of parsedWords) if (!seen.has(p!.symbol)) { seen.add(p!.symbol); results.chords.push({ symbol: p!.symbol }); }
  }

  // Songs
  const songHits = new Map<string, SongHit>();
  const addSong = (song: Song, score: number, chords: string[], where: string[]) => {
    const prev = songHits.get(song.id);
    const total = score + (song.favorite ? 3 : 0) + recency(song);
    if (!prev) songHits.set(song.id, { song, score: total, chords, where });
    else songHits.set(song.id, { song, score: Math.max(prev.score, total), chords: prev.chords.length ? prev.chords : chords, where: [...new Set([...prev.where, ...where])] });
  };
  for (const song of data.songs) {
    if (allChords) {
      const have = songChordKeys(song);
      if (uniqueKeys.every((k) => have.has(k))) addSong(song, 50 + uniqueKeys.length * 4, uniqueKeys.map((k) => have.get(k)!), ["chords"]);
    }
    // Plain words too, unless this is a multi-chord query ("C G Am F" is about chords, not the letters).
    if (!allChords || rawWords.length === 1) {
      const hit = scoreFields(songFields(song), words);
      if (hit) addSong(song, hit.score, [], hit.where);
    }
  }
  results.songs = [...songHits.values()].sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title)).slice(0, limit);

  // Setlists: name, place, notes, or a song inside
  const titleById = new Map(data.songs.map((s) => [s.id, normalize(s.title)]));
  for (const setlist of data.setlists) {
    const inside = setlist.entries.map((e) => titleById.get(e.songId) ?? "").join(" ");
    const fields: Field[] = [
      { name: "name", text: normalize(setlist.name), weight: 100 },
      { name: "location", text: normalize(setlist.location ?? ""), weight: 40 },
      { name: "date", text: normalize(setlist.date ?? ""), weight: 30 },
      { name: "songs", text: inside, weight: 30 },
      { name: "notes", text: normalize(setlist.notes ?? ""), weight: 10 }
    ];
    const hit = scoreFields(fields, words);
    if (hit) results.setlists.push({ setlist, score: hit.score + (setlist.favorite ? 3 : 0) + recency(setlist), where: hit.where });
  }
  results.setlists.sort((a, b) => b.score - a.score).splice(limit);

  // Saved chords
  const wanted = new Set(uniqueKeys);
  results.savedChords = data.savedChords.filter((symbol) => {
    const key = chordKey(symbol);
    if (allChords && key && wanted.has(key)) return true;
    return words.length === 1 && normalize(symbol).includes(words[0]);
  });

  // Saved fretboard shapes: by name, by instrument word, or by the chord they are filed under
  for (const shape of data.savedShapes ?? []) {
    const key = shape.symbol ? chordKey(shape.symbol) : null;
    if (allChords && key && wanted.has(key)) { results.shapes.push({ shape, score: 60 }); continue; }
    // A chord query like "C" should only bring shapes filed under that chord, not every chord that starts with C.
    const fields: Field[] = [{ name: "name", text: normalize(shape.name), weight: 100 }];
    if (!allChords) fields.push({ name: "chord", text: normalize(shape.symbol ?? ""), weight: 60 }, { name: "instrument", text: normalize(shape.instrumentId), weight: 20 });
    const hit = scoreFields(fields, words);
    if (hit) results.shapes.push({ shape, score: hit.score });
  }
  results.shapes.sort((a, b) => b.score - a.score || a.shape.name.localeCompare(b.shape.name)).splice(limit);
  return results;
}

export const totalResults = (r: SearchResults) => r.chords.length + r.songs.length + r.setlists.length + r.savedChords.length + r.shapes.length;
