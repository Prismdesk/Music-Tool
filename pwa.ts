/** Registers the service worker (production only) and reports when a new version is waiting. */
export function registerServiceWorker(onUpdate: (apply: () => void) => void): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      const announce = (worker: ServiceWorker | null) => {
        if (worker) onUpdate(() => worker.postMessage("SKIP_WAITING"));
      };
      if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) announce(installing);
        });
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
      setInterval(() => registration.update().catch(() => undefined), 60 * 60 * 1000);
    } catch {
      /* offline support is optional; the app works without it */
    }
  });
}

export interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }>; }
