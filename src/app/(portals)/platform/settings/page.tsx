import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RoleSettings } from "@/modules/shell/role-settings";

/**
 * /platform/settings — user settings for platform admins (2026-08-15).
 * Avatar, appearance and password — the same experience every role gets.
 */

export const metadata: Metadata = {
  title: "Settings — TraineesAI",
};

export default async function PlatformSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <RoleSettings
      title="Platform admin settings"
      user={{ name: user.name, email: user.email, role: user.role }}
    />
  );
}
