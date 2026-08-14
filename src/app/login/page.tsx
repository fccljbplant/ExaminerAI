import type { Metadata } from "next";
import { AuthLayout, LoginForm } from "@/modules/auth";

/**
 * /login — new-kit auth screen (REDESIGN-P2, W0).
 * Replaces the legacy redirect into the /app shell.
 */

export const metadata: Metadata = {
  title: "Sign in — TraineesAI",
};

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" description="Sign in to your dashboard.">
      <LoginForm />
    </AuthLayout>
  );
}
