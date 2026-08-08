/**
 * Shared examiner-text sanitizer — used by daily-test, weekly-test, and practice
 * routes to clean AI responses before showing them to students.
 *
 * The AI sometimes returns:
 * - Markdown formatting (bold, headers, code blocks, lists)
 * - Meta-commentary ("Here's a question about...", "Let me ask you...")
 * - Internal instruction echoes ("Question 1:", "Observation:", "Behavior:")
 * - Excessive verbosity (multi-paragraph responses when a single question suffices)
 * - Emojis and decorative symbols
 *
 * This module strips ALL of that, returning clean plain text suitable for
 * display in a chat interface.
 */

/** Strip markdown + meta-commentary from examiner responses — plain text only. */
export function sanitizeExaminerText(text: string): string {
  let cleaned = text;

  // 1. Strip AI meta-commentary prefixes
  // The AI sometimes starts with "Here's...", "Let me...", "I'll ask...",
  // "Sure,", "Okay,", "Great question!" before the actual content.
  // Remove these prefixes if the actual content follows.
  cleaned = cleaned.replace(
    /^(?:Here(?:'s| is)|Let me|I'll|I will|Sure[,!]?\s*|Okay[,!]?\s*|Great question!?\s*|Alright[,!]?\s*)[\s\S]*?(?=\n|[A-Z])/i,
    ""
  );

  // 2. Strip "Question N:" prefixes (already done in some routes, but do it here too)
  cleaned = cleaned.replace(/^Question\s*\d+\s*:\s*/i, "");

  // 3. Strip internal metadata tags that should never reach the student
  // These are used in grading but shouldn't appear in the chat
  cleaned = cleaned.replace(/^(Observation|Behavior|Note|Assessment|Analysis|Score|Grade|Feedback):\s.*$/gim, "");

  // 4. Strip JSON blocks (AI sometimes returns JSON when it shouldn't)
  cleaned = cleaned.replace(/\{[^}]*"score"[^}]*\}/g, "");
  cleaned = cleaned.replace(/\{[\s\S]*?\}/g, (match) => {
    // Only strip if it looks like JSON (has quotes and colons)
    if (/["']\w+["']\s*:/.test(match)) return "";
    return match;
  });

  // 5. Strip markdown formatting
  // Bold: **text** or __text__
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
  // Italic: *text* or _text_
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/_([^_]+)_/g, "$1");
  // Headers: ### text, ## text, # text
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");
  // Horizontal rules: ---, ***, ___
  cleaned = cleaned.replace(/^[\-\*_]{3,}\s*$/gm, "");
  // Numbered lists: "1. " "2. " etc → just the text
  cleaned = cleaned.replace(/^\d+\.\s+/gm, "");
  // Bullet points: "- " or "* " at start of line
  cleaned = cleaned.replace(/^[\-\*]\s+/gm, "");
  // Code blocks: ```...``` → just the content
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (m) =>
    m.replace(/```\w*\n?/g, "").replace(/```$/g, "")
  );
  // Inline code: `text` → text
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
  // Links: [text](url) → text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Blockquotes: > text → text
  cleaned = cleaned.replace(/^>\s+/gm, "");

  // 6. Strip emojis
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");
  cleaned = cleaned.replace(/[\u{2600}-\u{27BF}]/gu, "");

  // 7. Strip instruction echoes — sometimes the AI repeats back instructions
  // like "Do NOT prefix with..." or "Ask ONE question about..."
  cleaned = cleaned.replace(/^Do NOT.*$/gim, "");
  cleaned = cleaned.replace(/^Ask (ONE|a|one).*$/gim, "");
  cleaned = cleaned.replace(/^Make it.*$/gim, "");

  // 8. Remove empty lines left by all the stripping
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // 9. Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  // 10. If the result is empty after all stripping, return a fallback
  if (!cleaned || cleaned.length < 5) {
    return "Can you elaborate on that? Walk me through your reasoning.";
  }

  // 11. Cap at reasonable length — if the AI generated a wall of text,
  // truncate to the first 500 characters (enough for a question + brief feedback)
  if (cleaned.length > 500) {
    // Try to cut at a sentence boundary
    const truncated = cleaned.slice(0, 500);
    const lastSentence = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf("? "),
      truncated.lastIndexOf("! ")
    );
    cleaned = lastSentence > 100 ? truncated.slice(0, lastSentence + 1) : truncated + "...";
  }

  return cleaned;
}
