import { useEffect, useMemo, useState } from "react";
import { CHORD_DEFINITIONS } from "./music-chords-definitions";
import { chordNotes, createChord } from "./music-chords-factory";
import { identifyChord } from "./music-chords-identification";
import { formatChordName, formatChordSymbol } from "./music-chords-naming";
import { transposeChord } from "./music-chords-transposition";
import type { Chord } from "./music-chords-types";
import { getPitchClass, type Note } from "./music-notes";
import { spellChordRoot } from "./music-notes-spelling";
import { PianoView } from "./instruments-piano-PianoView";
import { StringedView } from "./instruments-stringed-StringedView";
import { getTuningsForInstrument } from "./instruments-core-catalog";
import { functionOf, prettyNote, type Tuning } from "./instruments-core";
import { PlaybackPanel } from "./app-PlaybackPanel";
import { parseChordSymbol } from "./music-chords-parse";
import { recentHistory, recordRecent } from "./storage";

const ROOTS: Note[] = [
  { letter: "C", accidental: 0 }, { letter: "C", accidental: 1 }, { letter: "D", accidental: -1 }, { letter: "D", accidental: 0 },
  { letter: "E", accidental: -1 }, { letter: "E", accidental: 0 }, { letter: "F", accidental: 0 }, { letter: "F", accidental: 1 },
  { letter: "G", accidental: -1 }, { letter: "G", accidental: 0 }, { letter: "A", accidental: -1 }, { letter: "A", accidental: 0 },
  { letter: "B", accidental: -1 }, { letter: "B", accidental: 0 }
];
const rootKey = (n: Note) => `${n.letter}${["bb", "b", "", "#", "##"][n.accidental + 2]}`;
const PC_LABELS = ["C", "C♯ D♭", "D", "D♯ E♭", "E", "F", "F♯ G♭", "G", "G♯ A♭", "A", "A♯ B♭", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);

export function ChordLab({ onSaveChord, savedChords = [], defaultInstrument = "piano", fretCount = 12, loadSymbol }: { onSaveChord?: (symbol: string) => void; savedChords?: string[]; defaultInstrument?: "piano" | "guitar" | "ukulele"; fretCount?: number; /** Open this chord (change `n` to reopen the same one) */ loadSymbol?: { symbol: string; n: number } }) {
  const [rootId, setRootId] = useState("C");
  const [definitionId, setDefinitionId] = useState("maj");
  const [selectedPcs, setSelectedPcs] = useState<number[]>([]);
  const [transposed, setTransposed] = useState<Chord | null>(null);
  const [localSaved, setLocalSaved] = useState<string[]>([]);
  const [instrument, setInstrument] = useState<"piano" | "guitar" | "ukulele">(defaultInstrument);
  const [tuningId, setTuningId] = useState(defaultInstrument === "piano" ? "" : getTuningsForInstrument(defaultInstrument)[0]?.id ?? "");
  const [capo, setCapo] = useState(0);

  const [recent, setRecent] = useState<string[]>([]);

  /** Put a chord (by name) into the builder. */
  function loadChord(symbol: string) {
    const parsed = parseChordSymbol(symbol);
    if (!parsed) return;
    const root = ROOTS.find((r) => rootKey(r) === rootKey(parsed.chord.root)) ?? ROOTS.find((r) => getPitchClass(r) === getPitchClass(parsed.chord.root));
    if (!root) return;
    setRootId(rootKey(root));
    setDefinitionId(parsed.definition.id);
    setTransposed(null);
  }
  useEffect(() => { if (loadSymbol) loadChord(loadSymbol.symbol); }, [loadSymbol?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void recentHistory(["chord"], 8).then((items) => setRecent(items.map((h) => h.label))); }, []);

  const tuning: Tuning | undefined = instrument === "piano" ? undefined : getTuningsForInstrument(instrument).find(t => t.id === tuningId) ?? getTuningsForInstrument(instrument)[0];
  const definition = CHORD_DEFINITIONS.find((d) => d.id === definitionId) ?? CHORD_DEFINITIONS[0];
  const baseRoot = ROOTS.find((r) => rootKey(r) === rootId) ?? ROOTS[0];
  const chord = useMemo(() => createChord(baseRoot, definition), [baseRoot, definition]);
  const displayChord = transposed ?? chord;
  const notes = chordNotes(displayChord);
  const chordName = formatChordName(displayChord, definition);
  const symbol = formatChordSymbol(displayChord);
  const saved = savedChords.length || onSaveChord ? savedChords : localSaved;
  const isSaved = saved.includes(symbol);
  useEffect(() => {
    const t = window.setTimeout(() => { void recordRecent("chord", symbol); }, 1500);
    return () => window.clearTimeout(t);
  }, [symbol]);

  const identification = useMemo(() => {
    if (!selectedPcs.length) return null;
    const spelled = selectedPcs.map((pc) => spellChordRoot(pc));
    return identifyChord(spelled, spelled[0]);
  }, [selectedPcs]);

  function togglePc(pc: number) {
    setSelectedPcs((current) => current.includes(pc) ? current.filter((x) => x !== pc) : [...current, pc]);
  }

  function useChordNotes() { setSelectedPcs(notes.map(getPitchClass)); }

  function saveChord() {
    if (onSaveChord) onSaveChord(symbol);
    else setLocalSaved((current) => current.includes(symbol) ? current : [...current, symbol]);
  }

  function pick(candidateChord: Chord) {
    // Load an identified chord back into the builder
    const root = ROOTS.find((r) => rootKey(r) === rootKey(candidateChord.root));
    if (!root || !candidateChord.definitionId) return;
    setRootId(rootKey(root)); setDefinitionId(candidateChord.definitionId); setTransposed(null);
  }

  return <div className="lab">
    <header className="lab-header">
      <div>
        <span className="eyebrow">CHORD LAB</span>
        <h1>Build, identify, and explore chords</h1>
        <p>One chord, every instrument. Colors show each note's job in the chord: root, 3rd, 5th, 7th and extensions.</p>
      </div>
      <button className="ghost" onClick={() => { setSelectedPcs([]); setTransposed(null); }}>Reset</button>
    </header>

    <section className="lab-grid">
      <aside className="panel controls">
        <div className="panel-title"><span>Chord Builder</span><small>Root + type</small></div>
        <label>Root<select value={rootId} onChange={(e) => { setRootId(e.target.value); setTransposed(null); }}>{ROOTS.map((r) => <option key={rootKey(r)} value={rootKey(r)}>{prettyNote(r)}</option>)}</select></label>
        <label>Type<select value={definitionId} onChange={(e) => { setDefinitionId(e.target.value); setTransposed(null); }}>{CHORD_DEFINITIONS.map((d) => <option key={d.id} value={d.id}>{d.name || "Major"} · {d.category}</option>)}</select></label>
        <button className="primary" onClick={useChordNotes}>Send notes to the picker</button>
        <div className="hint">Pick notes below to find out what chord they make. The first note you pick is treated as the lowest.</div>
      </aside>

      <main className="panel chord-card">
        <div className="chord-top"><div><span className="eyebrow">CURRENT CHORD</span><div className="chord-name">{chordName.replace(/b/g, "♭").replace(/#/g, "♯")}</div></div><button className="favorite" onClick={saveChord}>{isSaved ? "★ Saved" : "☆ Save"}</button></div>
        <div className="note-row">{notes.map((n) => <span className={`note-chip fn-${functionOf(displayChord, getPitchClass(n)) ?? "other"}`} key={`${n.letter}${n.accidental}`}>{prettyNote(n)}</span>)}</div>
        <div className="detail-grid"><div><small>ROOT</small><strong>{prettyNote(displayChord.root)}</strong></div><div><small>FORMULA</small><strong>{displayChord.formula.map((i) => i.symbol).join(" · ")}</strong></div><div><small>NOTES</small><strong>{notes.map(prettyNote).join(" · ")}</strong></div></div>
        <div className="transpose"><span>Transpose</span>{[-2,-1,1,2].map((amount) => <button key={amount} onClick={() => setTransposed(transposeChord(displayChord, amount))}>{amount > 0 ? "+" : ""}{amount}</button>)}<button onClick={() => setTransposed(null)}>Original</button></div>
        <details><summary>Explain chord</summary><p>{definition.name || "Major"} uses the formula <b>{definition.intervals.map((i) => i.symbol).join("–")}</b>. The engine keeps interval structure separate from the displayed name so custom chords can use the same pipeline.</p></details>
      </main>
    </section>

    {recent.length > 0 && <div className="recent-row" aria-label="Recent chords"><span>Recent</span>{recent.filter((r) => r !== symbol).map((r) => <button key={r} onClick={() => loadChord(r)}>{r.replace(/b/g, "♭").replace(/#/g, "♯")}</button>)}</div>}

    <PlaybackPanel notes={notes} instrument={instrument} />

    <section className="panel instrument-tabs-panel">
      <div className="instrument-tabs" role="tablist" aria-label="Instrument">
        {(["piano", "guitar", "ukulele"] as const).map(id => <button key={id} className={instrument === id ? "instrument-tab active" : "instrument-tab"} onClick={() => { setInstrument(id); if (id !== "piano") setTuningId(getTuningsForInstrument(id)[0]?.id ?? ""); }} role="tab" aria-selected={instrument === id}>{id[0].toUpperCase() + id.slice(1)}</button>)}
      </div>
      {instrument !== "piano" && tuning && <div className="instrument-options">
        <label>Tuning<select value={tuning.id} onChange={e => setTuningId(e.target.value)}>{getTuningsForInstrument(instrument).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Capo<select value={capo} onChange={e => setCapo(Number(e.target.value))}>{Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i === 0 ? "No capo" : `Fret ${i}`}</option>)}</select></label>
      </div>}
      {instrument === "piano"
        ? <PianoView chord={displayChord} selected={selectedPcs} onSelect={(midi) => togglePc(midi % 12)} />
        : tuning ? <StringedView chord={displayChord} tuning={tuning} capo={capo} maxFret={fretCount} /> : null}
    </section>

    <section className="panel note-picker">
      <div className="panel-title"><span>Note Picker</span><small>{selectedPcs.length} selected</small></div>
      <div className="keys chromatic">{PC_LABELS.map((label, pc) => <button key={pc} className={`key${BLACK.has(pc) ? " sharp-key" : ""}${selectedPcs.includes(pc) ? " active" : ""}`} onClick={() => togglePc(pc)}><span>{label}</span>{selectedPcs[0] === pc && <small>bass</small>}</button>)}</div>
      {identification && <div className="identification"><div><span className="eyebrow">IDENTIFICATION</span><h2>{identification.likely ? formatChordSymbol(identification.likely.chord).replace(/b/g, "♭").replace(/#/g, "♯") : "No clear match"}</h2>{identification.likely && <p>{Math.round(identification.likely.confidence * 100)}% match · {identification.likely.reason}</p>}</div>
        <div className="alternatives">{identification.likely && <button onClick={() => pick(identification.likely!.chord)}>Open in builder</button>}{identification.alternatives.slice(0, 4).map((candidate) => <button key={candidate.chord.id} onClick={() => pick(candidate.chord)}>{formatChordSymbol(candidate.chord).replace(/b/g, "♭").replace(/#/g, "♯")} · {Math.round(candidate.confidence * 100)}%</button>)}</div></div>}
    </section>

    {saved.length > 0 && <section className="panel saved"><div className="panel-title"><span>Saved chords</span><small>{onSaveChord ? "Stored on this device" : "This session only"}</small></div><div className="saved-list">{saved.map((item) => <button key={item} onClick={() => loadChord(item)}>★ {item.replace(/b/g, "♭").replace(/#/g, "♯")}</button>)}</div></section>}
  </div>;
}
