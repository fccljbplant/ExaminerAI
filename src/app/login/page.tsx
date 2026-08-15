import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * /login — removed as a standalone page (2026-08-15).
 *
 * Sign-in now lives embedded in the homepage hero (right column), so
 * every old /login link lands there. Signed-in visitors are bounced to
 * their dashboard by the homepage itself.
 */

export const metadata: Metadata = {
  title: "Sign in — TraineesAI",
};

export default function LoginPage() {
  redirect("/");
}
