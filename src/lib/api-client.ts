/**
 * Typed fetcher that talks to our own API routes. Auto-attaches the
 * credentials cookie so server routes can read the JWT, and unwraps the
 * `{ data }` envelope.
 *
 * Includes an 8-second timeout via AbortController so a hung request
 * never leaves the UI spinning forever.
 */
export class ApiError extends Error {
  status: number;
  /** Full parsed JSON body from the error response (when available).
   *  Use this to read structured error fields like `assignedBatches`
   *  from the API — the `message` field only carries the human-readable
   *  error string. */
  body: Record<string, unknown> | null;
  constructor(status: number, message: string, body: Record<string, unknown> | null = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Default timeout for all API requests (8 seconds). */
const DEFAULT_TIMEOUT_MS = 8000;
/** Extended timeout for AI-generation requests (60 seconds — AI can take 10-30s). */
const AI_TIMEOUT_MS = 60_000;

async function request<T>(method: string, url: string, body?: unknown, timeoutMs?: number): Promise<T> {
  // DEMO GUARD — block writes for demo account on the client side.
  // CRITICAL: auth routes (login, logout, me, password reset) are ALWAYS
  // allowed, even if the demo flag is set. Otherwise the user can't log
  // in or out — the flag persists in localStorage from a previous demo
  // session and blocks the login POST itself.
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isAuthRoute =
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/logout") ||
    url.includes("/api/auth/me") ||
    url.includes("/api/auth/forgot") ||
    url.includes("/api/auth/reset") ||
    url.includes("/api/auth/change") ||
    url.includes("/api/auth/set-security");
  if (isWrite && !isAuthRoute && typeof window !== "undefined" && localStorage.getItem("examiner-is-demo") === "1") {
    const { toast } = await import("sonner");
    toast.error("Demo Account Restriction", {
      description:
        "🚫 This is a demo account — writes are blocked. You can open all forms, menus, and dialogs for preview, but no changes will be saved.",
      duration: 5000,
    });
    throw new ApiError(403, "Demo account — writes are blocked", { code: "DEMO_BLOCKED" });
  }

  const controller = new AbortController();
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError(408, "Request timed out — please try again.");
    }
    throw new ApiError(0, e instanceof Error ? e.message : "Network error");
  }
  clearTimeout(timeoutId);

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError(res.status, text);
    }
  }
  if (!res.ok) {
    const bodyObj = (json && typeof json === "object" ? (json as Record<string, unknown>) : null);
    const msg =
      (bodyObj && "error" in bodyObj
        ? String(bodyObj.error)
        : `Request failed (${res.status})`);
    throw new ApiError(res.status, msg, bodyObj);
  }
  return json as T;
}

export const api = {
  get: <T>(url: string, _body?: unknown, timeoutMs?: number) => request<T>("GET", url, undefined, timeoutMs),
  post: <T>(url: string, body?: unknown, timeoutMs?: number) => request<T>("POST", url, body, timeoutMs),
  put: <T>(url: string, body?: unknown, timeoutMs?: number) => request<T>("PUT", url, body, timeoutMs),
  patch: <T>(url: string, body?: unknown, timeoutMs?: number) => request<T>("PATCH", url, body, timeoutMs),
  del: <T>(url: string, body?: unknown, timeoutMs?: number) => request<T>("DELETE", url, body, timeoutMs),
};

/** Re-export the AI timeout for callers that need long-running requests. */
export { AI_TIMEOUT_MS };
