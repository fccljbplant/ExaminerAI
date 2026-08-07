import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";

/** Root page — always useful.
 *  - Authenticated users are redirected to their dashboard at /app.
 *  - Visitors (not logged in) are redirected to the marketplace at /courses,
 *    so the home page IS the course catalog (like Udemy / Coursera). */
export default async function Page() {
  const user = await getAuthUser();
  if (user) redirect("/app");
  redirect("/courses");
}
