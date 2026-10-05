import type { Chord } from "./music-chords";
import { getMidi, getPitchClass, mod12 } from "./music-notes";
import type { StringPosition, Tuning } from "./instruments-core";
import { noteAtFret } from "./instruments-core-note-utils";

export type ShapeMode = "playable" | "balanced" | "complete";

export interface ShapeOptions {
  /** Highest fret searched (relative to the capo). */
  maxFret?: number;
  capo?: number;
  /** Maximum shapes returned. */
  limit?: number;
  mode?: ShapeMode;
  /** Allow a chord tone other than the root (or slash bass) as the lowest note. */
  allowInversions?: boolean;
  /** Widest fret stretch, e.g. 3 = four frets. */
  maxSpan?: number;
}

export interface Barre { fret: number; fromString: number; toString: number }

export interface GeneratedShape {
  /** Stable key, e.g. "x32010". */
  id: string;
  positions: StringPosition[];
  /** Fret per string, low to high, null = muted. */
  frets: (number | null)[];
  label: string;
  minFret: number;
  maxFret: number;
  fingers: number;
  barre?: Barre;
  soundingStrings: number;
  degrees: number[];
  score: number;
}

const WEIGHTS: Record<ShapeMode, { fingers: number; barre: number; span: number; sounding: number; degree: number; open: number; low: number }> = {
  playable: { fingers: 2.4, barre: 2.5, span: 1.4, sounding: 1.4, degree: 2.5, open: 1.5, low: 0.7 },
  balanced: { fingers: 1.5, barre: 1.0, span: 1.0, sounding: 2.0, degree: 3.0, open: 1.5, low: 0.5 },
  complete: { fingers: 0.8, barre: 0.4, span: 0.6, sounding: 2.5, degree: 4.5, open: 1.0, low: 0.3 }
};

interface Option { fret: number; pc: number; degree: number }

function chordTones(chord: Chord) {
  const rootPc = getPitchClass(chord.root);
  return chord.formula.map((i) => ({ degree: i.degree, pc: mod12(rootPc + i.semitones), symbol: i.symbol }));
}

/** Degrees a player may leave out: the plain 5th of 4+ note chords, and 9/11 under higher extensions. */
function optionalDegrees(chord: Chord): Set<number> {
  const optional = new Set<number>();
  const tones = chord.formula;
  const fifth = tones.find((t) => t.degree === 5);
  if (tones.length >= 4 && fifth && fifth.semitones === 7) optional.add(5);
  if (tones.some((t) => t.degree === 13)) { optional.add(9); optional.add(11); }
  else if (tones.some((t) => t.degree === 11)) optional.add(9);
  return optional;
}

function detectBarre(frets: (number | null)[]): { barre?: Barre; fingers: number } {
  const fretted = frets.map((f, s) => ({ f, s })).filter((x): x is { f: number; s: number } => x.f !== null && x.f > 0);
  if (fretted.length === 0) return { fingers: 0 };
  const minFret = Math.min(...fretted.map((x) => x.f));
  const atMin = fretted.filter((x) => x.f === minFret);
  const loose = fretted.length;
  // A barre is only used when it is natural: three or more strings at the lowest fret, or when it saves running out of fingers.
  if (atMin.length >= 2 && (atMin.length >= 3 || loose > 4)) {
    const from = atMin[0].s;
    const to = atMin[atMin.length - 1].s;
    let blocked = false;
    for (let s = from; s <= to; s += 1) if (frets[s] === 0) blocked = true; // an open string cannot sit under a barre
    if (!blocked) return { barre: { fret: minFret, fromString: from, toString: to }, fingers: 1 + (loose - atMin.length) };
  }
  return { fingers: loose };
}

function labelFor(frets: (number | null)[], barre: Barre | undefined, minFret: number, maxFret: number): string {
  const hasOpen = frets.some((f) => f === 0);
  if (maxFret === 0) return "Open";
  if (barre) return `Barre · fret ${barre.fret}`;
  if (hasOpen && minFret <= 4) return "Open";
  return minFret === maxFret ? `Fret ${minFret}` : `Frets ${minFret}–${maxFret}`;
}

/** Rebuild playable positions from a fret list (null = muted). Returns null if it doesn't fit this tuning. */
export function positionsFromFrets(frets: (number | null)[], tuning: Tuning, capo = 0): StringPosition[] | null {
  if (frets.length !== tuning.strings.length) return null;
  if (frets.some((f) => f !== null && (!Number.isInteger(f) || f < 0 || f > 36))) return null;
  return frets.map((f, stringIndex): StringPosition =>
    f === null ? { stringIndex, fret: 0, state: "muted" } : { stringIndex, fret: f, state: f === 0 ? "open" : "fretted", note: noteAtFret(tuning.strings[stringIndex].pitch, f, capo) }
  );
}

export function shapeKey(frets: (number | null)[]): string {
  const wide = frets.some((f) => f !== null && f >= 10);
  return frets.map((f) => (f === null ? "x" : String(f))).join(wide ? "-" : "");
}

/**
 * Search playable fingerings for a chord on a stringed instrument, best first.
 * Every required chord tone must sound, the stretch must be reachable, and at most four fingers are used (a barre counts as one).
 */
export function generateShapes(chord: Chord, tuning: Tuning, options: ShapeOptions = {}): GeneratedShape[] {
  const { maxFret = 12, capo = 0, limit = 24, mode = "balanced", allowInversions = false, maxSpan = 3 } = options;
  const strings = tuning.strings;
  const n = strings.length;
  const tones = chordTones(chord);
  const optional = optionalDegrees(chord);
  const required = tones.filter((t) => !optional.has(t.degree)).map((t) => t.degree);
  const toneByPc = new Map(tones.map((t) => [t.pc, t.degree]));
  const rootPc = getPitchClass(chord.root);
  const bassPc = chord.bass ? getPitchClass(chord.bass) : rootPc;
  const extraBass = chord.bass && !toneByPc.has(bassPc);
  const ascending = strings.every((s, i) => i === 0 || getMidi(s.pitch) > getMidi(strings[i - 1].pitch));
  const requireBass = ascending && !allowInversions;
  const minSounding = n >= 5 ? 4 : 3;
  const w = WEIGHTS[mode];

  const optionsPerString: Option[][] = strings.map((string) => {
    const list: Option[] = [];
    for (let fret = 0; fret <= maxFret; fret += 1) {
      const pc = getPitchClass(noteAtFret(string.pitch, fret, capo));
      const degree = toneByPc.get(pc);
      if (degree !== undefined) list.push({ fret, pc, degree });
      else if (extraBass && pc === bassPc) list.push({ fret, pc, degree: 0 });
    }
    return list;
  });
  const midiAt = (s: number, fret: number) => getMidi(strings[s].pitch) + capo + fret;

  const found = new Map<string, GeneratedShape>();
  const frets: (number | null)[] = new Array(n).fill(null);

  function evaluate() {
    const sounding = frets.map((f, s) => (f === null ? -1 : s)).filter((s) => s >= 0);
    if (sounding.length < minSounding) return;
    const degrees = new Set<number>();
    let lowest = sounding[0];
    for (const s of sounding) {
      const opt = optionsPerString[s].find((o) => o.fret === frets[s])!;
      if (opt.degree > 0) degrees.add(opt.degree);
      if (midiAt(s, frets[s]!) < midiAt(lowest, frets[lowest]!)) lowest = s;
    }
    if (!required.every((d) => degrees.has(d))) return;
    const lowestPc = mod12(midiAt(lowest, frets[lowest]!));
    if (extraBass) {
      if (lowestPc !== bassPc) return;
      // The added bass may only be the lowest sounding note.
      for (const s of sounding) if (s !== lowest && mod12(midiAt(s, frets[s]!)) === bassPc && !toneByPc.has(bassPc)) return;
    } else if (requireBass && lowestPc !== bassPc) return;

    const { barre, fingers } = detectBarre(frets);
    if (fingers > 4) return;
    const fretted = frets.filter((f): f is number => f !== null && f > 0);
    const minFret = fretted.length ? Math.min(...fretted) : 0;
    const maxUsed = fretted.length ? Math.max(...fretted) : 0;
    const span = fretted.length ? maxUsed - minFret : 0;
    const opens = frets.filter((f) => f === 0).length;
    const rootInBass = lowestPc === bassPc;

    const requiredCovered = required.filter((d) => degrees.has(d)).length;
    const optionalCovered = degrees.size - requiredCovered;
    const muted = n - sounding.length;
    // Open strings are a plus near the nut, but rarely sensible far up the neck.
    const openBonus = minFret <= 4 ? opens * w.open : 0;
    const positionCost = minFret * w.low + (minFret > 4 ? 0.8 * (minFret - 4) : 0);
    const total =
      sounding.length * w.sounding +
      requiredCovered * w.degree +
      optionalCovered * w.degree * 0.1 +
      (tones.every((t) => degrees.has(t.degree)) ? 0.5 : 0) +
      openBonus -
      fingers * w.fingers -
      span * w.span -
      positionCost -
      muted * (n <= 4 ? 3 : 0.5) -
      (barre ? w.barre : 0) +
      (ascending && rootInBass ? 4 : 0);

    const id = shapeKey(frets);
    if (found.has(id)) return;
    found.set(id, {
      id,
      positions: frets.map((f, stringIndex): StringPosition =>
        f === null ? { stringIndex, fret: 0, state: "muted" } : { stringIndex, fret: f, state: f === 0 ? "open" : "fretted", note: noteAtFret(strings[stringIndex].pitch, f, capo) }
      ),
      frets: [...frets],
      label: labelFor(frets, barre, minFret, maxUsed),
      minFret,
      maxFret: maxUsed,
      fingers,
      barre,
      soundingStrings: sounding.length,
      degrees: [...degrees].sort((a, b) => a - b),
      score: total
    });
  }

  // phase 0 = leading mutes, 1 = sounding run, 2 = trailing mutes (no mutes inside the run)
  function walk(s: number, phase: number, lo: number, hi: number) {
    if (s === n) { evaluate(); return; }
    // muted
    if (phase === 0) { frets[s] = null; walk(s + 1, 0, lo, hi); }
    else if (phase === 1) { frets[s] = null; walk(s + 1, 2, lo, hi); }
    else { frets[s] = null; walk(s + 1, 2, lo, hi); }
    if (phase === 2) return;
    for (const opt of optionsPerString[s]) {
      let nlo = lo, nhi = hi;
      if (opt.fret > 0) {
        nlo = Math.min(lo, opt.fret);
        nhi = Math.max(hi, opt.fret);
        if (nhi - nlo > maxSpan) continue;
      }
      frets[s] = opt.fret;
      walk(s + 1, 1, nlo, nhi);
    }
    frets[s] = null;
  }
  walk(0, 0, Infinity, -Infinity);

  const ranked = [...found.values()].sort((a, b) => b.score - a.score || a.minFret - b.minFret);
  // Keep variety: at most three shapes per neck position before filling the rest.
  const perPosition = new Map<number, number>();
  const picked: GeneratedShape[] = [];
  const rest: GeneratedShape[] = [];
  for (const shape of ranked) {
    const bucket = shape.minFret;
    const used = perPosition.get(bucket) ?? 0;
    if (used < 3) { perPosition.set(bucket, used + 1); picked.push(shape); } else rest.push(shape);
  }
  return picked.concat(rest).slice(0, limit);
}
