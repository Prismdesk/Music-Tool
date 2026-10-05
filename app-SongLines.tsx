import { parseChordSymbol } from "./music-chords";
import { toLines } from "./songs";
import type { SongBlock } from "./songs";

const pretty = (s: string) => s.replace(/b/g, "♭").replace(/#/g, "♯");

/** Lyrics with each chord drawn above the words it belongs to. Tapping a chord calls onChord. */
export function SongLines({ blocks, onChord, className = "" }: { blocks: SongBlock[]; onChord?: (symbol: string) => void; className?: string }) {
  const lines = toLines(blocks);
  return <div className={`song-lines ${className}`}>
    {lines.map((line, i) => line.length === 0
      ? <div className="sl-line sl-blank" key={i} />
      : <div className="sl-line" key={i}>{line.map((chunk, j) => <span className="sl-chunk" key={j}>
          <span className="sl-chord-row">{chunk.chord && (parseChordSymbol(chunk.chord.symbol)
            ? <button className="sl-chord" onClick={() => onChord?.(chunk.chord!.symbol)}>{pretty(chunk.chord.symbol)}</button>
            : <button className="sl-chord bad" title="Not a chord the app recognises yet" onClick={() => onChord?.(chunk.chord!.symbol)}>{pretty(chunk.chord.symbol)}</button>)}</span>
          <span className="sl-text">{chunk.text || "\u00a0"}</span>
        </span>)}</div>)}
  </div>;
}
