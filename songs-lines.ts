import type { SongBlock } from "./songs-types";

export interface Chunk { chord?: { id: string; symbol: string }; text: string }
export type Line = Chunk[];

/**
 * Turn a section's blocks into display lines. Each chord is paired with the lyric that follows it
 * (up to the next chord or line break), so renderers can draw the chord above those words.
 */
export function toLines(blocks: SongBlock[]): Line[] {
  const lines: Line[] = [[]];
  let current: Chunk | null = null;
  for (const block of blocks) {
    const line = lines[lines.length - 1];
    if (block.type === "chord") {
      current = { chord: { id: block.id, symbol: block.symbol }, text: "" };
      line.push(current);
      continue;
    }
    const parts = block.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) { lines.push([]); current = null; }
      if (part === "") return;
      if (current) current.text += part;
      else { current = { text: part }; lines[lines.length - 1].push(current); }
    });
  }
  while (lines.length && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}
