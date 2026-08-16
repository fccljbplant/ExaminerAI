"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppShellV2, UnifiedThemeToggle, UserMenu } from "@/modules/shell";
import type { NavItem } from "@/modules/shell";
import { api } from "@/lib/api-client";
import { ORG_NAV, ORG_MORE } from "./nav";

/**
 * modules/org-portal — OrgShell (REDESIGN-P3 §3, W7)
 *
 * Org admin chrome on the adaptive shell: Home / People / Control /
 * Reports / More (5 slots). More hosts Billing (landing later) and the
 * remaining O3/O6/O7 surfaces.
 *
 * The header shows the ORGANIZATION's identity — custom logo (from
 * Control → Organization profile) before the org name, linking to the
 * org's public storefront page. The profile is fetched client-side and
 * refreshed instantly when Control saves (org-profile-updated event).
 */

const NAV: NavItem[] = ORG_NAV;

export { ORG_MORE };

interface OrgProfile {
  name: string;
  slug: string;
  logoUrl: string | null;
}

export function OrgShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const [org, setOrg] = useState<OrgProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get<{ ok: boolean; data: { organization: OrgProfile | null } }>("/api/v2/org/settings")
        .then((res) => {
          if (!cancelled) setOrg(res.data?.organization ?? null);
        })
        .catch(() => {
          /* org identity is best-effort — fall back to the platform brand */
        });
    };
    load();
    window.addEventListener("org-profile-updated", load);
    return () => {
      cancelled = true;
      window.removeEventListener("org-profile-updated", load);
    };
  }, []);

  return (
    <>
      <AppShellV2
        nav={NAV}
        brand={
          org
            ? {
                name: org.name,
                href: `/${org.slug}`,
                logo: org.logoUrl ? (
                   
                  <img
                    src={org.logoUrl}
                    alt={`${org.name} logo`}
                    className="h-7 w-7 rounded-md border border-line object-cover"
                  />
                ) : undefined,
              }
            : { name: "TraineesAI" }
        }
        trailing={
          <>
            <UnifiedThemeToggle />
            <UserMenu userName={userName} profileHref="/org" profileLabel="Dashboard" settingsHref="/org/settings" helpHref="/org/help" />
          </>
        }
      >
        {children}
      </AppShellV2>
    </>
  );
}
