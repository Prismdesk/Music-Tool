import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ChordLab } from "./app-ChordLab";
import { ChordViewer } from "./app-ChordViewer";
import { StringedView } from "./instruments-stringed-StringedView";
import { PianoView } from "./instruments-piano-PianoView";
import { parseChordSymbol } from "./music-chords";
import { TUNINGS } from "./instruments-core-catalog";

describe("components render without throwing", () => {
  it("Chord Lab on each instrument", () => {
    for (const inst of ["piano", "guitar", "ukulele"] as const) {
      const html = renderToString(<ChordLab defaultInstrument={inst} />);
      expect(html).toContain("CHORD LAB");
    }
  });
  it("shows flats and the right shape for a guitar chord", () => {
    const html = renderToString(<StringedView chord={parseChordSymbol("Bbmaj7")!.chord} tuning={TUNINGS.find(t => t.id === "guitar-standard")!} />);
    expect(html).toContain("B♭");
    expect(html).not.toContain("A♯");
    const c = renderToString(<StringedView chord={parseChordSymbol("C")!.chord} tuning={TUNINGS.find(t => t.id === "guitar-standard")!} />);
    expect(c).toContain("x32010");
  });
  it("piano colours chord tones", () => {
    const html = renderToString(<PianoView chord={parseChordSymbol("Cmaj7")!.chord} />);
    expect(html).toContain("fn-root");
    expect(html).toContain("fn-seventh");
  });
  it("chord viewer handles good and bad symbols", () => {
    expect(renderToString(<ChordViewer symbol="F#m7" onClose={() => {}} />)).toContain("F♯m7");
    expect(renderToString(<ChordViewer symbol="Zzz" onClose={() => {}} />)).toContain("isn&#x27;t a chord");
  });
});

import { PerformanceMode } from "./app-PerformanceMode";
import { resolveEntry } from "./setlists";

describe("performance mode", () => {
  const song: any = { id: "s", title: "Test Song", transposition: 0, tags: [], favorite: false, createdAt: "", updatedAt: "", sections: [{ id: "v", name: "Verse", blocks: [{ type: "chord", id: "1", symbol: "Am7" }, { type: "text", id: "2", text: "hello world" }] }] };
  it("shows title, chords and navigation", () => {
    const items = [resolveEntry({ id: "e1", songId: "s", order: 0, transpose: 2 }, song), resolveEntry({ id: "e2", songId: "gone", order: 1 }, undefined)];
    const html = renderToString(<PerformanceMode items={items} title="Gig" onExit={() => {}} />);
    expect(html).toContain("Test Song");
    expect(html).toContain("Bm7");
    expect(html).toContain("hello world");
    expect(html.replace(/<!-- -->/g, "")).toContain("1 / 2");
    expect(html).toContain("Song not found");
  });
  it("handles an empty setlist", () => {
    expect(renderToString(<PerformanceMode items={[]} title="Empty" onExit={() => {}} />)).toContain("empty");
  });
});

import { SongLines } from "./app-SongLines";

describe("song lines", () => {
  it("draws chords above the words they belong to", () => {
    const html = renderToString(<SongLines blocks={[{ type: "chord", id: "1", symbol: "Bb" }, { type: "text", id: "2", text: "Amazing\ngrace" }, { type: "chord", id: "3", symbol: "Cadd11" }]} />);
    expect(html).toContain("B♭");
    expect(html).toContain("Amazing");
    expect(html).toContain("sl-chord bad");
    expect((html.match(/sl-line/g) ?? []).length).toBe(2);
  });
});

import { Search } from "./app-Search";

describe("search screen", () => {
  it("renders its first frame with a search box", () => {
    const html = renderToString(<Search onOpenSong={() => {}} onOpenSetlist={() => {}} onOpenLab={() => {}} />);
    expect(html).toContain("Find a chord, song or setlist");
    expect(html).toContain('type="search"');
  });
  it("chord viewer offers to open the Chord Lab only when asked", () => {
    expect(renderToString(<ChordViewer symbol="Am7" onClose={() => {}} onOpenLab={() => {}} />)).toContain("Open in Chord Lab");
    expect(renderToString(<ChordViewer symbol="Am7" onClose={() => {}} />)).not.toContain("Open in Chord Lab");
  });
  it("chord lab can start from a named chord", () => {
    const html = renderToString(<ChordLab loadSymbol={{ symbol: "Bbmaj7", n: 1 }} />);
    expect(html).toContain("CHORD LAB");
  });
});

describe("saving shapes", () => {
  it("the fretboard offers to save a shape", () => {
    const html = renderToString(<StringedView chord={parseChordSymbol("Am")!.chord} tuning={TUNINGS.find(t => t.id === "guitar-standard")!} />);
    expect(html).toContain("Save this shape");
    expect(html).toContain("x02210");
  });
  it("the popup can start on a saved shape without crashing", () => {
    expect(renderToString(<ChordViewer symbol="C" defaultInstrument="ukulele" defaultTuningId="ukulele-high-g" defaultCapo={2} startShapeId="nope" onClose={() => {}} />)).toContain("Ukulele");
  });
});
