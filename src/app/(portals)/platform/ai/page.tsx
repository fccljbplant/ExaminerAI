import type { Metadata } from "next";
import { PlatformAI } from "@/modules/platform-portal";

/**
 * /platform/ai — P4 AI usage & limits (V1 AILimitsPanel re-homed).
 */

export const metadata: Metadata = {
  title: "AI — TraineesAI",
};

export default function PlatformAIPage() {
  return <PlatformAI />;
}
