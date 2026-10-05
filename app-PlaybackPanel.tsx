import { useState } from "react";
import type { Note } from "./music-notes";
import { audioEngine, chordNotesToMidi, type PlaybackInstrument, type PlaybackMode } from "./playback";

const MODES: { id: PlaybackMode; label: string }[] = [
  { id: "block", label: "Chord" },
  { id: "strum-down", label: "Down" },
  { id: "strum-up", label: "Up" },
  { id: "arpeggio", label: "Arpeggio" },
  { id: "individual", label: "Individual" },
];

export function PlaybackPanel({ notes, instrument }: { notes: Note[]; instrument: PlaybackInstrument }) {
  const [mode, setMode] = useState<PlaybackMode>(instrument === "piano" ? "block" : "strum-down");
  const [volume, setVolume] = useState(audioEngine.getVolume());
  const [bpm, setBpm] = useState(100);
  const [metronome, setMetronome] = useState(false);
  const midi = chordNotesToMidi(notes, instrument === "piano" ? 4 : 3);

  async function play() {
    await audioEngine.playNotes(midi.map(m => ({ midi: m })), { instrument, mode, velocity: volume, duration: instrument === "piano" ? 1.7 : 1.3, strumMs: Math.max(25, 60000 / bpm / 4) });
  }

  function toggleMetronome() {
    if (metronome) audioEngine.stopMetronome();
    else audioEngine.startMetronome(bpm);
    setMetronome(!metronome);
  }

  return <div className="playback-panel">
    <div className="panel-title"><span>Playback</span><small>{instrument === "piano" ? "Synth piano" : `Synth ${instrument}`}</small></div>
    <div className="playback-controls">
      <button className="primary" onClick={play}>▶ Play</button>
      <button className="ghost" onClick={() => audioEngine.stop()}>■ Stop</button>
      <div className="playback-modes">{MODES.map(item => <button key={item.id} className={mode === item.id ? "mode active" : "mode"} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>
    </div>
    <div className="playback-settings">
      <label>Volume<input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => { const value = Number(e.target.value); setVolume(value); audioEngine.setVolume(value); }} /></label>
      <label>BPM<input type="number" min="20" max="300" value={bpm} onChange={e => setBpm(Math.max(20, Math.min(300, Number(e.target.value) || 100)))} /></label>
      <button className={metronome ? "metronome active" : "metronome"} onClick={toggleMetronome}>{metronome ? "● Metronome on" : "○ Metronome"}</button>
    </div>
  </div>;
}
