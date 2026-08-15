import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Building2, MapPin, Users, GraduationCap, PackageOpen } from "lucide-react";
import { fetchOrgStorefront } from "@/modules/site/lib/org-storefront";
import MarketplaceCourseCard from "../courses/MarketplaceCourseCard";

type Params = { params: Promise<{ orgSlug: string }> };

/**
 * /[orgSlug] — public organization storefront (2026-08-15).
 *
 * Every organization gets a public page at its slug (e.g.
 * /inzetenterprises) listing its profile + catalog, branded with the
 * org's theme color. Static routes ( /courses, /pricing … ) always win
 * over this dynamic segment; reserved slugs and unknown names 404.
 */

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { orgSlug } = await params;
  const storefront = await fetchOrgStorefront(orgSlug);
  if (!storefront) return { title: "Not Found — TraineesAI" };
  return {
    title: `${storefront.org.name} — Training by ${storefront.org.name} | TraineesAI`,
    description:
      storefront.org.description ??
      `${storefront.org.name} runs their professional training on TraineesAI — browse their courses and verified certificates.`,
    alternates: { canonical: `/${storefront.org.slug}` },
  };
}

export default async function OrgStorefrontPage({ params }: Params) {
  const { orgSlug } = await params;
  const storefront = await fetchOrgStorefront(orgSlug);
  if (!storefront) notFound();
  const { org, courses } = storefront;
  const brand = org.brandHex ?? "var(--brand)";

  return (
    <div>
      {/* Org header band */}
      <section className="border-b border-line bg-surface/60">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {org.logoUrl ? (
               
              <img
                src={org.logoUrl}
                alt={`${org.name} logo`}
                className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
              />
            ) : (
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white"
                style={{ backgroundColor: brand }}
              >
                <Building2 className="h-7 w-7" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                Training organization
              </p>
              <h1 className="mt-1 text-2xl font-bold text-fg sm:text-3xl">{org.name}</h1>
              {org.description && (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-secondary">
                  {org.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden /> {org.memberCount} members
                </span>
                {org.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {org.address}
                  </span>
                )}
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                  >
                    {org.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: brand }}
              >
                <PackageOpen className="h-3.5 w-3.5" aria-hidden />
                {courses.length} {courses.length === 1 ? "course" : "courses"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface/40 p-10 text-center">
            <PackageOpen className="mx-auto h-6 w-6 text-fg-muted" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-fg">No courses published yet</p>
            <p className="mt-1 text-xs text-fg-muted">
              {org.name} hasn&apos;t added any courses to their public catalog. Check back soon.
            </p>
            <Link
              href="/courses"
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
            >
              Browse the marketplace
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-fg">Courses by {org.name}</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Enroll directly — progress, AI tutoring and certificates run on TraineesAI.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <MarketplaceCourseCard key={course.id} course={course} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
