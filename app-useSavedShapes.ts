import { useCallback, useEffect, useMemo, useState } from "react";
import { formatChordSymbol, type Chord } from "./music-chords";
import { shapesFor, upsertShape, type ShapeDraft } from "./saved-shapes";
import { savedShapeRepo, type SavedShape } from "./storage";

/** Saved fretboard shapes for one chord on one tuning, with save / rename / delete. */
export function useSavedShapes(chord: Chord, tuningId: string, capo: number) {
  const [all, setAll] = useState<SavedShape[]>([]);
  const [error, setError] = useState("");
  const symbol = formatChordSymbol(chord);

  const reload = useCallback(async () => {
    try { setAll(await savedShapeRepo.list()); } catch { /* storage unavailable: shapes just won't be saved */ }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const saved = useMemo(() => shapesFor(all, { symbol, tuningId, capo }), [all, symbol, tuningId, capo]);

  const save = useCallback(async (draft: ShapeDraft): Promise<SavedShape | null> => {
    try {
      const current = await savedShapeRepo.list();
      const { shape } = upsertShape(current, draft, `shape-${crypto.randomUUID()}`, new Date().toISOString());
      await savedShapeRepo.save(shape);
      setError("");
      await reload();
      return shape;
    } catch { setError("Couldn't save this shape on the device."); return null; }
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    try { await savedShapeRepo.remove(id); await reload(); } catch { setError("Couldn't delete the shape."); }
  }, [reload]);

  return { saved, save, remove, error, symbol };
}
