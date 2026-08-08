import Link from "next/link";
import type { Metadata } from "next";
import { Clock, BookOpen, Sparkles, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchMarketplacePaths } from "@/lib/marketplace";
import { formatPrice } from "@/lib/format";

// Force dynamic rendering — this page queries Prisma at request time.
// Without this, Next.js tries to statically prerender the page during
// the build, which exhausts the DB connection pool on Vercel.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learning Paths — TraineesAI",
  description: "Browse professional learning paths — role-based curriculum bundles that take you from beginner to job-ready.",
  alternates: { canonical: "/paths" },
  openGraph: {
    title: "Learning Paths — TraineesAI",
    description: "Role-based curriculum bundles for professional careers.",
  },
};

export default async function PathsPage() {
  const paths = await fetchMarketplacePaths();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>TraineesAI</span>
            <span className="text-muted-foreground">/ Paths</span>
          </Link>
          <Button asChild variant="ghost" size="sm"><Link href="/courses">Browse Courses</Link></Button>
        </div>
      </header>

      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <Badge variant="secondary" className="mb-3"><RouteIcon className="h-3 w-3 mr-1" /> Career Tracks</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Learning Paths</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Bundles of courses that form a complete career trajectory — from fundamentals to capstone project.
            Enroll in a path and save compared to buying courses individually.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        {paths.length === 0 ? (
          <div className="text-center py-20">
            <RouteIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold">No learning paths yet</h2>
            <p className="text-sm text-muted-foreground mt-1">We're curating career tracks. Check back soon!</p>
            <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/courses">Browse Individual Courses</Link></Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((path) => (
              <Card key={path.id} className="overflow-hidden py-0 gap-0 transition-shadow hover:shadow-md flex flex-col">
                <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-background px-4 py-5 flex items-center gap-3 border-b border-border">
                  <span className="text-3xl leading-none" aria-hidden>{path.icon || "🎓"}</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base leading-tight line-clamp-2">{path.title}</h3>
                    {path.subtitle && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{path.subtitle}</p>}
                  </div>
                </div>
                <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground line-clamp-3">{path.description}</p>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">{path.level}</Badge>
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {path.courseCount} course{path.courseCount === 1 ? "" : "s"}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {path.durationWeeks}w</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
                    <span className="text-base font-semibold">{path.price === 0 ? <span className="text-growth-sage">Free</span> : formatPrice(path.price, path.currency)}</span>
                    <Button asChild size="sm"><Link href={`/paths/${path.id}`}>View Path</Link></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} TraineesAI · AI-driven curriculum · Verified digital credentials
        </div>
      </footer>
    </div>
  );
}
