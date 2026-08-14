import type { Metadata } from "next";
import { OrgRegistries } from "@/modules/org-portal";

/**
 * /org/registries — O3 Registries editor (REDESIGN-P3 §O3, W7).
 */

export const metadata: Metadata = {
  title: "Registries — TraineesAI",
};

export default function OrgRegistriesPage() {
  return <OrgRegistries />;
}
