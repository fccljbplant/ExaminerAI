import type { Metadata } from "next";
import { AuthLayout, RegisterForm } from "@/modules/auth";

/**
 * /register — new-kit auth screen (REDESIGN-P2, W0).
 * Replaces the legacy redirect into the /app shell.
 */

export const metadata: Metadata = {
  title: "Create account — TraineesAI",
};

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your account"
      description="Start learning with project-based courses."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
