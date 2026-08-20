"use client";

// src/modules/ui-v3/profile.tsx — V3 Learner Profile (settings) content.
// Reimplements the v2 LearnerProfile (learner-portal/profile.tsx, 453 lines)
// with v3 design tokens. Reuses the same API endpoints + business logic;
// restyles each card to match the v3 dark-sidebar + indigo-primary shell.
//
// Cards: ProfilePicture, BadgesXP, Account, Appearance, Security,
//        SecurityQuestion, Help, Accessibility, SignOut.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AvatarEditor } from "@/modules/learner-portal/avatar-editor";
import { ModeToggle } from "@/modules/shell";
import { CAPTIONS_MODES, useCaptionsStore, ThemePackPicker } from "@/modules/theme";
import { api } from "@/lib/api-client";
import { V3Card, V3PageHeader } from "./v3-shell";

export interface V3ProfileInfo {
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export function V3LearnerProfile({ user }: { user: V3ProfileInfo }) {
  return (
    <>
      <V3PageHeader
        title="Profile & settings"
        subtitle="Manage your account, appearance, security, and session."
      />
      <div className="v3-grid v3-grid-2">
        <ProfilePictureCard />
        <BadgesXPCard />
        <AccountCard user={user} />
        <AppearanceCard />
        <SecurityCard user={user} />
        <SecurityQuestionCard />
        <HelpCard />
        <AccessibilityCard />
        <SignOutCard />
      </div>
    </>
  );
}

/* ---------- Card wrapper (v3-styled) ---------- */

function Card({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <V3Card>
      <h2 style={{ display: "flex", alignItems: "center", gap: "var(--p-space-3)", fontSize: "var(--p-type-md)", color: "var(--text)", margin: 0 }}>
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "var(--radius-md)",
            background: "var(--bg-subtle)",
            color: "var(--text-secondary)",
            fontSize: "var(--p-type-md)",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        {title}
      </h2>
      <div style={{ marginTop: "var(--p-space-4)" }}>{children}</div>
    </V3Card>
  );
}

/* ---------- Account ---------- */

function AccountCard({ user }: { user: V3ProfileInfo }) {
  return (
    <Card icon="👤" title="Account">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-3)" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--brand-subtle)",
            color: "var(--brand)",
            fontSize: "var(--p-type-sm)",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials(user.name)}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: "var(--p-type-md)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user.name}
          </p>
          <p style={{ margin: 0, fontSize: "var(--p-type-sm)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user.email}
          </p>
        </div>
      </div>
      <dl style={{ marginTop: "var(--p-space-4)", display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--p-space-2)", fontSize: "var(--p-type-sm)" }}>
          <dt style={{ color: "var(--text-muted)", margin: 0 }}>Role</dt>
          <dd style={{ margin: 0, fontWeight: 500, color: "var(--text)", textTransform: "capitalize" }}>
            {user.role.replace(/_/g, " ")}
          </dd>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--p-space-2)", fontSize: "var(--p-type-sm)" }}>
          <dt style={{ color: "var(--text-muted)", margin: 0 }}>Member since</dt>
          <dd style={{ margin: 0, fontWeight: 500, color: "var(--text)" }}>
            {new Date(user.joinedAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

/* ---------- Profile Picture ---------- */

interface MeResponse {
  user?: { avatarData?: string | null } | null;
}
interface BadgesResponse {
  earned?: Array<{ icon?: string }> | null;
}
interface ProfilePictureState {
  avatarData?: string | null;
  badges?: Array<{ icon?: string }> | null;
}

function ProfilePictureCard() {
  const [me, setMe] = useState<ProfilePictureState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MeResponse | null) => {
        if (!cancelled) setMe((prev) => ({ ...prev, avatarData: d?.user?.avatarData ?? null }));
      })
      .catch(() => {});
    fetch("/api/learner/badges", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BadgesResponse | null) => {
        if (!cancelled) setMe((prev) => ({ ...prev, badges: d?.earned ?? [] }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <Card icon="🖼️" title="Profile picture">
      <AvatarEditor
        initial={me?.avatarData ?? null}
        badgeIcon={me?.badges?.[0]?.icon ?? null}
        onChange={(dataUrl) => setMe((prev) => ({ ...prev, avatarData: dataUrl }))}
      />
    </Card>
  );
}

/* ---------- Badges & XP ---------- */

interface ProgressResponse {
  data?: {
    learner?: { totalXP: number; level: string };
    badges?: Array<{ id: string; name: string; icon: string; rarity: string; description: string }>;
  } | null;
}

function BadgesXPCard() {
  const [data, setData] = useState<ProgressResponse["data"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v2/learner/progress", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ProgressResponse | null) => {
        if (!cancelled) setData(d?.data ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <Card icon="🏅" title="Badges & XP">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-3)" }}>
        <span
          aria-hidden
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: "var(--brand-subtle)",
            color: "var(--brand)",
            fontSize: "var(--p-type-md)",
            flexShrink: 0,
          }}
        >⚡</span>
        <div>
          <p style={{ margin: 0, fontSize: "var(--p-type-xl)", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            {(data?.learner?.totalXP ?? 0).toLocaleString()} XP
          </p>
          <p style={{ margin: 0, fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>
            Level {data?.learner?.level ?? "Rookie"}
          </p>
        </div>
      </div>
      {data?.badges && data.badges.length > 0 ? (
        <ul style={{ marginTop: "var(--p-space-4)", display: "flex", flexWrap: "wrap", gap: "var(--p-space-2)", padding: 0, listStyle: "none" }}>
          {data.badges.map((b) => (
            <li
              key={b.id}
              title={`${b.name} — ${b.description}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--p-space-2)",
                borderRadius: 99,
                border: "1px solid var(--border)",
                background: "var(--bg-subtle)",
                padding: "var(--p-space-1) var(--p-space-3)",
                fontSize: "var(--p-type-sm)",
                color: "var(--text-secondary)",
              }}
            >
              <span aria-hidden>{b.icon}</span>
              {b.name}
              <span style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                {b.rarity}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ marginTop: "var(--p-space-4)", margin: 0, fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>
          Badges appear as you hit milestones — keep learning to earn your first.
        </p>
      )}
    </Card>
  );
}

/* ---------- Appearance ---------- */

function AppearanceCard() {
  return (
    <Card icon="🎨" title="Appearance">
      <p style={{ margin: "0 0 var(--p-space-2)", fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>
        Quick switch
      </p>
      <ModeToggle />
      <p style={{ margin: "var(--p-space-3) 0 var(--p-space-2)", fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>
        Theme pack
      </p>
      <ThemePackPicker />
      <p style={{ marginTop: "var(--p-space-3)", fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>
        Bed mode dims everything for late-night study. Classic adopts the Star Admin
        vertical layout with the sidebar on desktop. Your organisation&apos;s brand colours apply
        automatically.
      </p>
    </Card>
  );
}

/* ---------- Accessibility (captions) ---------- */

function AccessibilityCard() {
  const captionsMode = useCaptionsStore((s) => s.captionsMode);
  const setCaptionsMode = useCaptionsStore((s) => s.setCaptionsMode);

  return (
    <Card icon="♿" title="Accessibility">
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>Captions</legend>
        <p style={{ marginTop: "var(--p-space-1)", fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>
          Captions follow the tutor&apos;s speech. Auto keeps them on in Bed Mode — the P6 §3 default.
        </p>
        <div
          style={{ marginTop: "var(--p-space-3)", display: "flex", gap: "var(--p-space-2)" }}
          role="radiogroup"
          aria-label="Captions preference"
        >
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
                style={{
                  minHeight: 44,
                  flex: 1,
                  borderRadius: "var(--radius-md)",
                  border: active ? "1px solid var(--brand)" : "1px solid var(--border)",
                  background: active ? "var(--brand)" : "var(--bg-subtle)",
                  color: active ? "var(--on-brand)" : "var(--text-secondary)",
                  padding: "var(--p-space-2) var(--p-space-3)",
                  textAlign: "left",
                  fontSize: "var(--p-type-sm)",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p style={{ marginTop: "var(--p-space-4)", fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>
        Captions and reduced-motion are the defaults here — more accessibility preferences are planned.
      </p>
    </Card>
  );
}

/* ---------- Security (password change) ---------- */

interface ChangePasswordResult {
  ok: boolean;
  message: string;
}

function SecurityCard({ user }: { user: V3ProfileInfo }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChangePasswordResult | null>(null);

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

  const isDemo = user.email.toLowerCase().endsWith("@demo.ai");

  return (
    <Card icon="🔒" title="Security">
      {isDemo ? (
        <p style={{ fontSize: "var(--p-type-sm)", lineHeight: 1.5, color: "var(--text-muted)", margin: 0 }}>
          Demo accounts share a password with all demo visitors, so it can&apos;t be
          changed here.
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--p-space-3)" }}>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="v3-input"
              style={{ width: "100%", marginTop: "var(--p-space-1)" }}
            />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>New password (min 6 characters)</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="v3-input"
              style={{ width: "100%", marginTop: "var(--p-space-1)" }}
            />
          </label>
          {result && (
            <p
              role={result.ok ? "status" : "alert"}
              style={{
                fontSize: "var(--p-type-sm)",
                fontWeight: 500,
                color: result.ok ? "var(--success-on)" : "var(--danger-on)",
                margin: 0,
              }}
            >
              {result.message}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="v3-btn"
          >
            {busy ? "Saving…" : "Change password"}
          </button>
        </form>
      )}
    </Card>
  );
}

/* ---------- Security Question (account recovery) ---------- */

function SecurityQuestionCard() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChangePasswordResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await api.post("/api/auth/set-security-question", {
        securityQuestion: question,
        securityAnswer: answer,
      });
      setResult({ ok: true, message: "Security question saved — it's used to recover your account." });
      setQuestion("");
      setAnswer("");
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Couldn't save security question" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon="🔑" title="Account recovery">
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--p-space-3)" }}>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>Security question</span>
          <input
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What was your first pet's name?"
            className="v3-input"
            style={{ width: "100%", marginTop: "var(--p-space-1)" }}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>Answer</span>
          <input
            required
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer"
            className="v3-input"
            style={{ width: "100%", marginTop: "var(--p-space-1)" }}
          />
        </label>
        {result && (
          <p
            role={result.ok ? "status" : "alert"}
            style={{
              fontSize: "var(--p-type-sm)",
              fontWeight: 500,
              color: result.ok ? "var(--success-on)" : "var(--danger-on)",
              margin: 0,
            }}
          >
            {result.message}
          </p>
        )}
        <button type="submit" disabled={busy} className="v3-btn">
          {busy ? "Saving…" : "Save security question"}
        </button>
      </form>
    </Card>
  );
}

/* ---------- Help ---------- */

function HelpCard() {
  return (
    <Card icon="❓" title="Help & support">
      <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", margin: 0 }}>
        Answers to common questions, plus the AI tutor and your mentor.
      </p>
      <Link
        href="/learner/help"
        className="v3-btn"
        style={{ marginTop: "var(--p-space-3)" }}
      >
        Open help center
      </Link>
    </Card>
  );
}

/* ---------- Sign out ---------- */

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
    <Card icon="🚪" title="Session">
      <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", margin: 0 }}>
        Sign out of this device. Your progress is saved automatically.
      </p>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="v3-btn"
        style={{
          marginTop: "var(--p-space-3)",
          borderColor: "var(--danger)",
          color: "var(--danger-on)",
          background: "var(--danger-subtle)",
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </Card>
  );
}

/* ---------- helpers ---------- */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
