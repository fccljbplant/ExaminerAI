import type { Metadata } from "next";
import { InstructorEarnings } from "@/modules/instructor-portal";

/**
 * /instructor/earnings — I10 Earnings (REDESIGN-P3 §I10, W6).
 */

export const metadata: Metadata = {
  title: "Earnings — TraineesAI",
};

export default function InstructorEarningsPage() {
  return <InstructorEarnings />;
}
