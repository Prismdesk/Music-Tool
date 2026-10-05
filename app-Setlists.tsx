import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addSong, createSetlist, duplicateEntry, duplicateSetlist, moveEntry, removeEntry, resolveEntry, sortedEntries, summarize, updateEntry, type Setlist, type SetlistEntry } from "./setlists";
import type { Song } from "./songs";
import { recordRecent, setlistRepo, songRepo } from "./storage";
import { PerformanceMode } from "./app-PerformanceMode";

export function Setlists({ reloadKey = 0, openId = null }: { reloadKey?: number; openId?: string | null }) {
  const [setlists, setSetlists] = useState<Setlist[] | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [performing, setPerforming] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const pending = useRef(new Map<string, Setlist>());
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const batch = [...pending.current.values()];
    pending.current.clear();
    if (!batch.length) return;
    try { await setlistRepo.saveMany(batch); setSaveError(""); } catch { setSaveError("Couldn't save to this device. Export a backup if you have unsaved work."); }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([setlistRepo.list(), songRepo.list()]).then(([lists, allSongs]) => {
      if (!alive) return;
      lists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setSetlists(lists);
      setSongs(allSongs);
      setSelectedId((cur) => (cur && lists.some((l) => l.id === cur) ? cur : lists[0]?.id ?? null));
    });
    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", flush); void flush(); };
  }, [flush]);

  useEffect(() => { if (openId && setlists?.some((x) => x.id === openId)) setSelectedId(openId); }, [openId, setlists]);

  const all = setlists ?? [];
  const selected = all.find((l) => l.id === selectedId) ?? null;
  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const entries = selected ? sortedEntries(selected) : [];
  const items = useMemo(() => entries.map((e) => resolveEntry(e, songById.get(e.songId))), [entries, songById]);
  const pickable = useMemo(() => songs.filter((s) => `${s.title} ${s.artist ?? ""} ${s.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title)), [songs, query]);

  function commit(next: Setlist) {
    setSetlists((cur) => (cur ?? []).map((l) => (l.id === next.id ? next : l)));
    pending.current.set(next.id, next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 400);
  }
  function edit(patch: Partial<Setlist>) { if (selected) commit({ ...selected, ...patch, updatedAt: new Date().toISOString() }); }

  async function newSetlist() {
    const s = createSetlist();
    setSetlists((cur) => [s, ...(cur ?? [])]);
    setSelectedId(s.id);
    await setlistRepo.save(s);
  }
  async function copySetlist() {
    if (!selected) return;
    await flush();
    const copy = duplicateSetlist(selected);
    setSetlists((cur) => [copy, ...(cur ?? [])]);
    setSelectedId(copy.id);
    await setlistRepo.save(copy);
  }
  async function deleteSetlist() {
    if (!selected || !confirm(`Delete “${selected.name}”? Your songs are not affected.`)) return;
    pending.current.delete(selected.id);
    await setlistRepo.remove(selected.id);
    const rest = all.filter((l) => l.id !== selected.id);
    setSetlists(rest);
    setSelectedId(rest[0]?.id ?? null);
  }

  if (!setlists) return <div className="songs-page"><p className="muted">Opening your setlists…</p></div>;

  const { songs: songCount, missing } = summarize(items);

  return <div className="songs-page">
    <header className="lab-header"><div><span className="eyebrow">SETLISTS</span><h1>Plan the set, then perform it</h1><p>Use the same song more than once, with a different key, capo or start for each slot.</p></div><button className="primary" onClick={newSetlist}>+ New Setlist</button></header>
    {saveError && <p className="status-warn">{saveError}</p>}
    <div className="songs-layout">
      <aside className="panel song-list">
        {all.map((l) => <button key={l.id} className={l.id === selectedId ? "song-item active" : "song-item"} onClick={() => { setSelectedId(l.id); setAdding(false); setOpenEntry(null); void recordRecent("setlist", l.name, { id: l.id }); }}><strong>{l.favorite ? "★ " : ""}{l.name}</strong><small>{l.entries.length} {l.entries.length === 1 ? "song" : "songs"}{l.date ? ` · ${l.date}` : ""}</small></button>)}
        {!all.length && <p className="muted">No setlists yet.</p>}
      </aside>

      {selected ? <main className="panel song-editor">
        <div className="editor-toolbar">
          <div><input className="title-input" value={selected.name} onChange={(e) => edit({ name: e.target.value })} aria-label="Setlist name" />
            <div className="sub-row"><input className="sub-input" type="date" value={selected.date ?? ""} onChange={(e) => edit({ date: e.target.value || undefined })} aria-label="Date" /><input className="sub-input" placeholder="Location" value={selected.location ?? ""} onChange={(e) => edit({ location: e.target.value || undefined })} /></div></div>
          <div className="toolbar-actions"><button onClick={() => edit({ favorite: !selected.favorite })}>{selected.favorite ? "★" : "☆"}</button><button onClick={copySetlist}>Duplicate</button><button className="danger" onClick={deleteSetlist}>Delete</button></div>
        </div>

        <div className="song-tools">
          <button className="primary" disabled={!songCount} onClick={() => setPerforming(Math.max(0, items.findIndex((i) => !i.missing)))}>▶ Perform</button>
          <button onClick={() => { setAdding(!adding); setQuery(""); }}>{adding ? "Done adding" : "+ Add songs"}</button>
          <span>{songCount} {songCount === 1 ? "song" : "songs"}{missing ? ` · ${missing} missing` : ""}</span>
        </div>

        {adding && <div className="import-box">
          <input placeholder="Search your songs" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <div className="picker-list">{pickable.map((s) => <button key={s.id} className="song-item" onClick={() => edit(addSong(selected, s.id))}><strong>+ {s.title}</strong><small>{s.artist || "No artist"}{s.originalKey ? ` · ${s.originalKey.root.letter}${s.originalKey.mode === "minor" ? "m" : ""}` : ""}</small></button>)}
            {!pickable.length && <p className="muted">{songs.length ? "No songs match." : "You have no songs yet. Create one in the Songs tab first."}</p>}</div>
        </div>}

        <div className="sections">
          {entries.map((entry, i) => {
            const item = items[i];
            const open = openEntry === entry.id;
            const song = songById.get(entry.songId);
            return <section className={`song-section${item.missing ? " missing" : ""}`} key={entry.id}>
              <div className="entry-row">
                <span className="entry-num">{i + 1}</span>
                <button className="entry-title" onClick={() => setOpenEntry(open ? null : entry.id)} aria-expanded={open}>
                  <strong>{item.title}</strong>
                  <small>{[item.keyName && `Key ${item.keyName}`, item.capo ? `Capo ${item.capo}` : "", item.bpm ? `${item.bpm} BPM` : "", entry.transpose ? `${entry.transpose > 0 ? "+" : ""}${entry.transpose} st` : ""].filter(Boolean).join(" · ") || (item.missing ? "Deleted from library" : "As written")}</small>
                </button>
                <button className="mini" onClick={() => edit(moveEntry(selected, entry.id, i - 1))} disabled={i === 0} aria-label="Move up">↑</button>
                <button className="mini" onClick={() => edit(moveEntry(selected, entry.id, i + 1))} disabled={i === entries.length - 1} aria-label="Move down">↓</button>
                <button className="mini" onClick={() => setPerforming(i)} disabled={item.missing} aria-label="Perform from here">▶</button>
              </div>
              {open && <EntryEditor entry={entry} song={song} onChange={(patch) => edit(updateEntry(selected, entry.id, patch))} onDuplicate={() => edit(duplicateEntry(selected, entry.id))} onRemove={() => { setOpenEntry(null); edit(removeEntry(selected, entry.id)); }} />}
            </section>;
          })}
          {!entries.length && <p className="muted">This setlist is empty. Tap “Add songs”.</p>}
        </div>

        <label className="notes-area">Setlist Notes<textarea value={selected.notes ?? ""} onChange={(e) => edit({ notes: e.target.value || undefined })} placeholder="Soundcheck time, gear list, reminders…" /></label>
      </main> : <main className="panel empty"><h2>No setlists yet</h2><p>Create a setlist, add songs, and run it in Performance Mode.</p><button className="primary" onClick={newSetlist}>Create Setlist</button></main>}
    </div>
    {performing !== null && selected && <PerformanceMode items={items} startAt={performing} title={selected.name} onExit={() => setPerforming(null)} />}
  </div>;
}

function EntryEditor({ entry, song, onChange, onDuplicate, onRemove }: { entry: SetlistEntry; song?: Song; onChange: (patch: Partial<SetlistEntry>) => void; onDuplicate: () => void; onRemove: () => void }) {
  const t = entry.transpose ?? 0;
  return <div className="entry-editor">
    {song && <div className="metadata-grid">
      <label>Transpose (semitones)<div className="stepper"><button onClick={() => onChange({ transpose: t - 1 || undefined })} aria-label="Down one semitone">−</button><output>{t > 0 ? "+" : ""}{t}</output><button onClick={() => onChange({ transpose: t + 1 || undefined })} aria-label="Up one semitone">+</button></div></label>
      <label>Capo<input type="number" min={0} max={24} placeholder={String(song.capo ?? 0)} value={entry.capoOverride ?? ""} onChange={(e) => onChange({ capoOverride: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
      <label>BPM<input type="number" min={20} max={300} placeholder={song.tempo ? String(song.tempo.bpm) : "—"} value={entry.tempoOverride ?? ""} onChange={(e) => onChange({ tempoOverride: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
      <label>Start at<select value={entry.startingSectionId ?? ""} onChange={(e) => onChange({ startingSectionId: e.target.value || undefined })}><option value="">Top of song</option>{song.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </div>}
    <label className="notes-area">Note for this slot<textarea rows={2} value={entry.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value || undefined })} placeholder="e.g. Slow intro, drop to one verse" /></label>
    <div className="row"><button onClick={onDuplicate}>Duplicate slot</button><button className="danger" onClick={onRemove}>Remove from setlist</button></div>
  </div>;
}
