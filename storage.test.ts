import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllUserData, createBackup, DB_VERSION, importBackup, libraryStats, migrateLegacySongs, parseBackup, previewImport,
  resetDatabase, savedChordRepo, setlistRepo, settingsRepo, songRepo, addHistory, historyRepo, favoriteRepo, DEFAULT_SETTINGS
} from "./storage";
import { LEGACY_SONGS_KEY, upgradeLegacySong, type Song } from "./songs";
import type { Setlist } from "./setlists";

const song = (id: string, title = id): Song => ({
  id, title, transposition: 0, tags: [], favorite: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  sections: [{ id: "s1", name: "Verse", blocks: [{ type: "chord", id: "b1", symbol: "Am7" }, { type: "text", id: "b2", text: "la la" }] }]
});
const setlist = (id: string, songIds: string[]): Setlist => ({
  id, name: id, favorite: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  entries: songIds.map((songId, i) => ({ id: `e${i}`, songId, order: i }))
});

beforeEach(async () => { await resetDatabase(true); });

describe("repositories", () => {
  it("saves, reads, lists and removes", async () => {
    await songRepo.save(song("a"));
    await songRepo.saveMany([song("b"), song("c")]);
    expect((await songRepo.list()).map((s) => s.id).sort()).toEqual(["a", "b", "c"]);
    expect((await songRepo.get("b"))?.title).toBe("b");
    expect(await songRepo.get("zzz")).toBeUndefined();
    await songRepo.remove("b");
    expect(await songRepo.count()).toBe(2);
  });
  it("updates in place when the id matches", async () => {
    await songRepo.save(song("a", "One"));
    await songRepo.save(song("a", "Two"));
    expect(await songRepo.count()).toBe(1);
    expect((await songRepo.get("a"))?.title).toBe("Two");
  });
  it("uses version 1 of the schema", () => expect(DB_VERSION).toBe(1));
});

describe("settings", () => {
  it("returns defaults, merges saved values, and keeps flags apart", async () => {
    expect(await settingsRepo.get()).toEqual(DEFAULT_SETTINGS);
    await settingsRepo.save({ ...DEFAULT_SETTINGS, noteNaming: "flats", fretCount: 15 });
    expect(await settingsRepo.get()).toMatchObject({ noteNaming: "flats", fretCount: 15 });
    expect(await settingsRepo.getFlag("x")).toBe(false);
    await settingsRepo.setFlag("x");
    expect(await settingsRepo.getFlag("x")).toBe(true);
    expect((await settingsRepo.get()).fretCount).toBe(15);
  });
});

describe("history and favourites", () => {
  it("keeps newest first, drops duplicates, and caps the list", async () => {
    await addHistory({ kind: "chord", label: "Am" });
    await addHistory({ kind: "chord", label: "C" });
    await addHistory({ kind: "chord", label: "Am" });
    const labels = (await historyRepo.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((h) => h.label);
    expect(labels).toEqual(["Am", "C"]);
    for (let i = 0; i < 130; i += 1) await addHistory({ kind: "chord", label: `X${i}` });
    expect(await historyRepo.count()).toBeLessThanOrEqual(100);
    await favoriteRepo.save({ id: "f1", entityType: "song", entityId: "a", createdAt: "now" });
    expect(await favoriteRepo.count()).toBe(1);
  });
});

describe("backup export", () => {
  it("exports every store as a versioned snapshot", async () => {
    await songRepo.save(song("a"));
    await setlistRepo.save(setlist("L", ["a"]));
    await savedChordRepo.save({ id: "c1", symbol: "Dm7", createdAt: "now" });
    const b = await createBackup();
    expect(b).toMatchObject({ app: "music-toolbox", backupVersion: 1 });
    expect(b.data.songs).toHaveLength(1);
    expect(b.data.setlists[0].entries[0].songId).toBe("a");
    expect(b.data.savedChords[0].symbol).toBe("Dm7");
    expect(b.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
  });
});

describe("backup validation", () => {
  it("rejects things that are not backups", () => {
    expect(parseBackup("not json")).toMatchObject({ ok: false });
    expect(parseBackup("{}")).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ app: "other", backupVersion: 1, data: {} }))).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ app: "music-toolbox", backupVersion: 99, data: {} }))).toMatchObject({ ok: false, error: expect.stringContaining("newer") });
    expect(parseBackup(JSON.stringify({ app: "music-toolbox", backupVersion: 1, data: { songs: "nope" } }))).toMatchObject({ ok: false });
  });
  it("accepts a round-tripped backup", async () => {
    await songRepo.save(song("a"));
    const r = parseBackup(JSON.stringify(await createBackup()));
    expect(r.ok).toBe(true);
  });
});

describe("backup import", () => {
  async function backupOf(songs: Song[], setlists: Setlist[] = []) {
    await resetDatabase(true);
    await songRepo.saveMany(songs);
    await setlistRepo.saveMany(setlists);
    const file = await createBackup();
    await resetDatabase(true);
    return file;
  }

  it("imports into an empty library", async () => {
    const file = await backupOf([song("a"), song("b")], [setlist("L", ["a", "b"])]);
    const report = await importBackup(file, "skip");
    expect(report).toMatchObject({ added: 3, skipped: 0, overwritten: 0, copied: 0, invalid: 0 });
    expect(await libraryStats()).toMatchObject({ songs: 2, setlists: 1 });
  });

  it("skip keeps what you have", async () => {
    const file = await backupOf([song("a", "From backup")]);
    await songRepo.save(song("a", "Mine"));
    const report = await importBackup(file, "skip");
    expect(report.skipped).toBe(1);
    expect((await songRepo.get("a"))?.title).toBe("Mine");
  });

  it("overwrite lets the backup win", async () => {
    const file = await backupOf([song("a", "From backup")]);
    await songRepo.save(song("a", "Mine"));
    const report = await importBackup(file, "overwrite");
    expect(report.overwritten).toBe(1);
    expect((await songRepo.get("a"))?.title).toBe("From backup");
  });

  it("copy keeps both and repoints setlists at the copied songs", async () => {
    const file = await backupOf([song("a", "Theirs")], [setlist("L", ["a"])]);
    await songRepo.save(song("a", "Mine"));
    const report = await importBackup(file, "copy");
    expect(report.copied).toBeGreaterThanOrEqual(1);
    const songs = await songRepo.list();
    expect(songs).toHaveLength(2);
    const copy = songs.find((s) => s.id !== "a")!;
    expect(copy.title).toBe("Theirs (imported copy)");
    expect((await songRepo.get("a"))?.title).toBe("Mine");
    const imported = (await setlistRepo.list())[0];
    expect(imported.entries[0].songId).toBe(copy.id);
  });

  it("skips damaged records instead of failing", async () => {
    const file = await backupOf([song("a")]);
    (file.data.songs as any[]).push({ id: "bad" }, "junk", { title: "no id", sections: [] });
    const report = await importBackup(file, "skip");
    expect(report.added).toBe(1);
    expect(report.invalid).toBe(3);
    expect(await songRepo.count()).toBe(1);
  });

  it("previews without writing", async () => {
    const file = await backupOf([song("a"), song("b")]);
    await songRepo.save(song("a"));
    const preview = await previewImport(file);
    expect(preview.added).toBe(1);
    expect(preview.skipped).toBe(1);
    expect(await songRepo.count()).toBe(1);
  });

  it("applies settings only to a fresh library unless overwriting", async () => {
    await settingsRepo.save({ ...DEFAULT_SETTINGS, fretCount: 20 });
    const file = await createBackup();
    await resetDatabase(true);
    await settingsRepo.save({ ...DEFAULT_SETTINGS, fretCount: 7 });
    await importBackup(file, "skip");
    expect((await settingsRepo.get()).fretCount).toBe(7);
    await importBackup(file, "overwrite");
    expect((await settingsRepo.get()).fretCount).toBe(20);
  });

  it("is all-or-nothing", async () => {
    const file = await backupOf([song("a")]);
    // A record the database cannot store (it holds a function) makes the whole transaction fail.
    (file.data.songs as any[]).push({ id: "boom", title: "x", sections: [], tags: [], broken: () => 1 });
    await songRepo.save(song("existing"));
    await expect(importBackup(file, "skip")).rejects.toBeDefined();
    expect((await songRepo.list()).map((s) => s.id)).toEqual(["existing"]);
  });

  it("can clear everything", async () => {
    await songRepo.save(song("a"));
    await settingsRepo.save({ ...DEFAULT_SETTINGS, fretCount: 9 });
    await clearAllUserData();
    expect(await libraryStats()).toMatchObject({ songs: 0 });
    expect((await settingsRepo.get()).fretCount).toBe(DEFAULT_SETTINGS.fretCount);
  });
});

describe("legacy localStorage songs", () => {
  const memory = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
  };
  const oldSong = {
    id: "song-1", title: "Old", transposition: 2, tags: ["x"], favorite: true, createdAt: "t", updatedAt: "t",
    sections: [{ id: "s", name: "Verse", blocks: [{ type: "chord", id: "b", chordId: "chord-4-t2", label: "Dm" }, { type: "text", id: "t", text: "hello" }, { type: "weird", id: "w" }] }]
  };

  it("converts chord blocks to symbols and drops unknown blocks", () => {
    const s = upgradeLegacySong(oldSong)!;
    expect(s.sections[0].blocks).toEqual([{ type: "chord", id: "b", symbol: "Dm" }, { type: "text", id: "t", text: "hello" }]);
    expect(upgradeLegacySong({ nope: true })).toBeNull();
  });

  it("migrates once and keeps a backup copy", async () => {
    const store = memory({ [LEGACY_SONGS_KEY]: JSON.stringify([oldSong, { broken: 1 }]) });
    expect(await migrateLegacySongs(store)).toBe(1);
    expect((await songRepo.get("song-1"))?.favorite).toBe(true);
    expect(store.data[`${LEGACY_SONGS_KEY}:backup`]).toBeDefined();
    await songRepo.remove("song-1");
    expect(await migrateLegacySongs(store)).toBe(0); // flagged: never re-imports deleted songs
    expect(await songRepo.count()).toBe(0);
  });

  it("does nothing when there is nothing to migrate or the data is unreadable", async () => {
    expect(await migrateLegacySongs(memory())).toBe(0);
    await resetDatabase(true);
    expect(await migrateLegacySongs(memory({ [LEGACY_SONGS_KEY]: "{{{" }))).toBe(0);
  });
});

import { clearHistory, recentHistory, recordRecent } from "./storage";

describe("recent items", () => {
  it("lists newest first, filters by kind, and can be cleared", async () => {
    await resetDatabase(true);
    await recordRecent("chord", "Am7");
    await recordRecent("song", "Amazing Grace", { id: "s1" });
    await recordRecent("chord", "F");
    await recordRecent("chord", "Am7"); // moves to the top, no duplicate
    expect((await recentHistory(["chord"])).map((h) => h.label)).toEqual(["Am7", "F"]);
    expect((await recentHistory()).map((h) => h.label)).toEqual(["Am7", "F", "Amazing Grace"]);
    expect((await recentHistory(["song"]))[0].payload).toEqual({ id: "s1" });
    expect(await recentHistory(undefined, 2)).toHaveLength(2);
    await clearHistory();
    expect(await recentHistory()).toEqual([]);
  });
});

import { savedShapeRepo } from "./storage";

describe("saved shapes in storage", () => {
  it("saves, lists, backs up and restores shapes", async () => {
    await resetDatabase(true);
    await savedShapeRepo.save({ id: "sh1", instrumentId: "guitar", tuningId: "guitar-standard", capo: 0, symbol: "C", name: "My C", frets: [null, 3, 2, 0, 1, 0], createdAt: "2026-01-01T00:00:00Z" });
    const file = await createBackup();
    expect(file.data.savedShapes).toHaveLength(1);
    await resetDatabase(true);
    const report = await importBackup(file, "skip");
    expect(report.added).toBe(1);
    expect((await savedShapeRepo.get("sh1"))?.frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect((await libraryStats()).savedShapes).toBe(1);
  });
  it("ignores damaged shape records on import", async () => {
    await resetDatabase(true);
    const file = await createBackup();
    (file.data.savedShapes as unknown[]).push({ id: "bad", name: "no frets" }, { id: "bad2", instrumentId: "guitar", frets: "nope" });
    const report = await importBackup(file, "skip");
    expect(report.invalid).toBe(2);
    expect(await savedShapeRepo.count()).toBe(0);
  });
});
