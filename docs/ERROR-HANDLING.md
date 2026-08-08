# TraineesAI · Error Handling Policy

> How failures are handled, surfaced, and recovered.
> Updated every audit cycle. Source of truth for "what happens when X breaks?"

---

## 1. Principles

1. **No silent failures.** Every `catch` logs via `logger.warn` (or
   `logger.error` for severe failures) with context. The pattern
   `.catch(() => {})` is forbidden — the audit script (section F) flags
   every occurrence.

2. **Failures are visible to the user.** A learner whose AI call fails sees
   an `ErrorState` with a Retry button — not a blank screen, not a canned
   "AI is thinking..." spinner that never resolves.

3. **Failures are visible to the operator.** Cron jobs ping
   `/api/health/cron` on success; missed pings alert the platform admin.
   AI provider failures increment a counter; sustained failure triggers a
   feature-flag auto-disable.

4. **Failures degrade gracefully.** If the AI is down, the platform still
   loads courses, drills, and project tasks. Only AI-dependent features
   show a degraded state. No cascading failure.

5. **Destructive actions confirm.** Project regenerate, user delete, course
   archive — all require an `AlertDialog` with a clear summary of what will
   be lost. No silent wipes.

---

## 2. The three failure surfaces

### 2.1 AI failures

**What can fail**:

- AI provider is down (5xx, timeout, network error).
- AI provider returns malformed JSON (rare, but happens).
- AI provider returns a canned reply (hallucinated confidence).
- Rate limit hit (per-user or platform-wide).
- Feature flag disabled (admin turned off AI).
- Demo account blocked from AI writes.

**Handling**:

```ts
// src/lib/ai-provider.ts (simplified)
try {
  const result = await callAI(prompt, { budget: TOKEN_BUDGET.weeklyTest });
  return { ok: true, data: result };
} catch (err) {
  logger.warn("AI call failed", { feature: "weekly-test", err });
  return { degraded: true, error: "AI is unavailable. Your progress is saved." };
}
```

**UI behavior**:

- Test in progress → show a banner "AI is degraded, your replies are being
  saved. You can retry or end the test early." The learner's score is
  computed from the questions that did grade successfully.
- Practice/drill → show `ErrorState` with Retry button.
- Tutor chat → show inline "AI unavailable" message in the chat thread;
  allow the learner to retry the last message.
- Streaming tutor → if the stream emits `[stream-degraded: <reason>]`,
  the `useStreamingAI()` hook calls `onError` and the AITutor component
  falls back to the non-streaming `/api/ai/tutor` endpoint automatically.

**Never** return a canned "looks good!" reply. That erodes learner trust
faster than an honest failure.

### 2.1a Streaming AI failures

**What can fail**:

- Provider doesn't support `stream: true` (rare — DeepSeek + Z.ai both do).
- Stream errors mid-flight (network drop, provider timeout).
- Rate limit hit mid-stream.
- Client disconnects (user navigated away, pressed Esc).

**Handling** (`src/modules/assessment/lib/ai-provider.ts` → `streamAI()`):

- Mid-stream error → emit `[stream-degraded: <reason>]` marker, close
  the stream cleanly. Client detects the marker and falls back.
- Client disconnect → `cancel()` handler aborts the upstream stream.
- Usage is logged on stream close (best-effort — never fail the response
  over logging).

**Client handling** (`src/lib/use-streaming-ai.ts`):

- Detects the `[stream-degraded:` prefix in the accumulated text.
- Calls `onError(reason)` so the caller can fall back to non-streaming.
- Auto-cancels on component unmount (no orphan streams).

### 2.2 Database failures

**What can fail**:

- DB unreachable (connection dropped, pool exhausted).
- Constraint violation (unique, foreign key).
- Transaction deadlock (rare with SQLite, possible with PostgreSQL).

**Handling**:

```ts
try {
  await db.weeklyTest.create({ data: { ... } });
} catch (err) {
  logger.error("DB write failed", { table: "WeeklyTest", err });
  return NextResponse.json(
    { error: "Couldn't save your test. Please retry." },
    { status: 500 }
  );
}
```

**UI behavior**: `ErrorState` with Retry. The learner's input is preserved
in the form (don't clear it on failure).

### 2.2a Offline / PWA failures

**What can fail**:

- Network drops while the learner is mid-test or mid-message.
- Service worker fails to register (old browser, private browsing).
- IndexedDB quota exceeded (rare — queue auto-prunes after 10 retries).
- Sync conflict (same evidence uploaded twice).

**Handling** (`public/sw.js` + `src/app/api/offline/sync/route.ts`):

- POST requests when offline → queued in IndexedDB (`offlineQueue` store).
- Queue auto-drains on `online` event + Background Sync API.
- Each item retried up to 10 times; after that, auto-pruned.
- 4xx responses → item removed (permanent failure, don't retry).
- 5xx responses → item stays in queue for next sync.
- Evidence sync endpoint (`/api/offline/sync`) is idempotent — re-uploading
  the same evidence creates a duplicate Message row but doesn't break.

**Client UI**:

- `usePWA()` hook exposes `pendingSync` count so the UI can show
  "3 items waiting to sync" badge.
- Service worker posts `PENDING_COUNT` messages to all open clients
  when the queue changes.

### 2.3 Cron failures

**What can fail**:

- Cron job throws (DB down, AI down, logic bug).
- Cron job hangs past its schedule window.
- Cron job is never invoked (Vercel cron misconfiguration).

**Handling**:

Each cron must, on success, POST to `/api/health/cron`:

```ts
await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/health/cron`, {
  method: "POST",
  headers: { "x-cron-secret": process.env.CRON_SECRET! },
  body: JSON.stringify({ job: "daily-test-gen", status: "ok" }),
});
```

On failure, the cron logs the error and posts `status: "failed"` with the
error message. The `heartbeat-check` cron (every 15 min) looks for jobs
that haven't pinged in 2× their expected interval. Missed heartbeats trigger
a platform-admin alert (email + Slack).

**Current gap**: `CronHeartbeat` table is planned. Currently crons fail
silently — this is a tracked red line.

---

## 3. The four user-facing states

Every data-loading panel must handle all four states. The `states.tsx` kit
provides the components; the audit script (section D) counts adoptions.

### 3.1 Loading

```tsx
<SkeletonPanel lines={3} />
```

Use for any panel that fetches data. The skeleton must visually match the
loaded layout (same rough shape) so the user doesn't see a jarring reflow.

### 3.2 Empty

```tsx
<EmptyState
  icon="🌱"
  title="No drills yet"
  hint="Take a daily test and wrong answers will come back as drills."
  action={<Button onClick={startTest}>Start a test</Button>}
/>
```

Every empty state MUST have a next action. A blank panel is a bug.

### 3.3 Error

```tsx
<ErrorState
  message="Couldn't load your report cards."
  onRetry={reload}
/>
```

The message is human-readable. The retry is one tap. No raw error codes
or stack traces shown to the learner.

### 3.4 Loaded

The normal happy path. Components should not render `loaded` until the
data is actually present — not "the fetch returned but the body is null".

---

## 4. Forbidden patterns

### 4.1 Silent `.catch(() => {})`

```ts
// ❌ FORBIDDEN
fetch("/api/foo").then(...).catch(() => {});

// ✅ REQUIRED
fetch("/api/foo")
  .then(...)
  .catch((err) => {
    logger.warn("foo fetch failed", { err });
    // surface to UI via state
  });
```

The audit script counts these. Target: zero.

### 4.2 Canned AI replies on failure

```ts
// ❌ FORBIDDEN — lies to the learner
catch (err) {
  return { reply: "Great work! Let's move on." };
}

// ✅ REQUIRED — honest failure
catch (err) {
  logger.warn("AI call failed", { err });
  return { degraded: true, error: "AI is unavailable. Please retry." };
}
```

### 4.3 `console.log` in production code

Use `logger.info` / `logger.warn` / `logger.error` instead. The audit script
counts `console.log` occurrences. Target: zero in `src/` (test files exempt).

### 4.4 Raw error messages in UI

```tsx
// ❌ FORBIDDEN
<p>{err.message}</p>  // "PrismaClientInitializationError: Can't reach database"

// ✅ REQUIRED
<ErrorState message="Couldn't load your data. Please retry." onRetry={reload} />
```

### 4.5 Destructive actions without confirmation

```tsx
// ❌ FORBIDDEN
<button onClick={() => regenerateProject()}>Regenerate</button>

// ✅ REQUIRED
<AlertDialog>
  <AlertDialogTrigger>Regenerate</AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Regenerate project?</AlertDialogTitle>
      <AlertDialogDescription>
        This will replace your current project tasks with new ones. Your
        existing progress will be lost. This cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogAction onClick={regenerateProject}>
      Yes, regenerate
    </AlertDialogAction>
  </AlertDialogContent>
</AlertDialog>
```

---

## 5. Retry policy

- **AI calls**: 1 automatic retry with exponential backoff (1 s). If the
  retry fails, surface the degraded state to the UI.
- **DB calls**: no automatic retry (the next user action will retry
  naturally).
- **Cron jobs**: 3 retries with 5-minute backoff. After 3 failures, mark
  the job as failed and alert.
- **User-initiated retries**: always allowed (the Retry button). Rate
  limits still apply.

---

## 6. Logging

**Levels**:

| Level | When | Example |
|---|---|---|
| `error` | Something broke and a user saw it | DB write failed, AI call failed |
| `warn` | Something is off but recovered | Rate limit hit, cache miss, fallback used |
| `info` | Normal operation, useful for debugging | Cron started, user enrolled, AI cache hit |

**Format**: structured JSON via `src/lib/logger.ts`:

```ts
logger.warn("AI rate limit hit", {
  userId,
  feature: "weekly-test",
  used: 5,
  limit: 5,
  resetAt: "2026-08-09T00:00:00Z",
});
```

**Storage**: Vercel captures stdout/stderr. For long-term retention, ship
to a log aggregator (planned — currently Vercel-only).

**Sensitive data**: never log secrets, JWTs, or PII beyond `userId`. The
logger has a sanitizer that strips common secret patterns.

---

## 7. Audit trail

Every privileged action lands in `AuditLog`:

| Actor | Action | Resource | Timestamp | Metadata |
|---|---|---|---|---|
| `instructor:abc` | `flag_learner` | `student:xyz` | `2026-08-08T10:30:00Z` | `{ reason: "overconfident", week: 3 }` |
| `org_admin:def` | `archive_course` | `course:123` | `2026-08-08T11:00:00Z` | `{}` |
| `platform_admin:ghi` | `disable_ai` | `feature:ai_enabled` | `2026-08-08T12:00:00Z` | `{ reason: "provider outage" }` |

**Implementation**: `src/lib/audit-log.ts` → `recordAudit()`.

The audit log is searchable by platform admins (read-only). It cannot be
edited or deleted — append-only.

---

## 8. Health endpoints

- `GET /api/health` — basic liveness check (returns `{ ok: true }`).
- `GET /api/health/cron` — cron heartbeat status (returns last-seen per job).
- `POST /api/health/cron` — cron heartbeat write (secret-protected).

Planned:

- `GET /api/health/ai` — AI provider reachability (latency + last-error).
- `GET /api/health/db` — DB connection pool status.

---

## 9. Incident response

When a production incident is detected (admin alert, user report, or
automated monitor):

1. **Acknowledge** — platform admin marks the incident as "investigating".
2. **Mitigate** — flip feature flags to reduce blast radius (e.g. disable
   weekly test if AI is failing).
3. **Communicate** — post a status banner (planned: `/api/status` endpoint).
4. **Resolve** — fix the root cause, deploy, verify.
5. **Post-mortem** — write up what happened, what we learned, what we'll
   change. Store in `docs/incidents/YYYY-MM-DD-*.md` (planned).

The audit log + structured logs are the primary evidence source for
post-mortems.
