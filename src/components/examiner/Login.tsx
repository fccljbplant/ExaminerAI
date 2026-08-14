"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/modules/ui/button";
import { Input } from "@/modules/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/tabs";
import { GraduationCap, Loader2, Sparkles, ShieldCheck, Award, Briefcase } from "lucide-react";
import Link from "next/link";
import ForgotPassword from "./ForgotPassword";
import FeaturedCourses from "./FeaturedCourses";
import { COPY } from "@/content/copy";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  currentWeek?: number;
  hasSecurityQuestion?: boolean;
  linkedStudentId?: string | null;
  courseId?: string | null;
  courseName?: string | null;
}

const DEMO_ACCOUNTS = [
  { email: "learner@demo.ai", password: "demo123", label: "Learner Demo", color: "bg-blue-500 hover:bg-blue-600" },
  { email: "instructor@demo.ai", password: "demo123", label: "Instructor Demo", color: "bg-growth-sage hover:bg-emerald-600" },
  { email: "org_admin@demo.ai", password: "demo123", label: "Org Admin Demo", color: "bg-violet-500 hover:bg-violet-600" },
] as const;

export default function Login({ onLoggedIn }: { onLoggedIn: (u: PublicUser) => void }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyDemo, setBusyDemo] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("examiner-is-demo");
    }
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setBusy(true);
      try {
        if (tab === "login") {
          const res = await api.post<{ user: PublicUser }>("/api/auth/login", { email, password });
          onLoggedIn(res.user);
        } else {
          await api.put("/api/auth/login", { name, email, password, securityQuestion, securityAnswer });
          try {
            const res = await api.post<{ user: PublicUser }>("/api/auth/login", { email, password });
            onLoggedIn(res.user);
          } catch {
            setTab("login");
            setError("Account created — pending approval.");
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [tab, email, password, name, securityQuestion, securityAnswer, onLoggedIn]
  );

  const launchDemo = useCallback(
    async (demoEmail: string, demoPassword: string, label: string) => {
      setError("");
      setBusyDemo(label);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("examiner-is-demo", "1");
        }
        const res = await api.post<{ user: PublicUser }>("/api/auth/login", { email: demoEmail, password: demoPassword });
        onLoggedIn(res.user);
      } catch (err) {
        setError(`Demo login failed: ${err instanceof Error ? err.message : "unknown error"}`);
        if (typeof window !== "undefined") {
          localStorage.removeItem("examiner-is-demo");
        }
      } finally {
        setBusyDemo(null);
      }
    },
    [onLoggedIn]
  );

  if (showForgot) return <ForgotPassword onBack={() => setShowForgot(false)} />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 relative">
      {/* Top-right navigation links — visible to all visitors */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-4 text-sm font-medium z-10">
        <Link href="/courses" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
          Browse Courses
        </Link>
        <Link href="/for-business" className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <Briefcase className="h-3.5 w-3.5" />
          For Business
        </Link>
      </div>
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* LEFT: login form (existing) */}
        <div className="w-full max-w-md mx-auto space-y-6 text-center lg:text-left">
          {/* Logo */}
          <div className="flex flex-col items-center lg:items-start">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-4">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold">TraineesAI</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              We don&apos;t replace your engineers. We share the training burden.
            </p>
            <p className="text-xs text-muted-foreground/80 mt-2 max-w-xs">
              {COPY.heroEyebrow}
            </p>
          </div>

          {/* Demo buttons — 3 read-only role previews */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Try a Demo (Read-Only)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((demo) => {
                const isThisBusy = busyDemo === demo.label;
                return (
                  <Button
                    key={demo.email}
                    onClick={() => launchDemo(demo.email, demo.password, demo.label)}
                    disabled={busyDemo !== null}
                    className={`${demo.color} text-white flex-col h-auto py-3 gap-1.5`}
                    size="sm"
                  >
                    {isThisBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <GraduationCap className="h-5 w-5" />
                    )}
                    <span className="text-[10px] font-medium leading-tight">
                      {demo.label.replace(" Demo", "")}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Login / Signup card */}
          <Card>
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>Sign in to your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="mt-4">
                  <form onSubmit={submit} className="space-y-4">
                    <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" disabled={busy} className="w-full">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
                    >
                      Forgot password?
                    </button>
                  </form>
                </TabsContent>
                <TabsContent value="signup" className="mt-4">
                  <form onSubmit={submit} className="space-y-3">
                    <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                    <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Input placeholder="Security Question" value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} required />
                    <Input placeholder="Security Answer" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} required />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" disabled={busy} className="w-full">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: featured courses + marketing copy (hidden on small screens
            to keep the login form focused; revealed on lg breakpoint). */}
        <div className="hidden lg:block space-y-6">
          {/* Marketing headline */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              AI-driven curriculum
            </div>
            <h2 className="text-2xl xl:text-3xl font-bold leading-tight">
              Build the skills employers actually verify.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Project-based courses across technology, engineering, healthcare,
              finance, manufacturing, HR, compliance, and more. Every certificate
              links to a public verification page.
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Verified credentials
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Award className="h-4 w-4 text-primary" />
                Capstone projects
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GraduationCap className="h-4 w-4 text-primary" />
                AI tutor included
              </div>
            </div>
          </div>

          {/* Featured courses preview */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Featured Courses
            </h3>
            <FeaturedCourses />
          </div>
        </div>
      </div>
    </div>
  );
}
