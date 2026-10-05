/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Files that must be copied to the build as-is (the project has no public/ folder).
const STATIC_FILES = ["sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? [] : [name]));
}

/** Copies the static files, then stamps the service worker with a build id and the list of built files to precache. */
function staticAndServiceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "static-and-service-worker",
    apply: "build",
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      for (const name of STATIC_FILES) copyFileSync(name, join(outDir, name));
      const file = join(outDir, "sw.js");
      const files = listFiles(outDir).filter((f) => f !== "sw.js");
      const source = readFileSync(file, "utf8")
        .replace("__BUILD_VERSION__", Date.now().toString(36))
        .replace("[/*__PRECACHE__*/]", JSON.stringify(["./", ...files]));
      writeFileSync(file, source);
    }
  };
}

/** Adds the manifest and icon links. They are injected here (not written in index.html) so Vite doesn't copy them again under hashed names. */
function appLinks(): Plugin {
  return {
    name: "app-links",
    transformIndexHtml: () => [
      { tag: "link", attrs: { rel: "manifest", href: "./manifest.webmanifest" }, injectTo: "head" },
      { tag: "link", attrs: { rel: "icon", type: "image/png", href: "./icon-192.png" }, injectTo: "head" },
      { tag: "link", attrs: { rel: "apple-touch-icon", href: "./icon-192.png" }, injectTo: "head" }
    ]
  };
}

// base "./" lets the build run from any folder, e.g. GitHub Pages at /repo-name/.
// Everything is flat: no public/ folder, and built files go straight into dist/ (no assets/ subfolder).
export default defineConfig({
  base: "./",
  publicDir: false,
  build: { assetsDir: "" },
  plugins: [react(), appLinks(), staticAndServiceWorker()],
  esbuild: { jsx: "automatic" },
  test: { environment: "node", globals: false, include: ["*.test.{ts,tsx}"] }
});
