import { redirect } from "next/navigation";

/**
 * /register → /app
 *
 * Registration lives in the old /app shell.
 */
export default function RegisterRedirect(): never {
  redirect("/app");
}
