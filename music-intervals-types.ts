export type IntervalQuality = "perfect" | "major" | "minor" | "augmented" | "diminished";
export type IntervalNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Interval {
  number: IntervalNumber;
  quality: IntervalQuality;
  semitones: number;
}

export interface IntervalFormula {
  degree: number;
  semitones: number;
  quality: IntervalQuality;
  symbol: string;
}
