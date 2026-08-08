"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { COPY } from "@/content/copy";

export default function B2BSignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [seats, setSeats] = useState("1-10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/org/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, adminName, adminEmail, adminPassword, seats }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      // Success — redirect to the org dashboard
      router.push("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            TraineesAI
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/app">Sign in</Link>
          </Button>
        </div>
      </nav>

      <div className="flex-1 grid lg:grid-cols-2">
        {/* LEFT: Form */}
        <div className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">For Teams</Badge>
            <h1 className="text-2xl font-bold">Create your organization</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;ll be the org admin. Invite your team and assign seats after signup.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="orgName">Organization name</Label>
                <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Engineering" required disabled={busy} />
              </div>
              <div>
                <Label htmlFor="adminName">Your name</Label>
                <Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Sarah Chen" required disabled={busy} />
              </div>
              <div>
                <Label htmlFor="adminEmail">Work email</Label>
                <Input id="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="sarah@acme.com" required disabled={busy} />
              </div>
              <div>
                <Label htmlFor="adminPassword">Password</Label>
                <Input id="adminPassword" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Min 6 characters" required disabled={busy} minLength={6} />
              </div>
              <div>
                <Label htmlFor="seats">How many seats do you need?</Label>
                <select
                  id="seats"
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="1-10">1–10 seats (Starter — $29/seat/mo)</option>
                  <option value="11-50">11–50 seats (Team — volume discount)</option>
                  <option value="51-200">51–200 seats (Business — custom pricing)</option>
                  <option value="200+">200+ seats (Enterprise — contact sales)</option>
                </select>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={busy} className="w-full" size="lg">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Organization"}
                {!busy && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </form>

            <p className="mt-4 text-xs text-muted-foreground text-center">
              By signing up you agree to our terms. 30-day money-back guarantee.
            </p>
          </div>
        </div>

        {/* RIGHT: Marketing */}
        <div className="hidden lg:flex items-center justify-center bg-muted/30 border-l border-border p-12">
          <div className="max-w-md space-y-6">
            <h2 className="text-2xl font-bold leading-tight">{COPY.b2bStrip}</h2>
            <ul className="space-y-3 text-sm">
              {[
                "Unlimited courses + AI tutor for every trainee",
                "Seat management — reassign when interns leave",
                "Cohort analytics + mentor triage dashboard",
                "Verified certificates with public /verify/ URLs",
                "Priority support + 30-day risk-free pilot",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-growth-sage mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground italic">
                &quot;{COPY.mentorBrief}&quot;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
