/**
 * Lightweight per-message psychological analyzer.
 *
 * NO AI call — pure heuristic text analysis. Runs on every AI Tutor message
 * in <1ms. Extracts engagement + emotional signals from the student's text.
 *
 * These signals are aggregated daily into StudentHealthSummary.psych fields
 * (moodScore, engagementScore, frustrationCount, etc.).
 *
 * Based on established psychological frameworks:
 * - Self-Determination Theory (SDT): autonomy, competence, relatedness
 * - Cognitive Behavioral patterns: avoidance, catastrophizing, all-or-nothing
 * - Growth vs. Fixed mindset (Dweck): language signals
 * - Academic engagement (Fredericks): behavioral + emotional + cognitive
 *
 * The scores are HEURISTIC, not clinical. They're for early-warning teacher
 * alerts, not diagnosis. A low moodScore doesn't mean the student is depressed
 * — it means the teacher should check in.
 */

/** Per-message psych snapshot — lightweight, no AI call. */
export interface MessagePsychSnapshot {
  moodScore: number;        // 0-100 (0=very frustrated, 100=very positive)
  engagementScore: number;  // 0-100 (0=disengaged, 100=highly engaged)
  frustrationSignal: boolean;
  avoidanceSignal: boolean;
  enthusiasmSignal: boolean;
  signals: string[];        // human-readable list of what was detected
}

// Frustration signals — words/phrases indicating the student is struggling emotionally
const FRUSTRATION_SIGNALS = [
  "frustrated", "annoyed", "angry", "hate this", "stupid", "can't do", "cant do",
  "give up", "quit", "too hard", "too difficult", "impossible", "waste of time",
  "don't understand", "dont understand", "makes no sense", "confusing",
  "overwhelming", "stressed", "anxious", "worried", "scared", "afraid",
  "tired", "exhausted", "burnt out", "burned out", "done with",
];

// Avoidance signals — the student is trying to escape the task
const AVOIDANCE_SIGNALS = [
  "i don't know", "i dont know", "skip", "pass", "no idea", "not sure",
  "whatever", "don't care", "dont care", "don't want", "dont want",
  "can we do something else", "boring", "not interested",
];

// Enthusiasm signals — the student is engaged and positive
const ENTHUSIASM_SIGNALS = [
  "interesting", "cool", "awesome", "love", "excited", "great",
  "understand now", "makes sense", "got it", "i see", "ohh",
  "thank you", "thanks", "helpful", "learned", "learning",
  "want to try", "let me try", "i'll try", "i will try",
  "can you explain more", "tell me more", "what about",
];

// Growth-mindset signals (Dweck) — effort-based language
const GROWTH_SIGNALS = [
  "learn", "practice", "improve", "try again", "keep going",
  "get better", "work hard", "put in effort", "challenge",
];

/** Analyze a single student message — returns psych signals. No AI call. */
export function analyzeMessage(text: string): MessagePsychSnapshot {
  const lower = text.toLowerCase();
  const signals: string[] = [];

  let moodScore = 50; // neutral baseline
  let engagementScore = 50; // neutral baseline

  // Check frustration
  const frustrationHits = FRUSTRATION_SIGNALS.filter(s => lower.includes(s));
  if (frustrationHits.length > 0) {
    moodScore -= 20 * Math.min(frustrationHits.length, 3);
    signals.push(`Frustration: "${frustrationHits[0]}"`);
  }

  // Check avoidance
  const avoidanceHits = AVOIDANCE_SIGNALS.filter(s => lower.includes(s));
  if (avoidanceHits.length > 0) {
    moodScore -= 15;
    engagementScore -= 25;
    signals.push(`Avoidance: "${avoidanceHits[0]}"`);
  }

  // Check enthusiasm
  const enthusiasmHits = ENTHUSIASM_SIGNALS.filter(s => lower.includes(s));
  if (enthusiasmHits.length > 0) {
    moodScore += 15 * Math.min(enthusiasmHits.length, 3);
    engagementScore += 20 * Math.min(enthusiasmHits.length, 2);
    signals.push(`Enthusiasm: "${enthusiasmHits[0]}"`);
  }

  // Check growth mindset
  const growthHits = GROWTH_SIGNALS.filter(s => lower.includes(s));
  if (growthHits.length > 0) {
    engagementScore += 10;
    moodScore += 5;
    signals.push(`Growth mindset: "${growthHits[0]}"`);
  }

  // Engagement from message length
  if (text.length > 200) {
    engagementScore += 15;
    signals.push("Detailed response (200+ chars)");
  } else if (text.length > 50) {
    engagementScore += 5;
  } else if (text.length < 20 && text.length > 0) {
    engagementScore -= 10;
    signals.push("Very short response");
  }

  // Engagement from question-asking (active learning)
  if (lower.includes("?") || lower.includes("kya") || lower.includes("kyun")) {
    engagementScore += 10;
    signals.push("Asked a question");
  }

  // Clamp scores
  moodScore = Math.max(0, Math.min(100, moodScore));
  engagementScore = Math.max(0, Math.min(100, engagementScore));

  return {
    moodScore,
    engagementScore,
    frustrationSignal: frustrationHits.length > 0,
    avoidanceSignal: avoidanceHits.length > 0,
    enthusiasmSignal: enthusiasmHits.length > 0,
    signals: signals.length > 0 ? signals : ["Neutral engagement"],
  };
}

/** Check if the aggregated psych data triggers any alerts.
 *  Returns alert recommendations for the teacher. */
export function checkAlertThresholds(summary: {
  moodScore: number;
  engagementScore: number;
  frustrationCount: number;
  avoidanceCount: number;
  enthusiasmCount: number;
  avgScoreThisWeek: number | null;
  avgScoreLastWeek: number | null;
  engagementStreak: number;
  tutorMessagesThisWeek: number;
  lastActiveDate: Date | null;
}): Array<{
  type: "psychological" | "educational" | "mentorship";
  severity: "warning" | "red";
  reason: string;
  metric: string;
  metricValue: string;
}> {
  const alerts: Array<{
    type: "psychological" | "educational" | "mentorship";
    severity: "warning" | "red";
    reason: string;
    metric: string;
    metricValue: string;
  }> = [];

  // === PSYCHOLOGICAL ALERTS ===
  if (summary.moodScore < 30) {
    alerts.push({
      type: "psychological",
      severity: "red",
      reason: `Student mood score is very low (${summary.moodScore}/100). Multiple frustration or avoidance signals detected. Consider a wellbeing check-in.`,
      metric: "moodScore",
      metricValue: String(summary.moodScore),
    });
  } else if (summary.moodScore < 45 && summary.frustrationCount > 3) {
    alerts.push({
      type: "psychological",
      severity: "warning",
      reason: `Student mood is below average (${summary.moodScore}/100) with ${summary.frustrationCount} frustration signals this week. A gentle check-in may help.`,
      metric: "moodScore",
      metricValue: String(summary.moodScore),
    });
  }

  if (summary.avoidanceCount > 5) {
    alerts.push({
      type: "psychological",
      severity: "warning",
      reason: `Student showed ${summary.avoidanceCount} avoidance responses ("I don't know" / "skip") this week. May indicate anxiety or lack of confidence.`,
      metric: "avoidanceCount",
      metricValue: String(summary.avoidanceCount),
    });
  }

  // === EDUCATIONAL ALERTS ===
  if (summary.avgScoreThisWeek !== null && summary.avgScoreThisWeek < 40) {
    alerts.push({
      type: "educational",
      severity: "red",
      reason: `Average test score this week is ${summary.avgScoreThisWeek.toFixed(0)}% — below 40%. The student is struggling with the material. Consider reviewing fundamentals or adjusting pace.`,
      metric: "avgScoreThisWeek",
      metricValue: summary.avgScoreThisWeek.toFixed(1),
    });
  } else if (summary.avgScoreThisWeek !== null && summary.avgScoreLastWeek !== null) {
    const drop = summary.avgScoreLastWeek - summary.avgScoreThisWeek;
    if (drop > 15) {
      alerts.push({
        type: "educational",
        severity: "warning",
        reason: `Test score dropped ${drop.toFixed(0)} points (from ${summary.avgScoreLastWeek.toFixed(0)}% to ${summary.avgScoreThisWeek.toFixed(0)}%). The student may be struggling with new concepts.`,
        metric: "scoreDrop",
        metricValue: drop.toFixed(1),
      });
    }
  }

  // === MENTORSHIP ALERTS ===
  if (summary.engagementStreak === 0) {
    alerts.push({
      type: "mentorship",
      severity: "warning",
      reason: `Student's engagement streak is broken — they haven't been active recently. A mentorship check-in could re-engage them.`,
      metric: "engagementStreak",
      metricValue: "0",
    });
  }

  if (summary.tutorMessagesThisWeek === 0 && summary.lastActiveDate) {
    const daysSinceActive = Math.floor((Date.now() - new Date(summary.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceActive >= 3) {
      alerts.push({
        type: "mentorship",
        severity: daysSinceActive >= 7 ? "red" : "warning",
        reason: `Student hasn't been active for ${daysSinceActive} days. Consider reaching out with a personalized message.`,
        metric: "daysInactive",
        metricValue: String(daysSinceActive),
      });
    }
  }

  if (summary.engagementScore < 30) {
    alerts.push({
      type: "mentorship",
      severity: "warning",
      reason: `Engagement score is very low (${summary.engagementScore}/100). The student may be losing interest. A mentorship conversation about goals could help.`,
      metric: "engagementScore",
      metricValue: String(summary.engagementScore),
    });
  }

  return alerts;
}
