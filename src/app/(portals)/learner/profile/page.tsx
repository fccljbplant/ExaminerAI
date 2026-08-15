import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LearnerProfile } from "@/modules/learner-portal";

/**
 * /learner/profile — L13 Profile & settings (REDESIGN-P3 §L13).
 * User identity is server-fetched; interactions live in the module.
 */

export const metadata: Metadata = {
  title: "Profile — TraineesAI",
};

export default async function LearnerProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <LearnerProfile
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        joinedAt: user.createdAt.toISOString(),
      }}
    />
  );
}
