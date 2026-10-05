import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Chord } from "./music-chords";
import { formatChordSymbol, identifyChord } from "./music-chords";
import { getMidi, getPitchClass } from "./music-notes";
import { spellChordRoot } from "./music-notes-spelling";
import type { StringPosition, Tuning } from "./instruments-core";
import { chordSpelling, functionOf, prettyNote } from "./instruments-core";
import { noteAtFret } from "./instruments-core-note-utils";
import { generateShapes, positionsFromFrets, shapeKey, type ShapeMode } from "./instruments-stringed-shapes";
import { sameFrets, suggestName } from "./saved-shapes";
import { useSavedShapes } from "./app-useSavedShapes";
import type { SavedShape } from "./storage-models";

const MODES: { id: ShapeMode; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "playable", label: "Most playable" },
  { id: "complete", label: "Most complete" }
];

function identifyPositions(positions: StringPosition[], tuning: Tuning, capo: number): string | null {
  const sounding = positions.filter((p) => p.state !== "muted");
  if (sounding.length < 2) return null;
  const notes = sounding
    .map((p) => ({ note: noteAtFret(tuning.strings[p.stringIndex].pitch, p.fret, capo), midi: getMidi(noteAtFret(tuning.strings[p.stringIndex].pitch, p.fret, capo)) }))
    .sort((a, b) => a.midi - b.midi);
  const spelled = notes.map((n) => spellChordRoot(getPitchClass(n.note)));
  const result = identifyChord(spelled, spelled[0]);
  return result.likely ? formatChordSymbol(result.likely.chord) : null;
}

interface Entry { key: string; label: string; sub: string; positions: StringPosition[]; saved?: SavedShape }

export function StringedView({ chord, tuning, maxFret = 12, capo = 0, startShapeId }: { chord: Chord; tuning: Tuning; maxFret?: number; capo?: number; /** Open on this saved shape */ startShapeId?: string }) {
  const [mode, setMode] = useState<ShapeMode>("balanced");
  const generated = useMemo(() => generateShapes(chord, tuning, { maxFret, capo, mode, limit: 24 }), [chord, tuning, maxFret, capo, mode]);
  const { saved, save, remove, error, symbol } = useSavedShapes(chord, tuning.id, capo);
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState<StringPosition[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [naming, setNaming] = useState<"save" | "rename" | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [notice, setNotice] = useState("");
  const wantedId = useRef<string | undefined>(startShapeId);
  const spell = useMemo(() => chordSpelling(chord), [chord]);
  const isGuitar = tuning.instrumentId === "guitar";

  // Your saved shapes come first, then the generated ones (minus any you already saved).
  const entries: Entry[] = useMemo(() => {
    const mine = saved.flatMap((s): Entry[] => {
      const positions = positionsFromFrets(s.frets, tuning, capo);
      return positions ? [{ key: s.id, label: `★ ${s.name}`, sub: "Your saved shape", positions, saved: s }] : [];
    });
    const rest = generated.filter((g) => !mine.some((m) => sameFrets(m.saved!.frets, g.frets)));
    return [...mine, ...rest.map((g, i): Entry => ({ key: g.id, label: g.label, sub: `Shape ${i + 1} of ${rest.length} · ${g.fingers} ${g.fingers === 1 ? "finger" : "fingers"}`, positions: g.positions }))];
  }, [saved, generated, tuning, capo]);

  useEffect(() => { setIndex(0); setCustom(null); setNaming(null); setNotice(""); }, [chord, tuning.id, capo, mode, maxFret]);
  // Jump to a particular saved shape (opened from Search, or just saved).
  useEffect(() => {
    if (!wantedId.current) return;
    const i = entries.findIndex((e) => e.key === wantedId.current);
    if (i >= 0) { setIndex(i); setCustom(null); wantedId.current = undefined; }
  }, [entries]);

  const entry = entries[Math.min(index, Math.max(0, entries.length - 1))];
  const positions: StringPosition[] = custom ?? entry?.positions ?? tuning.strings.map((_, stringIndex) => ({ stringIndex, fret: 0, state: "muted" as const }));
  const detected = custom ? identifyPositions(custom, tuning, capo) : null;
  const frets = positions.map((p) => (p.state === "muted" ? null : p.fret));
  const soundingCount = frets.filter((f) => f !== null).length;
  const isSavedEntry = !custom && !!entry?.saved;

  function step(delta: number) { setCustom(null); setNaming(null); setNotice(""); setIndex((i) => (i + delta + entries.length) % Math.max(1, entries.length)); }

  function edit(stringIndex: number, fret: number) {
    setNaming(null); setNotice("");
    const base = custom ?? positions;
    setCustom(base.map((p) => {
      if (p.stringIndex !== stringIndex) return p;
      const sameSpot = p.state !== "muted" && p.fret === fret;
      if (sameSpot) return { stringIndex, fret: 0, state: "muted" };
      if (fret === 0) return { stringIndex, fret: 0, state: "open", note: noteAtFret(tuning.strings[stringIndex].pitch, 0, capo) };
      return { stringIndex, fret, state: "fretted", note: noteAtFret(tuning.strings[stringIndex].pitch, fret, capo) };
    }));
  }

  function beginNaming(kind: "save" | "rename") {
    setNotice("");
    setNameDraft(kind === "rename" && entry?.saved ? entry.saved.name : suggestName(detected ?? symbol, saved));
    setNaming(kind);
  }

  async function commitName() {
    const filedAs = isSavedEntry && entry?.saved?.symbol ? entry.saved.symbol : detected ?? symbol;
    const result = await save({ name: nameDraft, symbol: filedAs, instrumentId: tuning.instrumentId, tuningId: tuning.id, capo, frets });
    setNaming(null);
    if (!result) return;
    wantedId.current = result.id;
    setCustom(null);
    setNotice(filedAs === symbol ? "Saved. It will show first for this chord." : `Saved under ${filedAs}.`);
  }

  async function deleteSaved() {
    if (!entry?.saved || !confirm(`Delete the saved shape “${entry.saved.name}”?`)) return;
    await remove(entry.saved.id);
    setIndex(0);
  }

  const cols = `34px repeat(${maxFret + 1}, minmax(48px, 1fr))`;

  return <div className="instrument-panel fretboard-panel">
    <div className="instrument-heading">
      <div><b>{isGuitar ? "Guitar" : "Ukulele"}</b><small>{tuning.name}{capo ? ` · Capo ${capo}` : ""}</small></div>
      <label className="toggle"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show non-chord notes</label>
    </div>

    <div className="shape-nav">
      <button onClick={() => step(-1)} disabled={entries.length < 2} aria-label="Previous shape">‹</button>
      <div className="shape-nav-info">
        {custom ? <><strong>Custom shape</strong><small>{detected ? `Detected: ${detected}` : "Not a recognised chord"}</small></>
          : entry ? <><strong>{entry.label}</strong><small>{entry.sub}{entries.length > 1 && !entry.saved ? "" : ""}</small></>
          : <><strong>No playable shape found</strong><small>Try a higher fret limit or a different capo</small></>}
      </div>
      <button onClick={() => step(1)} disabled={entries.length < 2} aria-label="Next shape">›</button>
      <select value={mode} onChange={e => setMode(e.target.value as ShapeMode)} aria-label="Shape ranking">{MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
    </div>

    <div className="shape-actions">
      {naming ? <div className="name-form">
        <input autoFocus maxLength={40} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void commitName(); if (e.key === "Escape") setNaming(null); }} aria-label="Shape name" />
        <button className="primary" onClick={() => void commitName()}>{naming === "rename" ? "Rename" : "Save"}</button>
        <button onClick={() => setNaming(null)}>Cancel</button>
      </div> : isSavedEntry ? <>
        <button onClick={() => beginNaming("rename")}>Rename</button>
        <button className="danger" onClick={() => void deleteSaved()}>Delete</button>
      </> : <button onClick={() => beginNaming("save")} disabled={soundingCount < 2} title={soundingCount < 2 ? "Place at least two notes first" : undefined}>☆ Save this shape</button>}
      {notice && <span className="status-ok" role="status">{notice}</span>}
      {error && <span className="status-warn" role="alert">{error}</span>}
    </div>

    <div className="fretboard">
      <div className="frets" style={{ "--fret-count": maxFret + 1 } as CSSProperties}>
        <div className="fret-numbers" style={{ gridTemplateColumns: cols }}>
          <span />{Array.from({ length: maxFret + 1 }, (_, f) => <span key={f}>{f}</span>)}
        </div>
        {[...tuning.strings].map((string, si) => ({ string, si })).reverse().map(({ string, si }) => <div className="fret-row" key={string.id} style={{ gridTemplateColumns: cols }}>
          <span className="string-name">{prettyNote(spell(getPitchClass(string.pitch)))}</span>
          {Array.from({ length: maxFret + 1 }, (_, fret) => {
            const pos = positions.find(p => p.stringIndex === si)!;
            const note = noteAtFret(string.pitch, fret, capo);
            const pc = getPitchClass(note);
            const fn = functionOf(chord, pc);
            const isShape = pos.state !== "muted" && pos.fret === fret;
            const visible = showAll || fn !== null || isShape;
            const muteMark = pos.state === "muted" && fret === 0;
            return <button key={fret} className={`fret-cell ${visible && fn ? `fn-${fn}` : ""} ${isShape ? "shape-mark" : ""} ${muteMark ? "muted-mark" : ""}`} onClick={() => edit(si, fret)} title={`${prettyNote(spell(pc))} · fret ${fret}${isShape ? " (click to mute)" : ""}`}>
              {muteMark ? "×" : visible ? prettyNote(spell(pc)) : ""}
            </button>;
          })}
        </div>)}
      </div>
    </div>

    <div className="shape-summary">
      <span>Frets (low → high)</span><strong>{shapeKey(frets)}</strong>
      {custom && <button onClick={() => setCustom(null)}>Back to generated</button>}
    </div>
    <p className="shape-hint">Tap a fret to place a note, tap it again to mute the string. Edited shapes are identified automatically.</p>
  </div>;
}
