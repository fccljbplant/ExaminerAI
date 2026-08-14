"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/modules/ui/button";
import { Input } from "@/modules/ui/input";
import { Label } from "@/modules/ui/label";
import { cn } from "@/lib/utils";
import { homeForRole } from "@/lib/portal-home";

/**
 * modules/auth — LoginForm (new kit, REDESIGN-P2)
 *
 * POST /api/auth/login then route by role straight into the v2 portal
 * (W10 cutover — the legacy /app shell is deleted). Demo accounts are
 * read-only preview seats and flag themselves through the
 * examiner-is-demo key.
 */



const DEMO_ACCOUNTS = [
  { email: "learner@demo.ai", label: "Learner" },
  { email: "instructor@demo.ai", label: "Instructor" },
  { email: "org_admin@demo.ai", label: "Org Admin" },
] as const;

const DEMO_PASSWORD = "demo123";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyDemo, setBusyDemo] = useState<string | null>(null);

  useEffect(() => {
    localStorage.removeItem("examiner-is-demo");
  }, []);

  const signIn = useCallback(
    async (demoEmail?: string) => {
      setError("");
      const isDemo = Boolean(demoEmail);
      if (isDemo) {
        setBusyDemo(demoEmail!);
        localStorage.setItem("examiner-is-demo", "1");
      } else {
        setBusy(true);
      }
      try {
        const res = await api.post<{ ok?: boolean; user?: { role?: string } }>(
          "/api/auth/login",
          { email: demoEmail ?? email, password: demoEmail ? DEMO_PASSWORD : password },
        );
        router.push(homeForRole(res?.user?.role ?? "learner"));
      } catch (e) {
        if (isDemo) localStorage.removeItem("examiner-is-demo");
        setError(e instanceof Error ? e.message : "Sign in failed");
      } finally {
        setBusy(false);
        setBusyDemo(null);
      }
    },
    [email, password, router]
  );

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void signIn();
    },
    [signIn]
  );

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-fg">
            Email
          </Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-surface"
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-fg">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 bg-surface"
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || busyDemo !== null} className="h-11 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">
          Try a demo (read-only)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((demo) => (
            <Button
              key={demo.email}
              type="button"
              variant="outline"
              disabled={busy || busyDemo !== null}
              onClick={() => void signIn(demo.email)}
              className={cn("h-auto flex-col gap-1 py-3", busyDemo === demo.email && "text-fg")}
            >
              {busyDemo === demo.email ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-subtle text-brand">
                  <span className="text-[11px] font-semibold">{demo.label[0]}</span>
                </span>
              )}
              <span className="text-xs font-medium leading-tight">{demo.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-fg-secondary">
        New here?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
