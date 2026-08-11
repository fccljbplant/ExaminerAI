import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { LearnShell } from "@/components/learn/LearnShell";

export const dynamic = "force-dynamic";

/**
 * /learn/[courseId] — full-screen learning session.
 *
 * Renders the LearnShell component which contains the avatar dock,
 * slide canvas, chat pane, and 4 slide-over panels.
 *
 * If the user is not authenticated, the middleware will redirect them
 * to /app (login). The page itself also checks auth defensively and
 * renders the shell only for logged-in users.
 *
 * The course must exist and be active.
 */
export default async function LearnSessionPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await getAuthUser();

  // Defensive: middleware already redirects unauthenticated users, but
  // if they hit this page directly we re-check.
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Please sign in to start learning.</p>
          <a href="/app" className="mt-2 inline-block text-primary underline">Go to sign in</a>
        </div>
      </div>
    );
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, isActive: true },
  });
  if (!course || !course.isActive) notFound();

  return <LearnShell courseId={course.id} courseName={course.name} />;
}
