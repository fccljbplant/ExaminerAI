import AppShell from "@/components/examiner/AppShell";
import ErrorBoundary from "@/components/examiner/ErrorBoundary";

/** /app — the main application (login + dashboard).
 *  The root page (/) shows the marketing landing page for non-authenticated
 *  visitors and redirects here for authenticated users. */
export default function AppPage() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
