import type { IntervalFormula } from "./music-intervals";

export interface ScaleDefinition {
  id: string;
  name: string;
  aliases: string[];
  intervals: IntervalFormula[];
  category: "major" | "minor" | "mode" | "pentatonic" | "chromatic" | "other";
}
