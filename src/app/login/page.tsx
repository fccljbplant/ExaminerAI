import { redirect } from "next/navigation";

/**
 * /login → /app
 *
 * Authentication lives in the old /app shell. /learn redirects here
 * when an unauthenticated user clicks "Start".
 */
export default function LoginRedirect(): never {
  redirect("/app");
}
