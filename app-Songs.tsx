import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseChordSymbol, transposeSymbol } from "./music-chords";
import { formatNote } from "./music-notes";
import { NOTE_LETTERS, type NoteLetter } from "./music-notes";
import { parseChordSheet, serializeSections, songToChordPro, type Song, type SongBlock, type SongSection } from "./songs";
import { recordRecent, songRepo } from "./storage";
import { ChordViewer } from "./app-ChordViewer";
import { SongLines } from "./app-SongLines";

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${crypto.randomUUID()}`;
const roots: NoteLetter[] = [...NOTE_LETTERS];

const emptySong = (): Song => ({
  id: uid("song"), title: "Untitled Song", transposition: 0, tags: [], favorite: false, createdAt: now(), updatedAt: now(),
  sections: [{ id: uid("section"), name: "Verse", blocks: [{ type: "text", id: uid("block"), text: "" }] }]
});

export function Songs({ reloadKey = 0, openId = null, onOpenLab }: { reloadKey?: number; openId?: string | null; onOpenLab?: (symbol: string) => void }) {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"blocks" | "text" | "preview">("text");
  const [draft, setDraft] = useState("");
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const pending = useRef(new Map<string, Song>());
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const batch = [...pending.current.values()];
    pending.current.clear();
    if (!batch.length) return;
    try { await songRepo.saveMany(batch); setSaveError(""); } catch { setSaveError("Couldn't save to this device. Export a backup if you have unsaved work."); }
  }, []);

  useEffect(() => {
    let alive = true;
    songRepo.list().then((list) => {
      if (!alive) return;
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setSongs(list);
      setSelectedId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null));
    });
    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", flush); void flush(); };
  }, [flush]);

  // Jump to a song chosen elsewhere (e.g. from Search).
  useEffect(() => { if (openId && songs?.some((x) => x.id === openId)) setSelectedId(openId); }, [openId, songs]);

  const list = songs ?? [];
  const loaded = songs !== null;
  const selected = list.find((s) => s.id === selectedId) ?? null;
  // Load the text editor with whichever song is open (only when the song changes, not on every keystroke).
  useEffect(() => { if (selected) setDraft(serializeSections(selected.sections)); }, [selectedId, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = useMemo(() => list.filter((s) => `${s.title} ${s.artist ?? ""} ${s.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [list, query]);

  function commit(song: Song) {
    setSongs((cur) => (cur ?? []).map((s) => (s.id === song.id ? song : s)));
    pending.current.set(song.id, song);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 400);
  }
  function update(patch: Partial<Song>) { if (selected) commit({ ...selected, ...patch, updatedAt: now() }); }
  function updateSection(sectionId: string, fn: (s: SongSection) => SongSection) { if (selected) update({ sections: selected.sections.map((s) => (s.id === sectionId ? fn(s) : s)) }); }

  async function addSong() {
    const song = emptySong();
    setSongs((cur) => [song, ...(cur ?? [])]);
    setSelectedId(song.id);
    await songRepo.save(song);
  }
  async function deleteSong() {
    if (!selected || !confirm(`Delete “${selected.title}”? This can't be undone.`)) return;
    pending.current.delete(selected.id);
    await songRepo.remove(selected.id);
    const next = list.filter((s) => s.id !== selected.id);
    setSongs(next);
    setSelectedId(next[0]?.id ?? null);
  }

  const lastSection = selected?.sections[selected.sections.length - 1];
  function addBlock(block: SongBlock, sectionId = lastSection?.id) {
    if (!selected) return;
    if (!sectionId) { update({ sections: [{ id: uid("section"), name: "Verse", blocks: [block] }] }); return; }
    updateSection(sectionId, (s) => ({ ...s, blocks: [...s.blocks, block] }));
  }
  function addSection() { if (selected) update({ sections: [...selected.sections, { id: uid("section"), name: "Chorus", blocks: [] }] }); }
  function removeBlock(sectionId: string, blockId: string) { updateSection(sectionId, (s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== blockId) })); }
  function moveBlock(sectionId: string, blockId: string, dir: -1 | 1) {
    updateSection(sectionId, (s) => {
      const i = s.blocks.findIndex((b) => b.id === blockId), j = i + dir;
      if (i < 0 || j < 0 || j >= s.blocks.length) return s;
      const blocks = [...s.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...s, blocks };
    });
  }
  function editBlock(sectionId: string, blockId: string, value: string) {
    updateSection(sectionId, (s) => ({ ...s, blocks: s.blocks.map((b) => (b.id !== blockId ? b : b.type === "text" ? { ...b, text: value } : { ...b, symbol: value })) }));
  }
  function transpose(amount: number) {
    if (!selected) return;
    const sections = selected.sections.map((sec) => ({
      ...sec,
      blocks: sec.blocks.map((b): SongBlock => (b.type === "chord" ? { ...b, symbol: transposeSymbol(b.symbol, amount) } : b))
    }));
    update({ transposition: selected.transposition + amount, sections });
    if (mode === "text") setDraft(serializeSections(sections));
  }

  function switchMode(next: "blocks" | "text" | "preview") {
    if (next === "text" && selected) setDraft(serializeSections(selected.sections));
    setMode(next);
  }

  function editDraft(value: string) {
    setDraft(value);
    if (!selected) return;
    const parsed = parseChordSheet(value, { chordsOverLyrics: false, reuse: selected.sections });
    update({ sections: parsed.sections });
  }

  function insertAtCursor(text: string) {
    const el = textRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + text + draft.slice(end);
    editDraft(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length); });
  }

  /** Chords already used in the song, then the main chords of its key, as one-tap inserts. */
  const palette = useMemo(() => {
    if (!selected) return [] as string[];
    const used: string[] = [];
    for (const sec of selected.sections) for (const b of sec.blocks) if (b.type === "chord" && !used.includes(b.symbol)) used.push(b.symbol);
    const key = selected.originalKey;
    if (!key) return used.slice(0, 16);
    const tonic = formatNote({ ...key.root, octave: undefined });
    const steps: [number, string][] = key.mode === "major"
      ? [[0, ""], [2, "m"], [4, "m"], [5, ""], [7, ""], [9, "m"]]
      : [[0, "m"], [3, ""], [5, "m"], [7, "m"], [8, ""], [10, ""]];
    const shift = selected.transposition;
    const diatonic = steps.map(([semi, quality]) => `${transposeSymbol(tonic, semi + shift)}${quality}`);
    return [...used, ...diatonic.filter((c) => !used.includes(c))].slice(0, 18);
  }, [selected]);

  function runImport() {
    const parsed = parseChordSheet(importText);
    if (!parsed.sections.length) return;
    const now2 = now();
    const song: Song = {
      id: uid("song"), title: parsed.meta.title || "Imported Song", artist: parsed.meta.artist, originalKey: parsed.meta.key,
      tempo: parsed.meta.bpm ? { bpm: parsed.meta.bpm } : undefined, capo: parsed.meta.capo, transposition: 0, tags: [], favorite: false,
      sections: parsed.sections, createdAt: now2, updatedAt: now2
    };
    setSongs((cur) => [song, ...(cur ?? [])]);
    setSelectedId(song.id);
    setDraft(serializeSections(song.sections));
    setMode("preview");
    setImporting(false);
    setImportText("");
    void songRepo.save(song);
  }
  const importPreview = useMemo(() => (importText.trim() ? parseChordSheet(importText) : null), [importText]);

  function exportSong() {
    if (!selected) return;
    const blob = new Blob([songToChordPro(selected)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selected.title.replace(/[^\w\- ]+/g, "").trim() || "song"}.cho`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  if (!songs) return <div className="songs-page"><p className="muted">Opening your songs…</p></div>;

  return <div className="songs-page">
    <header className="lab-header"><div><span className="eyebrow">SONGS</span><h1>Write, organize, and transpose songs</h1><p>Tap any chord in Preview to see how to play it on guitar, ukulele or piano.</p></div><div className="header-actions"><button onClick={() => setImporting(true)}>Import…</button><button className="primary" onClick={addSong}>+ New Song</button></div></header>
    {saveError && <p className="status-warn">{saveError}</p>}
    <div className="songs-layout">
      <aside className="panel song-list">
        <input placeholder="Search songs, artists, tags" value={query} onChange={(e) => setQuery(e.target.value)} />
        {visible.map((song) => <button key={song.id} className={song.id === selectedId ? "song-item active" : "song-item"} onClick={() => { setSelectedId(song.id); void recordRecent("song", song.title, { id: song.id }); }}><strong>{song.favorite ? "★ " : ""}{song.title}</strong><small>{song.artist || "No artist"}</small></button>)}
        {!visible.length && <p className="muted">{list.length ? "No songs match." : "No songs yet."}</p>}
      </aside>
      {selected ? <main className="panel song-editor">
        <div className="editor-toolbar">
          <div><input className="title-input" value={selected.title} onChange={(e) => update({ title: e.target.value })} /><input className="sub-input" placeholder="Artist" value={selected.artist ?? ""} onChange={(e) => update({ artist: e.target.value })} /></div>
          <div className="toolbar-actions"><button onClick={() => update({ favorite: !selected.favorite })}>{selected.favorite ? "★ Favorite" : "☆ Favorite"}</button><button onClick={exportSong}>Export</button><button className="danger" onClick={deleteSong}>Delete</button></div>
        </div>
        <div className="metadata-grid">
          <label>Key<select value={selected.originalKey ? `${selected.originalKey.root.letter}-${selected.originalKey.mode}` : ""} onChange={(e) => { const [letter, mode] = e.target.value.split("-"); update({ originalKey: letter ? { root: { letter: letter as NoteLetter, accidental: 0 }, mode: mode as "major" | "minor" } : undefined }); }}><option value="">Not set</option>{roots.flatMap((r) => [<option key={`${r}-major`} value={`${r}-major`}>{r} major</option>, <option key={`${r}-minor`} value={`${r}-minor`}>{r} minor</option>])}</select></label>
          <label>BPM<input type="number" min="20" max="300" value={selected.tempo?.bpm ?? ""} onChange={(e) => update({ tempo: e.target.value ? { bpm: Number(e.target.value), marking: selected.tempo?.marking } : undefined })} /></label>
          <label>Capo<input type="number" min="0" max="24" value={selected.capo ?? 0} onChange={(e) => update({ capo: Number(e.target.value) })} /></label>
          <label>Tags<input placeholder="worship, acoustic" value={selected.tags.join(", ")} onChange={(e) => update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></label>
        </div>
        <div className="song-tools">
          {mode === "blocks" && <><button onClick={() => addBlock({ type: "text", id: uid("block"), text: "" })}>+ Lyric/Text</button>
          <button onClick={() => addBlock({ type: "chord", id: uid("block"), symbol: "C" })}>+ Chord</button></>}
          {mode === "text" && <button onClick={() => editDraft(`${draft.replace(/\s+$/, "")}\n\n[Chorus]\n`)}>+ Section</button>}
          {mode === "blocks" && <button onClick={addSection}>+ Section</button>}
          <span>Transpose: {selected.transposition >= 0 ? "+" : ""}{selected.transposition}</span>
          <button onClick={() => transpose(-1)} aria-label="Transpose down">−</button><button onClick={() => transpose(1)} aria-label="Transpose up">+</button>
          <span className="seg" role="tablist" aria-label="View">{(["text", "blocks", "preview"] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "nav-active" : ""} onClick={() => switchMode(m)}>{m === "text" ? "Write" : m === "blocks" ? "Blocks" : "Preview"}</button>)}</span>
        </div>

        {mode === "preview" && <div className="sections song-preview">
          {selected.sections.map((section) => <section className="song-section" key={section.id}>
            <div className="section-heading"><strong>{section.name}</strong></div>
            <SongLines blocks={section.blocks} onChord={setViewing} />
          </section>)}
          {!selected.sections.length && <p className="muted">Nothing to show yet. Switch to Write and add some lyrics.</p>}
        </div>}

        {mode === "text" && <div className="write-pane">
          {palette.length > 0 && <div className="chord-palette" aria-label="Insert a chord">{palette.map((c) => <button key={c} onClick={() => insertAtCursor(`[${c}]`)}>{c.replace(/b/g, "♭").replace(/#/g, "♯")}</button>)}</div>}
          <textarea ref={textRef} className="write-area" spellCheck={false} value={draft} onChange={(e) => editDraft(e.target.value)} placeholder={"[Verse]\n[G]Amazing [C]grace, how [G]sweet the sound\n\n[Chorus]\n[Em]..."} aria-label="Song text" />
          <p className="shape-hint">Put chords in square brackets right before the word they land on. A line like [Chorus] starts a new section. Tap a chord above to insert it at the cursor.</p>
        </div>}

        {mode === "blocks" && <div className="sections">
          {selected.sections.map((section) => <section className="song-section" key={section.id}>
            <div className="section-heading"><input value={section.name} onChange={(e) => updateSection(section.id, (s) => ({ ...s, name: e.target.value }))} /><span>{section.blocks.length} blocks</span></div>
            {section.blocks.map((block) => <div className="song-block" key={block.id}>
              <span className="block-type">{block.type === "text" ? "LYRIC" : "CHORD"}</span>
              {block.type === "text"
                ? <textarea rows={1} value={block.text} placeholder="Lyrics" onChange={(e) => editBlock(section.id, block.id, e.target.value)} />
                : <input className={!parseChordSymbol(block.symbol) ? "invalid" : ""} value={block.symbol} placeholder="e.g. Am7, F#m, Bb/D" onChange={(e) => editBlock(section.id, block.id, e.target.value)} />}
              {block.type === "chord" && <button className="mini" onClick={() => setViewing(block.symbol)} aria-label="Show chord shapes" disabled={!parseChordSymbol(block.symbol)}>♪</button>}
              <button className="mini" onClick={() => moveBlock(section.id, block.id, -1)} aria-label="Move up">↑</button>
              <button className="mini" onClick={() => moveBlock(section.id, block.id, 1)} aria-label="Move down">↓</button>
              <button className="mini" onClick={() => removeBlock(section.id, block.id)} aria-label="Remove block">✕</button>
            </div>)}
          </section>)}
        </div>}
        <label className="notes-area">Song Notes<textarea value={selected.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} placeholder="Performance notes, arrangement notes, reminders..." /></label>
      </main> : <main className="panel empty"><h2>No songs yet</h2><p>Create your first song to start building a structured song document.</p><button className="primary" onClick={addSong}>Create Song</button></main>}
    </div>
    {importing && <div className="viewer-backdrop" onClick={() => setImporting(false)} role="presentation"><div className="viewer" role="dialog" aria-modal="true" aria-label="Import a song" onClick={(e) => e.stopPropagation()}>
      <div className="viewer-head"><div><h2>Import a song</h2><p className="muted">Paste a chord sheet. It can have chords above the lyrics, or ChordPro like [G]Amazing [C]grace. Titles, key and capo lines such as {"{key: G}"} are picked up too.</p></div><button className="ghost" onClick={() => setImporting(false)} aria-label="Close">✕</button></div>
      <textarea className="write-area" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={"Verse 1\nG        C\nAmazing grace, how sweet\n..."} aria-label="Chord sheet" autoFocus />
      {importPreview && <p className={importPreview.sections.length ? "status-ok" : "status-warn"}>{importPreview.sections.length ? `Found ${importPreview.sections.length} ${importPreview.sections.length === 1 ? "section" : "sections"} and ${importPreview.chordCount} chords${importPreview.meta.title ? ` for “${importPreview.meta.title}”` : ""}.` : "Nothing readable yet."}{importPreview.unrecognised.length ? ` ${importPreview.unrecognised.join(", ")} won't show shapes yet.` : ""}</p>}
      <div className="row"><button className="primary" disabled={!importPreview?.sections.length} onClick={runImport}>Add as new song</button><button onClick={() => setImporting(false)}>Cancel</button></div>
    </div></div>}
    {viewing && <ChordViewer symbol={viewing} onClose={() => setViewing(null)} onOpenLab={onOpenLab} />}
  </div>;
}
