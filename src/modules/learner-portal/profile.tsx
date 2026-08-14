"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CircleHelp,
  LogOut,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { ModeToggle } from "@/modules/shell";
import { CAPTIONS_MODES, useCaptionsStore } from "@/modules/theme";

/**
 * modules/learner-portal — L13 Profile & settings (REDESIGN-P3 §L13)
 *
 * Account · Appearance (mode select incl. Bed) · Security (password)
 * · Sign out. Notifications & Accessibility land with the settings
 * backend in a later week — shown as upcoming, no dead controls.
 */

export interface ProfileInfo {
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export function LearnerProfile({ user }: { user: ProfileInfo }) {
  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Profile & settings</h1>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <AccountCard user={user} />
        <AppearanceCard />
        <SecurityCard />
        <HelpCard />
        <UpcomingCard
          icon={Bell}
          title="Notifications"
          body="Email and in-app notification preferences arrive with the messaging update."
        />
        <AccessibilityCard />
        <SignOutCard />
      </div>
    </div>
  );
}

/* ---------------- cards -------------------------------------------------- */

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AccountCard({ user }: { user: ProfileInfo }) {
  return (
    <Card icon={UserRound} title="Account">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-fg">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
          <p className="truncate text-xs text-fg-muted">{user.email}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Role</dt>
          <dd className="font-medium capitalize text-fg">{user.role.replace(/_/g, " ")}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Member since</dt>
          <dd className="font-medium tabular-nums text-fg">
            {new Date(user.joinedAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function AppearanceCard() {
  return (
    <Card icon={Palette} title="Appearance">
      <ModeToggle />
      <p className="mt-3 text-xs text-fg-muted">
        Bed mode dims everything for late-night study. Your organisation&apos;s brand colours apply
        automatically.
      </p>
    </Card>
  );
}

function AccessibilityCard() {
  const captionsMode = useCaptionsStore((s) => s.captionsMode);
  const setCaptionsMode = useCaptionsStore((s) => s.setCaptionsMode);

  return (
    <Card icon={SlidersHorizontal} title="Accessibility">
      <fieldset>
        <legend className="text-xs font-medium text-fg-secondary">Captions</legend>
        <p className="mt-1 text-xs text-fg-muted">
          Captions follow the tutor&apos;s speech. Auto keeps them on in Bed Mode — the P6 §3 default.
        </p>
        <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Captions preference">
          {CAPTIONS_MODES.map(({ mode, label, hint }) => {
            const active = captionsMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                title={hint}
                onClick={() => setCaptionsMode(mode)}
                className={
                  active
                    ? "min-h-11 flex-1 rounded-lg bg-brand px-3 py-2 text-left text-xs font-semibold text-on-brand focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                    : "min-h-11 flex-1 rounded-lg border border-line bg-bg-subtle px-3 py-2 text-left text-xs font-medium text-fg-secondary hover:border-line-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className="mt-4 text-xs text-fg-muted">
        Type scale, reduced motion and audio-only defaults are coming soon.
      </p>
    </Card>
  );
}

function SecurityCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await api.post("/api/auth/change-password", { currentPassword: current, newPassword: next });
      setResult({ ok: true, message: "Password updated." });
      setCurrent("");
      setNext("");
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Couldn't update password" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={ShieldCheck} title="Security">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-fg-secondary">Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg focus:border-brand focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-fg-secondary">New password (min 6 characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg focus:border-brand focus:outline-none"
          />
        </label>
        {result && (
          <p
            role={result.ok ? "status" : "alert"}
            className={"text-xs font-medium " + (result.ok ? "text-success" : "text-danger")}
          >
            {result.message}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle disabled:opacity-60"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </Card>
  );
}

function HelpCard() {
  return (
    <Card icon={CircleHelp} title="Help & support">
      <p className="text-xs text-fg-muted">
        Answers to common questions, plus the AI tutor and your mentor.
      </p>
      <Link
        href="/learner/help"
        className="mt-3 inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
      >
        Open help center
      </Link>
    </Card>
  );
}

function UpcomingCard({ icon, title, body }: { icon: typeof Bell; title: string; body: string }) {
  return (
    <Card icon={icon} title={title}>
      <p className="text-xs text-fg-muted">{body}</p>
      <span className="mt-3 inline-flex rounded-full bg-bg-subtle px-2.5 py-0.5 text-[11px] font-semibold text-fg-muted">
        Coming soon
      </span>
    </Card>
  );
}

function SignOutCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.push("/login");
    }
  }

  return (
    <Card icon={LogOut} title="Session">
      <p className="text-xs text-fg-muted">Sign out of this device. Your progress is saved automatically.</p>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg border border-danger/40 px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger-subtle disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </Card>
  );
}

/* ---------------- helpers --------------------------------------------------- */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
