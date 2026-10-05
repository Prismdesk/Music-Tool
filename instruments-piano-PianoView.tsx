import type { Chord } from "./music-chords";
import { getMidi } from "./music-notes";
import { chordSpelling, functionOf, prettyNote } from "./instruments-core";

export function PianoView({ chord, startOctave = 3, octaves = 3, onSelect, selected }: { chord: Chord; startOctave?: number; octaves?: number; onSelect?: (midi: number) => void; selected?: number[] }) {
  const startMidi = getMidi({ letter: "C", accidental: 0, octave: startOctave });
  const count = octaves * 12 + 1;
  const keys = Array.from({ length: count }, (_, i) => startMidi + i);
  const black = new Set([1, 3, 6, 8, 10]);
  const spell = chordSpelling(chord);
  return <div className="instrument-panel piano-panel">
    <div className="instrument-heading"><div><b>Piano</b><small>C{startOctave}–C{startOctave + octaves}</small></div><small>Tap a key to add or remove it from the note set</small></div>
    <div className="piano-keys">{keys.map(midi => {
      const pc = midi % 12;
      const fn = functionOf(chord, pc);
      const name = prettyNote(spell(pc));
      const chosen = selected?.includes(pc);
      return <button key={midi} className={`piano-key ${black.has(pc) ? "black-key" : "white-key"} ${fn ? `fn-${fn}` : ""} ${chosen ? "picked" : ""}`} onClick={() => onSelect?.(midi)} title={`${name} · MIDI ${midi}`}><span>{name}</span></button>;
    })}</div>
    <div className="function-legend"><span className="legend-root">Root</span><span className="legend-third">3rd</span><span className="legend-fifth">5th</span><span className="legend-seventh">7th</span><span className="legend-extension">Extension</span></div>
  </div>;
}
