import type { PlaybackInstrument, PlaybackMode, PlaybackNote } from "./playback-types";

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: OscillatorNode[] = [];
  private metronomeTimer: number | null = null;
  private metronomeBeat = 0;
  private volume = 0.72;

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  async resume() {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.volume;
  }

  getVolume() { return this.volume; }

  stop() {
    for (const oscillator of this.active) {
      try { oscillator.stop(); } catch { /* already stopped */ }
    }
    this.active = [];
  }

  private frequency(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

  private tone(midi: number, start: number, duration: number, velocity: number, instrument: PlaybackInstrument) {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const now = Math.max(start, ctx.currentTime);
    const end = now + Math.max(0.05, duration);

    osc.frequency.value = this.frequency(midi);
    osc.type = instrument === "piano" ? "triangle" : "sawtooth";
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(instrument === "piano" ? 3600 : 1900, now);
    filter.Q.value = 0.7;

    const peak = Math.max(0.005, Math.min(0.55, velocity * (instrument === "piano" ? 0.28 : 0.2)));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + (instrument === "piano" ? 0.008 : 0.004));
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.35), now + Math.min(duration * 0.45, 0.12));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(filter).connect(gain).connect(this.master!);
    osc.start(now);
    osc.stop(end + 0.02);
    this.active.push(osc);
    osc.onended = () => { this.active = this.active.filter(x => x !== osc); };
  }

  async playNotes(notes: PlaybackNote[], options: { instrument: PlaybackInstrument; mode?: PlaybackMode; strumMs?: number; velocity?: number; duration?: number }) {
    await this.resume();
    this.stop();
    const ctx = this.ensureContext();
    const mode = options.mode ?? "block";
    const base = ctx.currentTime + 0.025;
    const velocity = options.velocity ?? 0.8;
    const duration = options.duration ?? 1.2;
    const ordered = mode === "strum-up" ? [...notes].sort((a, b) => a.midi - b.midi) : mode === "strum-down" ? [...notes].sort((a, b) => b.midi - a.midi) : notes;
    const delay = (options.strumMs ?? 55) / 1000;

    ordered.forEach((note, index) => {
      const offset = mode === "arpeggio" || mode === "strum-up" || mode === "strum-down" || mode === "individual" ? index * delay : 0;
      const noteDuration = note.duration ?? (mode === "arpeggio" ? 0.7 : duration);
      this.tone(note.midi, base + offset, noteDuration, note.velocity ?? velocity, options.instrument);
    });
  }

  async playMetronome(bpm: number, beats = 4) {
    await this.resume();
    this.stopMetronome();
    const ctx = this.ensureContext();
    const interval = 60 / Math.max(20, Math.min(300, bpm));
    let count = 0;
    const tick = () => {
      if (count >= beats) { this.stopMetronome(); return; }
      const midi = count === 0 ? 84 : 79;
      this.tone(midi, ctx.currentTime, 0.06, 0.7, "piano");
      count += 1;
      this.metronomeTimer = window.setTimeout(tick, interval);
    };
    tick();
  }

  startMetronome(bpm: number) {
    this.stopMetronome();
    this.metronomeBeat = 0;
    const interval = 60000 / Math.max(20, Math.min(300, bpm));
    const tick = () => {
      const ctx = this.ensureContext();
      const midi = this.metronomeBeat % 4 === 0 ? 84 : 79;
      this.tone(midi, ctx.currentTime, 0.055, 0.6, "piano");
      this.metronomeBeat += 1;
      this.metronomeTimer = window.setTimeout(tick, interval);
    };
    void this.resume().then(tick);
  }

  stopMetronome() {
    if (this.metronomeTimer !== null) window.clearTimeout(this.metronomeTimer);
    this.metronomeTimer = null;
    this.metronomeBeat = 0;
  }
}

export const audioEngine = new AudioEngine();
