import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import {
  Sparkles, ArrowRight, BookOpen, GraduationCap, Map as MapIcon,
} from "lucide-react";
import { LearnChrome } from "./learn-chrome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn â€” TraineesAI",
  description:
    "Your AI-guided learning home. Continue where you left off, or browse available courses and start a new one.",
};

/**
 * /learn â€” learner home.
 *
 * Authenticated users get the page inside the MAIN UI CONTAINER â€” the
 * adaptive AppShellV2 (learner nav, user menu, in-app footer) â€” so the
 * catalog no longer reads as a standalone site. Mobile reading is
 * preserved by the shell itself: the bottom nav tucks away while
 * scrolling and the content column keeps pb-24 clearance.
 *
 * Unauthenticated users keep the standalone public catalog (its own
 * slim header with a Sign-in CTA) â€” /learn is a public route and the
 * flag-off fallback for learners, so anonymous browsing must survive.
 *
 * Authenticated users see:
 *   - "Continue Learning" hero (their last active course + next lesson)
 *   - A factual course-enrolment count (no placeholder XP, level or streak values)
 *   - Catalog of other available courses
 *
 * Unauthenticated users see:
 *   - The catalog with "Start" buttons (which redirect to /app for login)
 */

export default async function LearnHome¶»§q«^u±•…‘¥¹œµÑ¥¡Ğˆø(€€€€€€€€€€€€€€€€€í±…ÍÑ½ÕÉÍ”¹¹…µ•ô(€€€€€€€€€€€€€€€€ğ½ Äø(€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰Ñ•áĞµ™œµµÕÑ•µĞ´Èµ…àµÜµá°Ñ•áĞµÍ´Í´éÑ•áĞµ‰…Í”ˆø(€€€€€€€€€€€€€€€€€A¥¬ÕÀİ¡•É”å½Ô±•™Ğ½™˜¸e½ÕÈ$ÑÕÑ½È¥ÌÉ•…‘äÑ¼İ…±¬å½ÔÑ¡É½Õ Ñ¡”¹•áĞÑ½Á¥Œ¸(€€€€€€€€€€€€€€€€ğ½Àø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğ™±•à™±•àµİÉ…À¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€€€€€€€€€ñ1¥¹¬(€€€€€€€€€€€€€€€€€€€¡É•˜õí€½±•…É¸¼‘í±…ÍÑ½ÕÉÍ”¹¥‘õô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÉ½Õ¹‘•µµ‰œµ‰É…¹Áà´ĞÁä´ÈÑ•áĞµÍ´™½¹Ğµµ•‘¥Õ´Ñ•áĞµ½¸µ‰É…¹¡½Ù•Èé‰œµ‰É…¹¼äÀˆ(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€I•ÍÕµ”Í•ÍÍ¥½¸€ñÉÉ½İI¥¡Ğ±…ÍÍ9…µ”ô‰ ´ĞÜ´Ğˆ€¼ø(€€€€€€€€€€€€€€€€€€ğ½1¥¹¬ø(€€€€€€€€€€€€€€€€€€ñ1¥¹¬(€€€€€€€€€€€€€€€€€€€¡É•˜õí€½±•…É¸¼‘í±…ÍÑ½ÕÉÍ”¹¥‘õô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµ™œµµÕÑ•¡½Ù•ÈéÑ•áĞµ™œ¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ôˆ(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€ñ5…Á%½¸±…ÍÍ9…µ”ô‰ ´Ì¸ÔÜ´Ì¸Ôˆ€¼øY¥•Ü©½ÕÉ¹•äµ…À(€€€€€€€€€€€€€€€€€€ğ½1¥¹¬ø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ¼ø(€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€ğø(€€€€€€€€€€€€€€€€ñ Ä±…ÍÍ9…µ”ô‰Ñ•áĞ´Éá°Í´éÑ•áĞ´Íá°™½¹Ğµ‰½±±•…‘¥¹œµÑ¥¡Ğˆø(€€€€€€€€€€€€€€€€€I•…‘äÑ¼ÍÑ…ÉĞ±•…É¹¥¹œ(€€€€€€€€€€€€€€€€ğ½ Äø(€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰Ñ•áĞµ™œµµÕÑ•µĞ´Èµ…àµÜµá°Ñ•áĞµÍ´Í´éÑ•áĞµ‰…Í”ˆø(€€€€€€€€€€€€€€€€€A¥¬„½ÕÉÍ”‰•±½ÜÑ¼‰•¥¸¸e½ÕÈ$ÑÕÑ½Èİ¥±°Õ¥‘”å½ÔÑ¡É½Õ •Ù•ÉäÑ½Á¥Œİ¥Ñ Í±¥‘•Ì°‘…¥±äÑ•ÍÑÌ°…¹„…ÁÍÑ½¹”ÁÉ½©•Ğ¸(€€€€€€€€€€€€€€€€ğ½Àø(€€€€€€€€€€€€€€ğ¼ø(€€€€€€€€€€€€¥ô((€€€€€€€€€‚ÚîÆ­y