import { useEffect, useState } from "react";
import {
  backupFileName, clearAllUserData, createBackup, importBackup, libraryStats, parseBackup, previewImport, settingsRepo,
  type AppSettings, type BackupFile, type ConflictStrategy, type ImportReport
} from "./storage";

const STRATEGIES: { id: ConflictStrategy; label: string; help: string }[] = [
  { id: "skip", label: "Keep mine", help: "Items that already exist here are left alone." },
  { id: "copy", label: "Keep both", help: "Conflicting items are added as “imported copy”." },
  { id: "overwrite", label: "Use the backup", help: "Items from the backup replace the ones here." }
];

function describe(r: ImportReport): string {
  const parts = [`${r.added} new`];
  if (r.skipped) parts.push(`${r.skipped} skipped`);
  if (r.copied) parts.push(`${r.copied} added as copies`);
  if (r.overwritten) parts.push(`${r.overwritten} replaced`);
  if (r.invalid) parts.push(`${r.invalid} unreadable and ignored`);
  return parts.join(" · ");
}

export function Settings({ settings, onSettings, onDataChanged }: { settings: AppSettings; onSettings: (s: AppSettings) => void; onDataChanged: () => void }) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof libraryStats>> | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<{ file: BackupFile; name: string; preview: ImportReport } | null>(null);
  const [strategy, setStrategy] = useState<ConflictStrategy>("skip");
  const [persisted, setPersisted] = useState<boolean | null>(null);

  const refresh = () => libraryStats().then(setStats);
  useEffect(() => { void refresh(); navigator.storage?.persisted?.().then(setPersisted).catch(() => undefined); }, []);

  async function save(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    onSettings(next);
    await settingsRepo.save(next);
  }

  async function exportData() {
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = backupFileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setMessage({ ok: true, text: "Backup downloaded. Keep it somewhere safe, like your cloud drive." });
    } catch { setMessage({ ok: false, text: "Couldn't create the backup." }); }
  }

  function chooseFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const parsed = parseBackup(await f.text());
      if (!parsed.ok) { setPending(null); setMessage({ ok: false, text: parsed.error }); return; }
      setMessage(null);
      setPending({ file: parsed.file, name: f.name, preview: await previewImport(parsed.file) });
    };
    input.click();
  }

  async function runImport() {
    if (!pending) return;
    try {
      const report = await importBackup(pending.file, strategy);
      setPending(null);
      setMessage({ ok: true, text: `Import finished: ${describe(report)}.` });
      await refresh();
      onDataChanged();
    } catch { setMessage({ ok: false, text: "The import failed, so nothing was changed." }); }
  }

  async function wipe() {
    if (!confirm("Delete ALL songs, setlists, saved chords and settings from this device? Export a backup first if you might want them back.")) return;
    if (!confirm("Really delete everything? This can't be undone.")) return;
    await clearAllUserData();
    onSettings(await settingsRepo.get());
    await refresh();
    onDataChanged();
    setMessage({ ok: true, text: "Everything on this device was deleted." });
  }

  async function keepStorage() {
    const ok = await navigator.storage?.persist?.();
    setPersisted(Boolean(ok));
  }

  return <div className="lab">
    <header className="lab-header"><div><span className="eyebrow">SETTINGS</span><h1>Data &amp; preferences</h1><p>Your music stays on this device. Export a backup to move it or keep it safe.</p></div></header>
    {message && <p className={message.ok ? "status-ok" : "status-warn"} role="status">{message.text}</p>}
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-title"><span>Library</span><small>On this device</small></div>
        <div className="stat-row">{stats ? <>
          <div><b>{stats.songs}</b><span>songs</span></div><div><b>{stats.setlists}</b><span>setlists</span></div><div><b>{stats.savedChords}</b><span>saved chords</span></div><div><b>{stats.savedShapes}</b><span>saved shapes</span></div>
        </> : <span>Loading…</span>}</div>
        {persisted === false && <p className="hint">The browser may clear site data when space is low. <button className="ghost" onClick={keepStorage}>Ask to keep it</button></p>}
        {persisted === true && <p className="hint">Protected from automatic clean-up.</p>}
      </section>

      <section className="panel">
        <div className="panel-title"><span>Preferences</span></div>
        <label>Note names<select value={settings.noteNaming} onChange={(e) => save({ noteNaming: e.target.value as AppSettings["noteNaming"] })}><option value="automatic">Automatic</option><option value="sharps">Sharps (C♯)</option><option value="flats">Flats (D♭)</option></select></label>
        <label>Opens on<select value={settings.defaultInstrument} onChange={(e) => save({ defaultInstrument: e.target.value as AppSettings["defaultInstrument"] })}><option value="guitar">Guitar</option><option value="ukulele">Ukulele</option><option value="piano">Piano</option></select></label>
        <label>Frets shown<input type="number" min={5} max={24} value={settings.fretCount} onChange={(e) => save({ fretCount: Math.min(24, Math.max(5, Number(e.target.value) || 12)) })} /></label>
      </section>

      <section className="panel">
        <div className="panel-title"><span>Backup</span><small>Readable JSON file</small></div>
        <div className="row"><button className="primary" onClick={exportData}>Export backup</button> <button onClick={chooseFile}>Import backup…</button></div>
        {pending && <div className="import-box">
          <strong>{pending.name}</strong>
          <p className="hint">If you import now: {describe(pending.preview)}.</p>
          {pending.preview.skipped + pending.preview.copied + pending.preview.overwritten + (pending.preview.perStore.songs?.conflicts ?? 0) >= 0 && <>
            <p className="hint">When something already exists here:</p>
            {STRATEGIES.map((s) => <label key={s.id} className="radio"><input type="radio" name="strategy" checked={strategy === s.id} onChange={() => setStrategy(s.id)} /> <b>{s.label}</b> — {s.help}</label>)}
          </>}
          <div className="row"><button className="primary" onClick={runImport}>Import</button><button onClick={() => setPending(null)}>Cancel</button></div>
          <p className="hint">The import is all-or-nothing: if anything goes wrong, nothing changes.</p>
        </div>}
      </section>

      <section className="panel">
        <div className="panel-title"><span>Danger zone</span></div>
        <p className="hint">Remove everything stored by this app on this device.</p>
        <button className="danger" onClick={wipe}>Delete all my data</button>
      </section>
    </div>
  </div>;
}
