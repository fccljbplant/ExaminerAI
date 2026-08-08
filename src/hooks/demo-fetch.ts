"use client";

import { toast } from "sonner";

/**
 * Client-side demo fetch wrapper.
 *
 * If the current user is the demo account AND the request is a write
 * (POST/PUT/PATCH/DELETE), intercept and show a toast instead of sending
 * the request. This gives instant feedback before the server roundtrip.
 *
 * Usage:
 *   import { demoAwareFetch } from "@/lib/demo-fetch";
 *   const res = await demoAwareFetch("/api/users", { method: "POST", ... });
 */

const DEMO_FLAG_KEY = "examiner-is-demo";

/** Set by the AppShell when the demo user logs in. */
export function setDemoFlag(isDemo: boolean) {
  if (typeof window === "undefined") return;
  if (isDemo) {
    localStorage.setItem(DEMO_FLAG_KEY, "1");
  } else {
    localStorage.removeItem(DEMO_FLAG_KEY);
  }
}

export function isDemoClient(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_FLAG_KEY) === "1";
}

/**
 * Wraps fetch(). If the user is demo and the method is a write, shows a
 * toast and returns a fake 403 response without hitting the server.
 * For GET requests or non-demo users, passes through to fetch().
 */
export async function demoAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = init?.method?.toUpperCase();
  const isWrite = method && ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (isWrite && isDemoClient()) {
    // Allow auth/logout — demo user should be able to sign out
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url?.includes("/api/auth/logout")) {
      return fetch(input, init);
    }

    toast.error("Demo Account Restriction", {
      description:
        "🚫 This is a demo account — writes are blocked. You can open all forms, menus, and dialogs for preview, but no changes will be saved.",
      duration: 5000,
    });

    return new Response(
      JSON.stringify({
        error: "Demo account restriction",
        code: "DEMO_BLOCKED",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return fetch(input, init);
}
