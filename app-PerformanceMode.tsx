import { useCallback, useEffect, useRef, useState } from "react";
import { parseChordSymbol } from "./music-chords";
import type { PerformanceItem } from "./setlists";
import { ChordViewer } from "./app-ChordViewer";
import { SongLines } from "./app-SongLines";

const pretty = (s: string) => s.replace(/b/g, "♭").replace(/#/g, "♯");

/** Stage view: big text, one song at a time, screen kept awake, optional auto-scroll. */
export function PerformanceMode({ items, startAt = 0, title, onExit }: { items: PerformanceItem[]; startAt?: number; title: string; onExit: () => void }) {
  const [index, setIndex] = useState(Math.min(Math.max(0, startAt), Math.max(0, items.length - 1)));
  const [size, setSize] = useState(24);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [viewing, setViewing] = useState<string | null>(null);
  const [awake, setAwake] = useState<"on" | "off" | "unsupported">("off");
  const body = useRef<HTMLDivElement>(null);
  const item = items[index];

  const go = useCallback((delta: number) => {
    setIndex((i) => Math.min(items.length - 1, Math.max(0, i + delta)));
    setScrolling(false);
    body.current?.scrollTo({ top: 0 });
  }, [items.length]);

  // Keep the screen on while performing.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void>; addEventListener(t: string, f: () => void): void }> } };
    if (!nav.wakeLock) { setAwake("unsupported"); return; }
    let lock: Awaited<ReturnType<NonNullable<typeof nav.wakeLock>["request"]>> | null = null;
    let cancelled = false;
    const acquire = async () => {
      try { lock = await nav.wakeLock!.request("screen"); if (!cancelled) setAwake("on"); lock.addEventListener("release", () => { if (!cancelled) setAwake("off"); }); } catch { if (!cancelled) setAwake("off"); }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); void lock?.release(); };
  }, []);

  // Auto-scroll.
  useEffect(() => {
    if (!scrolling) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      const el = body.current;
      if (el) {
        carry += ((now - last) / 1000) * speed * 12;
        last = now;
        if (carry >= 1) { el.scrollTop += Math.floor(carry); carry -= Math.floor(carry); }
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { setScrolling(false); return; }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scrolling, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (viewing) return;
      if (e.key === "Escape") onExit();
      else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === " ") { e.preventDefault(); setScrolling((s) => !s); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onExit, viewing]);

  if (!item) return <div className="perf"><div className="perf-bar"><button onClick={onExit}>✕ Exit</button></div><p className="perf-empty">This setlist is empty.</p></div>;

  const meta = [item.keyName && `Key ${pretty(item.keyName)}`, item.capo ? `Capo ${item.capo}` : "", item.bpm ? `${item.bpm} BPM` : "", item.transpose ? `${item.transpose > 0 ? "+" : ""}${item.transpose} st` : ""].filter(Boolean);

  return <div className="perf" role="dialog" aria-label={`Performing ${title}`}>
    <div className="perf-bar">
      <button onClick={onExit} aria-label="Exit performance mode">✕</button>
      <span className="perf-count">{index + 1} / {items.length}</span>
      <span className="perf-spacer" />
      <button onClick={() => setSize((s) => Math.max(14, s - 2))} aria-label="Smaller text">A−</button>
      <button onClick={() => setSize((s) => Math.min(56, s + 2))} aria-label="Larger text">A+</button>
      <button className={scrolling ? "on" : ""} onClick={() => setScrolling((s) => !s)} aria-pressed={scrolling}>{scrolling ? "⏸ Scroll" : "▶ Scroll"}</button>
      <input type="range" min={1} max={8} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Scroll speed" />
    </div>

    <div className="perf-body" ref={body} style={{ fontSize: size }}>
      <h1 className="perf-title">{item.title}</h1>
      <div className="perf-meta">{item.artist && <span>{item.artist}</span>}{meta.map((m) => <span key={m} className="perf-chip">{m}</span>)}</div>
      {item.notes && <p className="perf-notes">📝 {item.notes}</p>}
      {item.missing ? <p className="status-warn">This song was deleted from your library. Remove it from the setlist or restore it from a backup.</p> : item.sections.map((section) => <section key={section.id} className="perf-section">
        <h2>{section.name}{section.repeatCount && section.repeatCount > 1 ? ` ×${section.repeatCount}` : ""}</h2>
        <SongLines blocks={section.blocks} className="perf-lines" onChord={(sym) => parseChordSymbol(sym) && setViewing(sym)} />
      </section>)}
      {item.songNotes && <p className="perf-notes">{item.songNotes}</p>}
    </div>

    <div className="perf-nav">
      <button onClick={() => go(-1)} disabled={index === 0}>‹ {items[index - 1]?.title ?? "Previous"}</button>
      <button className="next" onClick={() => go(1)} disabled={index === items.length - 1}>{items[index + 1]?.title ?? "Next"} ›</button>
    </div>
    {awake === "unsupported" && <div className="perf-note-small">Your browser can't keep the screen awake. Turn off auto-lock for the show.</div>}
    {viewing && <ChordViewer symbol={viewing} onClose={() => setViewing(null)} />}
  </div>;
}
