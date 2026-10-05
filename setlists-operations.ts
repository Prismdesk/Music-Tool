import type { Setlist, SetlistEntry } from "./setlists-types";

const stamp = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function renumber(entries: SetlistEntry[]): SetlistEntry[] {
  return entries.map((entry, order) => ({ ...entry, order }));
}

export function createSetlist(name = "New Setlist"): Setlist {
  const now = stamp();
  return { id: newId("setlist"), name, entries: [], favorite: false, createdAt: now, updatedAt: now };
}

export function sortedEntries(setlist: Setlist): SetlistEntry[] {
  return [...setlist.entries].sort((a, b) => a.order - b.order);
}

function touch(setlist: Setlist, entries: SetlistEntry[]): Setlist {
  return { ...setlist, entries: renumber(entries), updatedAt: stamp() };
}

/** Adds a song at the end (or at `index`). The same song can appear any number of times. */
export function addSong(setlist: Setlist, songId: string, index?: number): Setlist {
  const entries = sortedEntries(setlist);
  const entry: SetlistEntry = { id: newId("entry"), songId, order: 0 };
  entries.splice(index ?? entries.length, 0, entry);
  return touch(setlist, entries);
}

export function removeEntry(setlist: Setlist, entryId: string): Setlist {
  return touch(setlist, sortedEntries(setlist).filter((e) => e.id !== entryId));
}

export function moveEntry(setlist: Setlist, entryId: string, toIndex: number): Setlist {
  const entries = sortedEntries(setlist);
  const from = entries.findIndex((e) => e.id === entryId);
  if (from < 0) return setlist;
  const target = Math.max(0, Math.min(entries.length - 1, toIndex));
  if (target === from) return setlist;
  const [entry] = entries.splice(from, 1);
  entries.splice(target, 0, entry);
  return touch(setlist, entries);
}

export function updateEntry(setlist: Setlist, entryId: string, patch: Partial<Omit<SetlistEntry, "id" | "order">>): Setlist {
  return touch(setlist, sortedEntries(setlist).map((e) => (e.id === entryId ? { ...e, ...patch } : e)));
}

export function duplicateEntry(setlist: Setlist, entryId: string): Setlist {
  const entries = sortedEntries(setlist);
  const i = entries.findIndex((e) => e.id === entryId);
  if (i < 0) return setlist;
  entries.splice(i + 1, 0, { ...entries[i], id: newId("entry") });
  return touch(setlist, entries);
}

export function duplicateSetlist(setlist: Setlist): Setlist {
  const now = stamp();
  return {
    ...setlist, id: newId("setlist"), name: `${setlist.name} (copy)`, favorite: false, createdAt: now, updatedAt: now,
    entries: sortedEntries(setlist).map((e, order) => ({ ...e, id: newId("entry"), order }))
  };
}

/** Drop entries pointing at a song that no longer exists. */
export function pruneMissingSongs(setlist: Setlist, existingSongIds: Set<string>): Setlist {
  const kept = sortedEntries(setlist).filter((e) => existingSongIds.has(e.songId));
  return kept.length === setlist.entries.length ? setlist : touch(setlist, kept);
}
