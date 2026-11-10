/**
 * GET /api/v2/learner/home â€” L1 Home aggregation (REDESIGN-P3 Â§L1)
 *
 * One request feeds the whole home fold: continue card, learner
 * totals, due-today list and announcements. Fields-selected, no
 * nested entities the page doesn't render.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getTodayTopic } from "@/modules/learn/lib/today-topic";
import { getLearnerLevel } from "@/modules/learn/lib/xp-ledger";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  // A failed profile lookup must not be presented as a genuine empty
  // enrollment state. Fail the aggregate so the client can offer a retry.
  let profiles: any[];
  try {
    profiles = await db.learnProfile.findMany({
      where: { userId: user.sub },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
  } catch (e) {
    console.error("Learner home profile lookup failed:", e);
    return apiError(
      "Your dashboard is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }

  /* ---- continue card: most recently active course ---- */
  let continueCard: {
    courseId: string;
    courseName: string;
    nextLesson: string;
    kind: "learn" | "review" | "done";
    href: string;
  } | null = null;

  i¶»§q«^uÍÑÉ¥¹œì(€€€ÍÑ…ÑÕÌèÍÑÉ¥¹œì(€€€½ÕÉÍ•9…µ”èÍÑÉ¥¹œğ¹Õ±°ì(€€€Ñ…Í­AÉ½É•ÍÌè¹Õµ‰•Èì(€€€Ñ…Í­Í½¹”èÍÑÉ¥¹œì(€õmt€ômtì(€ÑÉäì(€€€½¹ÍĞÉ½İÌ€ô…İ…¥Ğ‘ˆ¹±•…É¹AÉ½©•Ğ¹™¥¹‘5…¹ä¡ì(€€€€€İ¡•É”èìÕÍ•É%èÕÍ•È¹ÍÕˆô°(€€€€€½É‘•É	äèìÕÁ‘…Ñ•‘Ğè€‰‘•ÍŒˆô°(€€€€€Ñ…­”è€Ğ°(€€€€€¥¹±Õ‘”èìÑ…Í­ÌèìÍ•±•Ğèì¥èÑÉÕ”°ÍÑ…ÑÕÌèÑÉÕ”ôôô°(€€€ô¤ì(€€€½¹ÍĞ½ÕÉÍ•I½İÌ€ô…İ…¥Ğ‘ˆ¹½ÕÉÍ”¹™¥¹‘5…¹ä¡ì(€€€€€İ¡•É”èì¥èì¥¸èÉ½İÌ¹µ…À ¡À¤€ôøÀ¹½ÕÉÍ•%¤¹™¥±Ñ•È¡	½½±•…¸¤…ÌÍÑÉ¥¹mtôô°(€€€€€Í•±•Ğèì¥èÑÉÕ”°¹…µ”èÑÉÕ”ô°(€€€ô¤ì(€€€½¹ÍĞ½ÕÉÍ•9…µ•Ì€ô¹•Ü5…À¡½ÕÉÍ•I½İÌ¹µ…À ¡Œ¤€ôømŒ¹¥°Œ¹¹…µ•t¤¤ì(€€€ÁÉ½©•ÑÌ€ôÉ½İÌ¹µ…À ¡À¤€ôøì(€€€€€½¹ÍĞÑ½Ñ…°€ôÀ¹Ñ…Í­Ì¹±•¹Ñ ì(€€€€€½¹ÍĞ‘½¹”€ôÀ¹Ñ…Í­Ì¹™¥±Ñ•È ¡Ğ¤€ôøĞ¹ÍÑ…ÑÕÌ€ôôô€‰½µÁ±•Ñ•ˆ¤¹±•¹Ñ ì(€€€€€É•ÑÕÉ¸ì(€€€€€€€¥èÀ¹¥°(€€€€€€€Ñ¥Ñ±”èÀ¹Ñ¥Ñ±”°(€€€€€€€ÍÑ…ÑÕÌèÀ¹ÍÑ…ÑÕÌ°(€€€€€€€½ÕÉÍ•9…µ”èÀ¹½ÕÉÍ•%€ü½ÕÉÍ•9…µ•Ì¹•Ğ¡À¹½ÕÉÍ•%¤€üü¹Õ±°€è¹Õ±°°(€€€€€€€Ñ…Í­AÉ½É•ÍÌèÑ½Ñ…°€ø€À€ü5…Ñ ¹É½Õ¹ ¡‘½¹”€¼Ñ½Ñ…°¤€¨€ÄÀÀ¤€è€À°(€€€€€€€Ñ…Í­Í½¹”è€‘í‘½¹•ô¼‘íÑ½Ñ…±õ€°(€€€€€ôì(€€€ô¤ì(€ô…Ñ €¡”¤ì(€€€½¹Í½±”¹•ÉÉ½È ‰1•…É¹•È¡½µ”ÁÉ½©•Ğ±½½­ÕÀ™…¥±•èˆ°”¤ì(€€€É•ÑÕÉ¸…Á¥ÉÉ½È (€€€€€€‰e½ÕÈ‘…Í¡‰½…É¥ÌÑ•µÁ½É…É¥±äÕ¹…Ù…¥±…‰±”¸A±•…Í”ÑÉä……¥¸¸ˆ°(€€€€€€‰MIY%}U9Y%1	1ˆ°(€€€€€€ÔÀÌ°(€€€€¤ì(€ô((€€¼¨€´´´´±•…É¹•ÈÑ½Ñ…±Ì…É½ÍÌ½ÕÉÍ•Ì€´´´´€¨¼(€½¹ÍĞÑ½Ñ…±a@€ôÁÉ½™¥±•Ì¹É•‘Õ” ¡ÍÕ´°À¤€ôøÍÕ´€¬À¹Ñ½Ñ…±a@°€À¤ì(€½¹ÍĞÍÑÉ•…­ÕÉÉ•¹Ğ€ôÁÉ½™¥±•Ì¹É•‘Õ” ¡µ…à°À¤€ôø5…Ñ ¹µ…à¡µ…à°À¹ÍÑÉ•…­ÕÉÉ•¹Ğ¤°€À¤ì((€É•ÑÕÉ¸…Á¥MÕ•ÍÌ¡ì(€€€±•…É¹•Èèì(€€€€€Ñ½Ñ…²ÚîÆ­y