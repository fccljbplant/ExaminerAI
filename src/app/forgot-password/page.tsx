"use client";

import { useRouter } from "next/navigation";
import ForgotPassword from "@/components/examiner/ForgotPassword";

/**
 * /forgot-password — links from the new /login screen.
 * Reuses the legacy ForgotPassword flow for now (W0 keeps behavior;
 * the restyle lands with the auth module cutover).
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  return <ForgotPassword onBack={() => router.push("/login")} />;
}
