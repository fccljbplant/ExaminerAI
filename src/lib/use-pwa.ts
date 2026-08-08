/**
 * PWA (Progressive Web App) — what it is and why TraineesAI needs it
 * ===================================================================
 *
 * A PWA is a regular web app that, when installed on a phone or desktop,
 * behaves like a native app:
 *   - Launches from the home screen / app drawer (no browser chrome).
 *   - Works offline (or with flaky connectivity).
 *   - Sends push notifications.
 *   - Has its own icon, splash screen, and theme color.
 *
 * It's installed from the browser (Chrome shows "Add to Home Screen")
 * — no app store, no review process, no install friction. This is huge
 * for field workers (HSE, mining, labs) who can't easily install apps
 * on locked-down company phones.
 *
 * Three pieces make a web app a PWA:
 *   1. A web manifest (`manifest.json` or `manifest.webmanifest`) — tells
 *      the OS the app's name, icon, theme color, and start URL.
 *   2. A service worker (a JavaScript file that runs in the background,
 *      even when the app is closed) — caches assets for offline use and
 *      queues requests when connectivity drops.
 *   3. HTTPS (Vercel gives us this for free).
 *
 * TraineesAI-specific value:
 *   - Field trainees can capture evidence (photos, notes, voice memos)
 *     offline. The service worker queues them in IndexedDB. When the
 *     phone reconnects, the queue syncs to /api/offline/sync.
 *   - Daily tests work offline — the questions are pre-cached, the
 *     learner's answers queue locally, and grading happens when they
 *     reconnect.
 *   - The app installs alongside the company's MDM-controlled apps
 *     without needing IT to approve an APK / IPA.
 *
 * What this file does:
 *   - Defines the manifest (Next.js serves it via metadata in layout.tsx).
 *   - The service worker is at /public/sw.js (a plain JS file).
 *   - This hook registers the service worker and exposes the offline
 *     queue state so the UI can show "3 items waiting to sync".
 */

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAState {
  /** True if the service worker is registered and active. */
  registered: boolean;
  /** True if running in standalone mode (launched from home screen). */
  installed: boolean;
  /** True if the browser offers an install prompt (Chrome's "Add to Home Screen"). */
  canInstall: boolean;
  /** Triggers the browser install prompt. No-op if canInstall is false. */
  promptInstall: () => Promise<void>;
  /** Number of offline-queued items waiting to sync. */
  pendingSync: number;
}

export function usePWA(): PWAState {
  const [registered, setRegistered] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    // Standalone detection — true if launched from home screen.
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setInstalled(isStandalone);

    // Service worker registration.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => setRegistered(true))
        .catch((err) => console.warn("[PWA] SW registration failed", err));
    }

    // Capture the install prompt event so we can trigger it later.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      setInstallEvent(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    // Online/offline + pending sync count.
    const updatePending = async () => {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        // Ask the service worker how many items are queued.
        const channel = new MessageChannel();
        channel.port1.onmessage = (e: MessageEvent) => {
          if (typeof e.data?.pending === "number") setPendingSync(e.data.pending);
        };
        navigator.serviceWorker.controller.postMessage({ type: "GET_PENDING_COUNT" }, [channel.port2]);
      }
    };
    updatePending();
    window.addEventListener("online", updatePending);
    const interval = setInterval(updatePending, 30_000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", updatePending);
      clearInterval(interval);
    };
  }, []);

  const promptInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setCanInstall(false);
  };

  return {
    registered,
    installed,
    canInstall,
    promptInstall,
    pendingSync,
  };
}
