import { redirect } from "next/navigation";

/**
 * /instructor — portal root. The review center is the instructor home
 * for W4; the full dashboard lands with W6.
 */

export default function InstructorRootPage() {
  redirect("/instructor/review");
}
