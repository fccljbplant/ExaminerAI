import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ModernLanding } from "@/components/landing/modern-landing";

/** Root page — shows the marketing landing page for non-authenticated visitors.
 *  Authenticated users are redirected to the app dashboard. */
export default async function Page() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/app");
  }
  return <ModernLanding />;
}
