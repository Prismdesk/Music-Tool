import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/** Run sw.js against a tiny fake of the service-worker environment. */
function boot(precache: string[]) {
  const source = readFileSync("sw.js", "utf8").replace("__BUILD_VERSION__", "t1").replace("[/*__PRECACHE__*/]", JSON.stringify(precache));
  const stores = new Map<string, Map<string, string>>();
  const listeners: Record<string, (e: any) => void> = {};
  let online = true;
  const net: Record<string, string> = Object.fromEntries(precache.map((p) => [new URL(p, "https://app.test/").href, `file:${p}`]));
  net["https://app.test/extra.js"] = "file:extra.js";
  const keyOf = (r: any) => (typeof r === "string" ? new URL(r, "https://app.test/").href : r.url);
  const makeResponse = (body: string) => ({ ok: true, body, clone() { return this; } });
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const s = stores.get(name)!;
      return {
        async addAll(list: string[]) { for (const u of list) s.set(keyOf(u), (await fakeFetch(u)).body); },
        async put(r: any, res: any) { s.set(keyOf(r), res.body); }
      };
    },
    async match(r: any) { for (const s of stores.values()) if (s.has(keyOf(r))) return makeResponse(s.get(keyOf(r))!); return undefined; },
    async keys() { return [...stores.keys()]; },
    async delete(k: string) { return stores.delete(k); }
  };
  async function fakeFetch(r: any) {
    const url = keyOf(r);
    if (!online || !(url in net)) throw new TypeError("offline");
    return makeResponse(net[url]);
  }
  const self: any = { location: { origin: "https://app.test" }, clients: { claim: async () => {} }, addEventListener: (t: string, f: any) => { listeners[t] = f; }, skipWaiting: () => {} };
  vm.runInNewContext(source, { self, caches, fetch: fakeFetch, URL, Response: { error: () => ({ error: true }) }, Promise });
  const run = async (type: string, event: any) => { let p: Promise<any> | undefined; listeners[type]({ ...event, waitUntil: (x: any) => { p = x; }, respondWith: (x: any) => { p = x; } }); return p; };
  return { stores, run, setOnline: (v: boolean) => { online = v; } };
}

describe("service worker", () => {
  const files = ["./", "index.html", "assets/app.js", "assets/app.css", "manifest.webmanifest"];
  it("precaches every built file on install", async () => {
    const sw = boot(files);
    await sw.run("install", {});
    const cache = sw.stores.get("music-toolbox-t1")!;
    expect(cache.size).toBe(files.length);
    expect([...cache.values()]).toContain("file:assets/app.js");
  });
  it("opens the app and its scripts with no network", async () => {
    const sw = boot(files);
    await sw.run("install", {});
    sw.setOnline(false);
    const page = await sw.run("fetch", { request: { method: "GET", url: "https://app.test/", mode: "navigate" } });
    expect(page.body).toBe("file:index.html");
    const js = await sw.run("fetch", { request: { method: "GET", url: "https://app.test/assets/app.js", mode: "no-cors" } });
    expect(js.body).toBe("file:assets/app.js");
  });
  it("removes caches from older versions when activated", async () => {
    const sw = boot(files);
    sw.stores.set("music-toolbox-old", new Map([["x", "y"]]));
    sw.stores.set("something-else", new Map());
    await sw.run("install", {});
    await sw.run("activate", {});
    expect([...sw.stores.keys()].sort()).toEqual(["music-toolbox-t1", "something-else"]);
  });
  it("ignores non-GET and cross-origin requests", async () => {
    const sw = boot(files);
    await sw.run("install", {});
    expect(await sw.run("fetch", { request: { method: "POST", url: "https://app.test/x", mode: "cors" } })).toBeUndefined();
    expect(await sw.run("fetch", { request: { method: "GET", url: "https://other.test/x.js", mode: "cors" } })).toBeUndefined();
  });
  it("caches new same-origin files the first time they are fetched online", async () => {
    const sw = boot(files);
    await sw.run("install", {});
    await sw.run("fetch", { request: { method: "GET", url: "https://app.test/extra.js", mode: "no-cors" } });
    sw.setOnline(false);
    const again = await sw.run("fetch", { request: { method: "GET", url: "https://app.test/extra.js", mode: "no-cors" } });
    expect(again.body).toBe("file:extra.js");
  });
});
