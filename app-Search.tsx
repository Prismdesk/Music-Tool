import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { chordNotes, parseChordSymbol } from "./music-chords";
import { getPitchClass } from "./music-notes";
import { functionOf, prettyNote } from "./instruments-core";
import { search, totalResults } from "./search-engine";
import type { Setlist } from "./setlists";
import type { Song } from "./songs";
import { clearHistory, recentHistory, savedChordRepo, savedShapeRepo, setlistRepo, songRepo, type HistoryItem, type SavedShape } from "./storage";
import { shapeKey } from "./instruments-stringed-shapes";
import { ChordViewer } from "./app-ChordViewer";

const pretty = (s: string) => s.replace(/b/g, "♭").replace(/#/g, "♯");
const WHERE: Record<string, string> = { chord: "chord", instrument: "instrument", title: "title", artist: "artist", tags: "tag", lyrics: "lyrics", sections: "section", notes: "notes", chords: "chords", name: "name", location: "place", date: "date", songs: "song inside" };

export function Search({ reloadKey = 0, onOpenSong, onOpenSetlist, onOpenLab }: { reloadKey?: number; onOpenSong: (id: string) => void; onOpenSetlist: (id: string) => void; onOpenLab: (symbol: string) => void }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [shapes, setShapes] = useState<SavedShape[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [viewShape, setViewShape] = useState<SavedShape | null>(null);
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([songRepo.list(), setlistRepo.list(), savedChordRepo.list(), recentHistory(undefined, 14), savedShapeRepo.list()]).then(([s, l, c, r, sh]) => {
      if (!alive) return;
      setShapes(sh); setSongs(s); setSetlists(l); setSaved(c.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((x) => x.symbol)); setRecent(r); setReady(true);
    }).catch(() => setReady(true));
    return () => { alive = false; };
  }, [reloadKey]);
  useEffect(() => { input.current?.focus(); }, []);

  const results = useMemo(() => search(deferred, { songs, setlists, savedChords: saved, savedShapes: shapes }), [deferred, songs, setlists, saved, shapes]);
  const searching = deferred.trim().length > 0;
  const favSongs = songs.filter((s) => s.favorite);
  const favSetlists = setlists.filter((l) => l.favorite);
  const songIds = new Set(songs.map((s) => s.id));
  const setlistIds = new Set(setlists.map((s) => s.id));

  function openRecent(item: HistoryItem) {
    const id = (item.payload as { id?: string } | undefined)?.id;
    if (item.kind === "chord") setViewing(item.label);
    else if (item.kind === "song" && id && songIds.has(id)) onOpenSong(id);
    else if (item.kind === "setlist" && id && setlistIds.has(id)) onOpenSetlist(id);
  }
  const usable = recent.filter((r) => r.kind === "chord" || (r.kind === "song" && songIds.has((r.payload as { id?: string })?.id ?? "")) || (r.kind === "setlist" && setlistIds.has((r.payload as { id?: string })?.id ?? "")));

  return <div className="lab search-page">
    <header className="lab-header"><div><span className="eyebrow">SEARCH</span><h1>Find a chord, song or setlist</h1><p>Try a chord like Am7, several chords like C G Am F to find songs that use them all, or words from a title, artist or lyric.</p></div></header>

    <div className="search-box">
      <input ref={input} type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }} aria-label="Search" />
      {query && <button className="ghost" onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Clear search">✕</button>}
    </div>

    {!ready && <p className="muted">Looking through your library…</p>}

    {ready && searching && <>
      {totalResults(results) === 0 && <div className="panel"><strong>Nothing found for “{deferred.trim()}”.</strong><p className="muted">Check the spelling, or try fewer words. For chords, “Cmaj7”, “CM7” and “C major 7” style names all work.</p></div>}

      {results.chords.length > 0 && <section className="panel"><div className="panel-title"><span>Chords</span><small>tap to see shapes</small></div>
        <div className="chord-hits">{results.chords.map((c) => { const p = parseChordSymbol(c.symbol)!; return <div key={c.symbol} className="chord-hit">
          <button className="chord-hit-main" onClick={() => setViewing(c.symbol)}><strong>{pretty(c.symbol)}</strong><span className="note-row">{chordNotes(p.chord).map((n) => <span key={`${n.letter}${n.accidental}`} className={`note-chip fn-${functionOf(p.chord, getPitchClass(n)) ?? "other"}`}>{prettyNote(n)}</span>)}</span></button>
          <button onClick={() => onOpenLab(c.symbol)}>Chord Lab</button></div>; })}</div></section>}

      {results.songs.length > 0 && <section className="panel"><div className="panel-title"><span>Songs</span><small>{results.songs.length}</small></div>
        <div className="result-list">{results.songs.map((h) => <button key={h.song.id} className="result" onClick={() => onOpenSong(h.song.id)}>
          <strong>{h.song.favorite ? "★ " : ""}{h.song.title}</strong>
          <small>{[h.song.artist, h.where.map((w) => WHERE[w] ?? w).join(" · ")].filter(Boolean).join(" — ")}</small>
          {h.chords.length > 0 && <span className="result-chords">{h.chords.map((c) => <em key={c}>{pretty(c)}</em>)}</span>}
        </button>)}</div></section>}

      {results.setlists.length > 0 && <section className="panel"><div className="panel-title"><span>Setlists</span><small>{results.setlists.length}</small></div>
        <div className="result-list">{results.setlists.map((h) => <button key={h.setlist.id} className="result" onClick={() => onOpenSetlist(h.setlist.id)}>
          <strong>{h.setlist.favorite ? "★ " : ""}{h.setlist.name}</strong>
          <small>{h.setlist.entries.length} songs · matched {h.where.map((w) => WHERE[w] ?? w).join(", ")}</small>
        </button>)}</div></section>}

      {results.shapes.length > 0 && <section className="panel"><div className="panel-title"><span>Your shapes</span><small>{results.shapes.length}</small></div>
        <div className="result-list">{results.shapes.map(({ shape }) => <button key={shape.id} className="result" onClick={() => setViewShape(shape)}>
          <strong>★ {shape.name}</strong>
          <small>{shape.instrumentId === "ukulele" ? "Ukulele" : "Guitar"} · {shape.symbol ? pretty(shape.symbol) : "chord"} · {shapeKey(shape.frets)}{shape.capo ? ` · capo ${shape.capo}` : ""}</small>
        </button>)}</div></section>}

      {results.savedChords.length > 0 && <section className="panel"><div className="panel-title"><span>Saved chords</span></div>
        <div className="saved-list">{results.savedChords.map((c) => <button key={c} onClick={() => setViewing(c)}>★ {pretty(c)}</button>)}</div></section>}
    </>}

    {ready && !searching && <>
      {usable.length > 0 && <section className="panel"><div className="panel-title"><span>Recent</span><button className="ghost" onClick={async () => { await clearHistory(); setRecent([]); }}>Clear</button></div>
        <div className="saved-list">{usable.map((r) => <button key={r.id} onClick={() => openRecent(r)}>{r.kind === "chord" ? "♪ " : r.kind === "song" ? "♫ " : "☰ "}{pretty(r.label)}</button>)}</div></section>}

      {(favSongs.length > 0 || favSetlists.length > 0 || saved.length > 0) && <section className="panel"><div className="panel-title"><span>Favorites</span></div>
        {saved.length > 0 && <div className="saved-list">{saved.map((c) => <button key={c} onClick={() => setViewing(c)}>★ {pretty(c)}</button>)}</div>}
        <div className="result-list">{favSongs.map((s) => <button key={s.id} className="result" onClick={() => onOpenSong(s.id)}><strong>★ {s.title}</strong><small>{s.artist || "Song"}</small></button>)}
          {favSetlists.map((l) => <button key={l.id} className="result" onClick={() => onOpenSetlist(l.id)}><strong>★ {l.name}</strong><small>Setlist · {l.entries.length} songs</small></button>)}</div></section>}

      {!usable.length && !favSongs.length && !favSetlists.length && !saved.length && <div className="panel"><strong>Nothing here yet.</strong><p className="muted">Chords you look at show up under Recent. Star a song, a setlist or a chord and it appears under Favorites.</p></div>}
    </>}

    {viewing && <ChordViewer symbol={viewing} onClose={() => setViewing(null)} onOpenLab={onOpenLab} />}
    {viewShape?.symbol && <ChordViewer symbol={viewShape.symbol} onClose={() => setViewShape(null)} onOpenLab={onOpenLab} defaultInstrument={viewShape.instrumentId === "ukulele" ? "ukulele" : "guitar"} defaultTuningId={viewShape.tuningId} defaultCapo={viewShape.capo} startShapeId={viewShape.id} />}
  </div>;
}
