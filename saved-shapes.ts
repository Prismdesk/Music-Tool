import { chordKey } from "./search-engine";
import type { SavedShape } from "./storage-models";

export interface ShapeDraft {
  name: string;
  /** The chord this shape is filed under, e.g. "Cmaj7". */
  symbol: string;
  instrumentId: string;
  tuningId: string;
  capo: number;
  frets: (number | null)[];
}

export const MAX_SHAPE_NAME = 40;

export function sanitizeName(name: string, fallback: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim().slice(0, MAX_SHAPE_NAME);
  return cleaned || fallback;
}

export const sameFrets = (a: (number | null)[], b: (number | null)[]) => a.length === b.length && a.every((f, i) => f === b[i]);

/** Saved shapes for this chord on this instrument tuning and capo, oldest first. Equivalent spellings (C#/Db, CM7/Cmaj7) count as the same chord. */
export function shapesFor(all: SavedShape[], where: { symbol: string; tuningId: string; capo: number }): SavedShape[] {
  const key = chordKey(where.symbol);
  if (!key) return [];
  return all
    .filter((s) => s.tuningId === where.tuningId && s.capo === where.capo && s.symbol !== undefined && chordKey(s.symbol) === key)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Add a shape, or if the same fingering is already saved for this chord, just give it the new name. */
export function upsertShape(all: SavedShape[], draft: ShapeDraft, id: string, now: string): { shape: SavedShape; created: boolean } {
  const name = sanitizeName(draft.name, `${draft.symbol} shape`);
  const existing = shapesFor(all, draft).find((s) => sameFrets(s.frets, draft.frets));
  if (existing) return { shape: { ...existing, name }, created: false };
  return { shape: { id, instrumentId: draft.instrumentId, tuningId: draft.tuningId, capo: draft.capo, symbol: draft.symbol, name, frets: [...draft.frets], createdAt: now }, created: true };
}

/** Default name offered when saving: "Cmaj7 – shape 2". */
export function suggestName(symbol: string, existing: SavedShape[]): string {
  return `${symbol} – shape ${existing.length + 1}`;
}
