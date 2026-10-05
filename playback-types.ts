export type PlaybackInstrument = "piano" | "guitar" | "ukulele";
export type PlaybackMode = "block" | "arpeggio" | "strum-down" | "strum-up" | "individual";

export interface PlaybackNote {
  midi: number;
  duration?: number;
  velocity?: number;
}

export interface PlaybackOptions {
  instrument: PlaybackInstrument;
  mode?: PlaybackMode;
  bpm?: number;
  strumMs?: number;
  velocity?: number;
  duration?: number;
}

export interface MetronomeOptions {
  bpm: number;
  beats?: number;
}
