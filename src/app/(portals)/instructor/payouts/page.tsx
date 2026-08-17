import type { Metadata } from "next";
import { InstructorPayouts } from "@/modules/instructor-portal/payouts";

/**
 * /instructor/payouts — creator-economy payouts (2026-08-17).
 * Direct import (not the client barrel) — the barrel stays untouched.
 */

export const metadata: Metadata = {
  title: "Payouts — TraineesAI",
};

export default function InstructorPayoutsPage() {
  return <InstructorPayouts />;
}
