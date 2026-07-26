/**
 * AI Assistant — In-Action Teaching (Section 7)
 *
 * Every Action Dialog that represents a significant interpersonal action
 * includes brief, contextual guidance alongside the suggested action.
 *
 * - What this situation likely means (plain language, flag-type-specific)
 * - One or two grounded principles (ask-don't-tell, validate-before-solving,
 *   GROW-stage framing where relevant)
 * - Collapsed/secondary by default — available in one click, not forced
 *
 * This module provides the flag-type-specific guidance templates that the
 * Action Dialog API (Section 4) uses to generate contextual guidance.
 */

export interface FlagGuidance {
  whatItMeans: string;
  principles: string[];
}

/** Guidance templates per flag type — these are the baseline; the AI
 *  generates flag-specific variations using these as the system prompt. */
export const FLAG_GUIDANCE_TEMPLATES: Record<string, FlagGuidance> = {
  // Student wellbeing flags
  psychological: {
    whatItMeans: "A psychological flag means the student's behavior patterns suggest emotional distress or disengagement. This is not a diagnosis — it's a signal that something may be affecting their ability to learn.",
    principles: [
      "Ask don't tell — approach with curiosity: 'I noticed you seemed quieter this week. How are things?'",
      "Validate before solving — acknowledge their experience before offering solutions. 'That sounds really hard' before 'Have you tried...'",
    ],
  },

  educational: {
    whatItMeans: "An educational flag means the student's scores or engagement have dropped below expected thresholds. This could indicate gaps in understanding, uncertainty during tests, or external factors affecting study time.",
    principles: [
      "Focus on the process, not the outcome — 'What's getting in the way when you sit down to study?' rather than 'Why did you score low?'",
      "GROW-stage: If they're in forethought (planning), help them structure. If in performance, help them execute. If in reflection, help them learn from it.",
    ],
  },

  mentorship: {
    whatItMeans: "A mentorship flag means the student hasn't been in contact recently or their engagement streak has broken. This often signals that something has changed — they may need a check-in, not a push.",
    principles: [
      "Ask don't tell — 'I haven't seen you in a few days. Everything okay?' rather than 'You need to log in more.'",
      "GROW framing: Start with Reality (where are they now?) before Goal (what should they be doing?)",
    ],
  },

  // Teacher load flags
  teacher_load: {
    whatItMeans: "A teacher load flag means this teacher is carrying more students, batches, or active alerts than typical. High load sustained over time leads to burnout — this is a systemic signal, not a performance issue.",
    principles: [
      "Frame as support, not criticism — 'I noticed your caseload is heavy. How can we redistribute?'",
      "Offer concrete help, not just acknowledgment — a co-teacher assignment or follow-up relief is more useful than 'take care of yourself.'",
    ],
  },

  // Safeguarding flags (principal-only)
  safeguarding: {
    whatItMeans: "A safeguarding flag means multiple signals in this teacher's communication with a student have triggered the deterministic pre-filter. This is a serious concern that requires your judgment as principal.",
    principles: [
      "Review the evidence references before acting — the flag includes message IDs, not verdicts.",
      "Consider the pattern, not just individual messages — single messages may have context; a pattern is the signal.",
    ],
  },

  // Crisis (red-tier, any source)
  crisis: {
    whatItMeans: "A crisis flag means this situation has been escalated to the highest urgency. The student (or teacher) may be in immediate distress. Time matters.",
    principles: [
      "Act now, document after — reach out immediately, record what happened afterward.",
      "If this involves potential harm, follow your institution's crisis protocol before anything else.",
    ],
  },
};

/**
 * Get guidance for a specific flag type.
 * Falls back to a generic template if the type is unknown.
 */
export function getGuidanceForFlagType(flagType: string): FlagGuidance {
  const normalized = flagType.toLowerCase().trim();

  // Check for crisis-level flags
  if (normalized.includes("crisis") || normalized.includes("red")) {
    return FLAG_GUIDANCE_TEMPLATES.crisis;
  }

  return FLAG_GUIDANCE_TEMPLATES[normalized] || {
    whatItMeans: `This ${flagType} flag indicates a pattern that may need intervention. Review the specific trigger data before deciding how to respond.`,
    principles: [
      "Ask don't tell — approach with curiosity, not assumptions.",
      "Validate before solving — acknowledge the person's experience before offering solutions.",
    ],
  };
}

/**
 * Build the guidance section for the Action Dialog system prompt.
 * This is injected into the AI prompt so the generated guidance is
 * flag-type-specific, not generic.
 */
export function buildGuidancePromptSection(flagType: string): string {
  const guidance = getGuidanceForFlagType(flagType);
  return `Guidance context for this flag type (${flagType}):
- What it means: ${guidance.whatItMeans}
- Principles: ${guidance.principles.join(" | ")}

Generate guidance that is specific to THIS flag instance, using the above as the baseline. Do not copy the template verbatim — adapt it to the specific trigger data.`;
}
