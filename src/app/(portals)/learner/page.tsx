import type { Metadata } from "next";
import { LearnerHome } from "@/modules/learner-portal";
import { UIToggle } from "@/modules/ui-v3";

/**
 * /learner — L1 Home (REDESIGN-P3 §L1).
 * Auth / role / portal-flag guards live in the route-group layout.
 * The UIToggle appears directly on the home page so any user can switch
 * between v2 and v3 interfaces.
 */

export const metadata: Metadata = {
  title: "Home — TraineesAI",
};

export default function LearnerHomePage() {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 0 8px" }}>
        <UIToggle />
      </div>
      <LearnerHome />
    </>
  );
}
