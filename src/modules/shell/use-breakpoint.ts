"use client";

import { useEffect, useState } from "react";
import type { BreakpointClass } from "./types";

/**
 * modules/shell — useBreakpoint (REDESIGN-P2 §5)
 *
 * Returns the current breakpoint class, mobile-first: SSR and first
 * paint assume "xs", then correct after hydration. All shell
 * structure decisions key off this single hook.
 */

const QUERIES: { bp: BreakpointClass; query: string }[] = [
  { bp: "xl", query: "(min-width: 1280px)" },
  { bp: "lg", query: "(min-width: 1024px)" },
  { bp: "md", query: "(min-width: 768px)" },
];

export function useBreakpoint(): BreakpointClass {
  const [bp, setBp] = useState<BreakpointClass>("xs");

  useEffect(() => {
    const compute = () => {
      const hit = QUERIES.find(({ query }) => window.matchMedia(query).matches);
      setBp(hit?.bp ?? "xs");
    };
    compute();
    const mqls = QUERIES.map(({ query }) => window.matchMedia(query));
    mqls.forEach((m) => m.addEventListener("change", compute));
    return () => mqls.forEach((m) => m.removeEventListener("change", compute));
  }, []);

  return bp;
}
