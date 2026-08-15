import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RoleSettings } from "@/modules/shell/role-settings";

/**
 * /org/settings — user settings for org admins (2026-08-15).
 * Avatar, appearance and password — the same experience every role gets.
 */

export const metadata: Metadata = {
  title: "Settings — TraineesAI",
};

export default async function OrgSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <RoleSettings
      title="Org admin settings"
      user={{ name: user.name, email: user.email, role: user.role }}
    />
  );
}
