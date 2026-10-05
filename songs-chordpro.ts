import { parseChordSymbol } from "./music-chords";
import { formatNote } from "./music-notes";
import { chordsOverLyricsToInline } from "./songs-sheet-convert";
import type { Song, SongBlock, SongKey, SongSection } from "./songs-types";

export interface SheetMeta { title?: string; artist?: string; key?: SongKey; capo?: number; bpm?: number }
export interface ParsedSheet {
  meta: SheetMeta;
  sections: SongSection[];
  chordCount: number;
  /** Chord-looking symbols the app can't build shapes for yet. */
  unrecognised: string[];
}
export interface ParseOptions {
  /** Convert "chords above lyrics" first (default true). */
  chordsOverLyrics?: boolean;
  /** Sections whose ids should be kept (matched by name, then position). */
  reuse?: SongSection[];
  newId?: () => string;
}

const SECTION_WORDS = "intro|verse|chorus|pre-?chorus|bridge|outro|tag|instrumental|solo|interlude|refrain|ending|turnaround|coda|hook|break|vamp";
const WORD_HEADER = new RegExp(`^(?:${SECTION_WORDS})(?:\\s*\\d+)?\\s*:?$`, "i");
// Looks like a chord symbol: a note name followed only by chord-quality words and symbols ("Chorus" and "Bridge" must not match).
const CHORD_LIKE = /^[A-G][#b♯♭]?(?:maj|min|dim|aug|sus|add|m|M|[0-9]|[#b♯♭+\-°ø()])*(?:\/[A-G][#b♯♭]?)?$/;
const DIRECTIVE = /^\s*\{\s*([A-Za-z_]+)\s*:?\s*(.*?)\s*\}\s*$/;

const looksLikeChord = (s: string) => CHORD_LIKE.test(s.trim());

function titleCase(s: string): string { return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()); }

function parseKey(value: string): SongKey | undefined {
  const parsed = parseChordSymbol(value.trim());
  if (!parsed) return undefined;
  const minor = parsed.definition.id === "min";
  const major = parsed.definition.id === "maj";
  if (!minor && !major) return undefined;
  return { root: { letter: parsed.chord.root.letter, accidental: parsed.chord.root.accidental }, mode: minor ? "minor" : "major" };
}

function headerName(line: string): string | null {
  const trimmed = line.trim();
  const bracket = /^\[([^\]]+)\]$/.exec(trimmed);
  if (bracket) return looksLikeChord(bracket[1]) ? null : bracket[1].trim();
  if (WORD_HEADER.test(trimmed)) return trimmed.replace(/:$/, "").trim().replace(/^\w/, (c) => c.toUpperCase());
  return null;
}

function lineToBlocks(line: string, nextId: () => string, onChord: (symbol: string) => void): SongBlock[] {
  const blocks: SongBlock[] = [];
  const re = /\[([^\]\n]*)\]/g;
  let last = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const prev = blocks[blocks.length - 1];
    if (prev && prev.type === "text") prev.text += text;
    else blocks.push({ type: "text", id: nextId(), text });
  };
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (!looksLikeChord(m[1])) continue; // leave things like [x2] as plain text
    pushText(line.slice(last, m.index));
    const symbol = m[1].trim();
    blocks.push({ type: "chord", id: nextId(), symbol });
    onChord(symbol);
    last = m.index + m[0].length;
  }
  pushText(line.slice(last));
  return blocks;
}

/** Read ChordPro-style text (or a pasted chord sheet) into sections of lyric and chord blocks. */
export function parseChordSheet(input: string, options: ParseOptions = {}): ParsedSheet {
  const { chordsOverLyrics = true, reuse = [], newId = () => crypto.randomUUID() } = options;
  const text = (chordsOverLyrics ? chordsOverLyricsToInline(input) : input.replace(/\r\n?/g, "\n"));
  const meta: SheetMeta = {};
  const raw: { name: string; lines: string[] }[] = [];
  let current: { name: string; lines: string[] } | null = null;
  const open = (name: string) => { current = { name, lines: [] }; raw.push(current); };

  for (const line of text.split("\n")) {
    const directive = DIRECTIVE.exec(line);
    if (directive) {
      const name = directive[1].toLowerCase();
      const value = directive[2];
      if (name === "title" || name === "t") meta.title = value || meta.title;
      else if (name === "artist" || name === "subtitle" || name === "st") meta.artist = value || meta.artist;
      else if (name === "key") meta.key = parseKey(value) ?? meta.key;
      else if (name === "capo" && /^\d+$/.test(value)) meta.capo = Number(value);
      else if (name === "tempo" && /^\d+$/.test(value)) meta.bpm = Number(value);
      else if (["section", "c", "comment", "ci", "comment_italic"].includes(name) && value) open(value);
      else if (name.startsWith("start_of_") || name.startsWith("so")) {
        const kind = name.startsWith("start_of_") ? name.slice(9) : ({ sov: "verse", soc: "chorus", sob: "bridge" } as Record<string, string>)[name];
        if (kind) open(value || titleCase(kind));
      }
      continue;
    }
    const header = headerName(line);
    if (header) { open(header); continue; }
    if (!current) { if (line.trim() === "") continue; open("Verse"); }
    current!.lines.push(line);
  }

  let chordCount = 0;
  const unrecognised: string[] = [];
  const onChord = (symbol: string) => {
    chordCount += 1;
    if (!parseChordSymbol(symbol) && !unrecognised.includes(symbol)) unrecognised.push(symbol);
  };

  const used = new Set<string>();
  const sections: SongSection[] = raw.map((entry, index): SongSection => {
    const lines = [...entry.lines];
    while (lines.length && lines[0].trim() === "") lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    const match = reuse.find((s) => !used.has(s.id) && s.name.toLowerCase() === entry.name.toLowerCase()) ?? (reuse[index] && !used.has(reuse[index].id) ? reuse[index] : undefined);
    const id = match?.id ?? newId();
    used.add(id);
    let n = 0;
    const nextId = () => `${id}:${n++}`;
    const blocks: SongBlock[] = [];
    lines.forEach((line, i) => {
      for (const b of lineToBlocks(line.replace(/\s+$/, ""), nextId, onChord)) {
        const prev = blocks[blocks.length - 1];
        if (b.type === "text" && prev?.type === "text") prev.text += b.text; else blocks.push(b);
      }
      if (i < lines.length - 1) {
        const prev = blocks[blocks.length - 1];
        if (prev?.type === "text") prev.text += "\n"; else blocks.push({ type: "text", id: nextId(), text: "\n" });
      }
    });
    return { id, name: entry.name, blocks, repeatCount: match?.repeatCount };
  });

  return { meta, sections, chordCount, unrecognised };
}

const headerFor = (name: string) => (looksLikeChord(name) || /[\]\[{}]/.test(name) ? `{section: ${name}}` : `[${name}]`);

/** The inverse of parseChordSheet for sections: "[Verse]\n[G]Amazing [C]grace". */
export function serializeSections(sections: SongSection[]): string {
  return sections.map((section) => {
    const body = section.blocks.map((b) => (b.type === "chord" ? `[${b.symbol}]` : b.text)).join("");
    return `${headerFor(section.name)}\n${body}`.replace(/\n+$/, "");
  }).join("\n\n");
}

/** A complete ChordPro file for sharing or backup. */
export function songToChordPro(song: Song): string {
  const head: string[] = [`{title: ${song.title}}`];
  if (song.artist) head.push(`{artist: ${song.artist}}`);
  if (song.originalKey) head.push(`{key: ${formatNote({ ...song.originalKey.root, octave: undefined })}${song.originalKey.mode === "minor" ? "m" : ""}}`);
  if (song.capo) head.push(`{capo: ${song.capo}}`);
  if (song.tempo?.bpm) head.push(`{tempo: ${song.tempo.bpm}}`);
  return `${head.join("\n")}\n\n${serializeSections(song.sections)}\n`;
}

