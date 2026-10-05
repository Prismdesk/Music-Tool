import { parseChordSymbol } from "./music-chords";

const IGNORABLE = /^(?:[|\-–—/\\.:]+|x\d+|\d+x|[()]+|\*+)$/i;

interface Token { text: string; column: number }

function tokens(line: string): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  for (let m = re.exec(line); m; m = re.exec(line)) out.push({ text: m[0], column: m.index });
  return out;
}

function stripParens(t: string): string { return t.replace(/^\(+|\)+$/g, ""); }

/** A line made only of chord names (and bar lines / repeat marks), e.g. "G   D/F#   Em7   C". */
export function isChordLine(line: string): boolean {
  const toks = tokens(line);
  if (!toks.length) return false;
  let chords = 0;
  for (const t of toks) {
    const text = stripParens(t.text);
    if (IGNORABLE.test(t.text) || text === "") continue;
    if (parseChordSymbol(text)) { chords += 1; continue; }
    return false;
  }
  return chords > 0;
}

const isBlank = (l: string | undefined) => l === undefined || l.trim() === "";
const isDirectiveOrHeader = (l: string) => /^\s*\{.*\}\s*$/.test(l) || /^\s*\[[^\]]*\]\s*$/.test(l);

/**
 * Convert "chords above lyrics" into inline [chord] notation:
 *     G        C
 *     Amazing grace      →   [G]Amazing [C]grace
 * Lines that are already inline are left alone.
 */
export function chordsOverLyricsToInline(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!isChordLine(line)) { out.push(line); continue; }
    const chords = tokens(line).map((t) => ({ ...t, text: stripParens(t.text) })).filter((t) => !IGNORABLE.test(t.text) && t.text !== "" && parseChordSymbol(t.text));
    const next = lines[i + 1];
    if (!isBlank(next) && !isChordLine(next!) && !isDirectiveOrHeader(next!)) {
      let lyric = next!.replace(/\s+$/, "");
      for (const c of [...chords].reverse()) {
        if (lyric.length < c.column) lyric = lyric.padEnd(c.column, " ");
        lyric = `${lyric.slice(0, c.column)}[${c.text}]${lyric.slice(c.column)}`;
      }
      out.push(lyric);
      i += 1;
    } else {
      out.push(chords.map((c) => `[${c.text}]`).join(" "));
    }
  }
  return out.join("\n");
}
