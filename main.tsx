import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./app-styles.css";
import { ChordLab } from "./app-ChordLab";
import { Songs } from "./app-Songs";
import { Settings } from "./app-Settings";
import { Setlists } from "./app-Setlists";
import { Search } from "./app-Search";
import { registerServiceWorker } from "./pwa";
import { DEFAULT_SETTINGS, migrateLegacySongs, savedChordRepo, settingsRepo, type AppSettings } from "./storage";

type View = "chords" | "songs" | "setlists" | "search" | "settings";

function App() {
  const [view, setView] = useState<View>("chords");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [savedChords, setSavedChords] = useState<string[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [fatal, setFatal] = useState("");
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [openSetlistId, setOpenSetlistId] = useState<string | null>(null);
  const [labChord, setLabChord] = useState<{ symbol: string; n: number } | undefined>(undefined);
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);

  const load = useCallback(async () => {
    try {
      await migrateLegacySongs();
      setSettings(await settingsRepo.get());
      setSavedChords((await savedChordRepo.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((c) => c.symbol));
    } catch {
      setFatal("This browser isn't letting the app store data (private browsing can do this). Chords still work, but songs can't be saved.");
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { registerServiceWorker((apply) => setApplyUpdate(() => apply)); }, []);

  async function toggleSavedChord(symbol: string) {
    const all = await savedChordRepo.list();
    const existing = all.find((c) => c.symbol === symbol);
    if (existing) await savedChordRepo.remove(existing.id);
    else await savedChordRepo.save({ id: `chord-${crypto.randomUUID()}`, symbol, createdAt: new Date().toISOString() });
    setSavedChords((await savedChordRepo.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((c) => c.symbol));
  }

  const openSong = (id: string) => { setOpenSongId(id); setView("songs"); };
  const openSetlist = (id: string) => { setOpenSetlistId(id); setView("setlists"); };
  const openLab = (symbol: string) => { setLabChord((cur) => ({ symbol, n: (cur?.n ?? 0) + 1 })); setView("chords"); };

  if (!settings) return <div className="loading">Opening your music library…</div>;

  return <>
    <nav className="topbar"><strong>Music Toolbox</strong>
      <button className={view === "chords" ? "nav-active" : ""} onClick={() => setView("chords")}>Chord Lab</button>
      <button className={view === "songs" ? "nav-active" : ""} onClick={() => setView("songs")}>Songs</button>
      <button className={view === "setlists" ? "nav-active" : ""} onClick={() => setView("setlists")}>Setlists</button>
      <button className={view === "search" ? "nav-active" : ""} onClick={() => setView("search")}>Search</button>
      <button className={view === "settings" ? "nav-active" : ""} onClick={() => setView("settings")}>Settings</button>
    </nav>
    {fatal && <p className="status-warn" role="alert">{fatal}</p>}
    <main className="app-shell">
      {view === "chords" && <ChordLab savedChords={savedChords} onSaveChord={toggleSavedChord} defaultInstrument={settings.defaultInstrument} fretCount={settings.fretCount} loadSymbol={labChord} />}
      {view === "songs" && <Songs reloadKey={dataVersion} openId={openSongId} onOpenLab={openLab} />}
      {view === "setlists" && <Setlists reloadKey={dataVersion} openId={openSetlistId} />}
      {view === "search" && <Search reloadKey={dataVersion} onOpenSong={openSong} onOpenSetlist={openSetlist} onOpenLab={openLab} />}
      {view === "settings" && <Settings settings={settings} onSettings={setSettings} onDataChanged={() => { setDataVersion((v) => v + 1); void load(); }} />}
    </main>
    {applyUpdate && <div className="update-banner" role="status"><span>A new version is ready.</span><button onClick={applyUpdate}>Update now</button></div>}
  </>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
