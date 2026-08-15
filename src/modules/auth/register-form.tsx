"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/modules/ui/button";
import { Input } from "@/modules/ui/input";
import { Label } from "@/modules/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/select";

/**
 * modules/auth — RegisterForm (new kit, REDESIGN-P2)
 *
 * PUT /api/auth/login creates the account (may require org approval),
 * then we sign in immediately. If sign-in fails the account is pending
 * approval and we tell the user so.
 */

export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was your first teacher's name?",
  "What is your favorite programming language?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What was your childhood nickname?",
  "What is the name of the street you grew up on?",
];

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setBusy(true);
      try {
        await api.put("/api/auth/login", {
          name,
          email,
          password,
          securityQuestion,
          securityAnswer,
        });
        try {
          await api.post("/api/auth/login", { email, password });
          router.push("/learner");
        } catch {
          setPending(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [name, email, password, securityQuestion, securityAnswer, router]
  );

  if (pending) {
    return (
      <div className="space-y-4 rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-medium text-fg">Account created</p>
        <p className="text-sm text-fg-secondary">
          You&apos;re all set — sign in with your email and password to start learning.
        </p>
        <Button asChild className="h-11 w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reg-name" className="text-fg">
            Full name
          </Label>
          <Input
            id="reg-name"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 bg-surface"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-email" className="text-fg">
            Email
          </Label>
          <Input
            id="reg-email"
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
          <Label htmlFor="reg-password" className="text-fg">
            Password
          </Label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 bg-surface"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-question" className="text-fg">
            Security question
          </Label>
          <Select value={securityQuestion} onValueChange={setSecurityQuestion}>
            <SelectTrigger id="reg-question" className="h-11 bg-surface">
              <SelectValue placeholder="Choose a question" />
            </SelectTrigger>
            <SelectContent>
              {SECURITY_QUESTIONS.map((q) => (
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-fg-muted">
            Lets you reset your password instantly without an admin.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-answer" className="text-fg">
            Your answer
          </Label>
          <Input
            id="reg-answer"
            autoComplete="off"
            placeholder="Type your answer"
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            className="h-11 bg-surface"
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="h-11 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-fg-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
