import { useEffect, useMemo, useState } from "react";
import { chordNotes, parseChordSymbol } from "./music-chords";
import { getPitchClass } from "./music-notes";
import { PianoView } from "./instruments-piano-PianoView";
import { StringedView } from "./instruments-stringed-StringedView";
import { getTuningsForInstrument } from "./instruments-core-catalog";
import { functionOf, prettyNote } from "./instruments-core";
import { recordRecent } from "./storage";

type Inst = "guitar" | "ukulele" | "piano";

/** Popup that shows a chord on any instrument. Used from songs and, later, setlists and performance mode. */
export function ChordViewer({ symbol, onClose, onOpenLab, defaultInstrument = "guitar", defaultTuningId = "", defaultCapo = 0, startShapeId }: { symbol: string; onClose: () => void; onOpenLab?: (symbol: string) => void; defaultInstrument?: Inst; defaultTuningId?: string; defaultCapo?: number; /** Open on this saved shape */ startShapeId?: string }) {
  const parsed = useMemo(() => parseChordSymbol(symbol), [symbol]);
  const [instrument, setInstrument] = useState<Inst>(defaultInstrument);
  const [tuningId, setTuningId] = useState(defaultTuningId);
  const tunings = instrument === "piano" ? [] : getTuningsForInstrument(instrument);
  const tuning = tunings.find((t) => t.id === tuningId) ?? tunings[0];

  useEffect(() => { if (parsed) void recordRecent("chord", parsed.symbol); }, [parsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return <div className="viewer-backdrop" onClick={onClose} role="presentation">
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Chord ${symbol}`} onClick={(e) => e.stopPropagation()}>
      <div className="viewer-head">
        <div>
          <h2>{parsed ? parsed.symbol.replace(/b/g, "♭").replace(/#/g, "♯") : symbol}</h2>
          {parsed && <div className="note-row">{chordNotes(parsed.chord).map((n) => <span key={`${n.letter}${n.accidental}`} className={`note-chip fn-${functionOf(parsed.chord, getPitchClass(n)) ?? "other"}`}>{prettyNote(n)}</span>)}</div>}
        </div>
        <div className="viewer-actions">{parsed && onOpenLab && <button onClick={() => { onClose(); onOpenLab(parsed.symbol); }}>Open in Chord Lab</button>}<button className="ghost" onClick={onClose} aria-label="Close">✕</button></div>
      </div>
      {!parsed ? <p className="status-warn">“{symbol}” isn't a chord the app recognises yet. Try something like Am7, F♯m, Bb/D or Csus4.</p> : <>
        <div className="instrument-tabs" role="tablist">
          {(["guitar", "ukulele", "piano"] as const).map((id) => <button key={id} className={instrument === id ? "instrument-tab active" : "instrument-tab"} onClick={() => { setInstrument(id); setTuningId(""); }} role="tab" aria-selected={instrument === id}>{id[0].toUpperCase() + id.slice(1)}</button>)}
        </div>
        {tunings.length > 1 && <div className="instrument-options"><label>Tuning<select value={tuning?.id} onChange={(e) => setTuningId(e.target.value)}>{tunings.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>}
        {instrument === "piano" ? <PianoView chord={parsed.chord} octaves={2} /> : tuning && <StringedView chord={parsed.chord} tuning={tuning} maxFret={12} capo={defaultCapo} startShapeId={startShapeId} />}
      </>}
    </div>
  </div>;
}
