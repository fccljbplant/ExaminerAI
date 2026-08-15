// src/modules/learn/lib/tts-filter.ts — Browser-side TTS (text-to-speech) helpers.
/**
 * Browser-side TTS (text-to-speech) helpers.
 * The AI tutor narrates the lesson. We can't just feed the raw
 * markdown to speechSynthesis — it would read code blocks, URLs, and
 * table syntax aloud, which sounds terrible. prepareForTTS() strips
 * those and replaces them with short spoken placeholders so the user
 * knows the visual content exists without hearing it read aloud.
 *
 * This file is CLIENT-ONLY — it uses `window.speechSynthesis`.
 */

/** Strip markdown / code / URLs / tables from text for speech synthesis. */
export function prepareForTTS(text: string): string {
 if (!text) return "";
 let out = text;

 // 1. Fenced code blocks ```...``` → "I've included the code snippet in the chat window below."
 out = out.replace(/```[\s\S]*?```/g, ". I've included the code snippet in the chat window below. ");

 // 2. Inline code `foo` → "the foo" (just strip the backticks but keep the word)
 out = out.replace(/`([^`]+)`/g, "$1");

 // 3. Markdown tables (lines with | separators) → "I've prepared a table for you in the chat."
 // A table is 2+ consecutive lines that look like "| ... | ... |".
 const lines = out.split("\n");
 let inTable = false;
 let tableFound = false;
 const filtered: string[] = [];
 for (const line of lines) {
 const isTableRow = /^\s*\|.*\|\s*$/.test(line);
 const isTableSep = /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
 if (isTableRow || isTableSep) {
 inTable = true;
 tableFound = true;
 } else {
 if (inTable) {
 filtered.push(" I've prepared a table for you in the chat. ");
 inTable = false;
 }
 filtered.push(line);
 }
 }
 if (inTable) filtered.push(" I've prepared a table for you in the chat. ");
 out = filtered.join("\n");
 void tableFound;

 // 4. URLs (http/https/www) → "I've added a link in the chat."
 out = out.replace(/https?:\/\/\S+/g, " I've added a link in the chat. ");
 out = out.replace(/\bwww\.\S+/g, " I've added a link in the chat. ");

 // 5. Markdown headings (#, ##, ###) → drop the #s
 out = out.replace(/^#{1,6}\s+/gm, "");

 // 6. Bold/italic markers
 out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
 out = out.replace(/\*([^*]+)\*/g, "$1");
 out = out.replace(/__([^_]+)__/g, "$1");
 out = out.replace(/_([^_]+)_/g, "$1");

 // 7. Markdown list markers (-, *, 1.) → "Item."
 out = out.replace(/^\s*[-*+]\s+/gm, "");
 out = out.replace(/^\s*\d+\.\s+/gm, "");

 // 8. Block quotes
 out = out.replace(/^\s*>\s?/gm, "");

 // 9. Horizontal rules
 out = out.replace(/^[-*_]{3,}\s*$/gm, "");

 // 10. Image syntax ![alt](url) → "I've added an image in the chat."
 out = out.replace(/!\[[^\]]*\]\([^)]+\)/g, " I've added an image in the chat. ");

 // 11. Collapse multiple spaces/newlines
 out = out.replace(/[ \t]{2,}/g, " ");
 out = out.replace(/\n{3,}/g, "\n\n");

 return out.trim();
}

// The tutor voice is MALE (user requirement 2026-08-15). Voices are
// populated asynchronously, so we warm the list on first use and keep
// a best-effort heuristic: prefer clearly male / "UK English male"
// voices, never pick a known female one, fall back to any English
// voice, then the browser default.
const MALE_HINTS = /david|daniel|george|alex|ryan|oliver|arthur|guy|male|en[-_ ]?gb[-_ ]?male/i;
const FEMALE_HINTS = /female|zira|susan|karen|moira|tessa|serena|samantha|victoria|hazel|sonia|libby|kate|joanna|salli|kimberly|ivy|emma|amy/i;

function pickMaleVoice(): SpeechSynthesisVoice | null {
 if (typeof speechSynthesis === "undefined") return null;
 const voices = speechSynthesis.getVoices();
 if (voices.length === 0) return null;
 const male = voices.find((v) => MALE_HINTS.test(v.name) && !FEMALE_HINTS.test(v.name));
 const anyEnglish = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
 return male ?? anyEnglish ?? voices[0];
}

/** Warm the voice list (getVoices populates asynchronously). */
export function warmVoices(): void {
 if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
 try {
  // Reading the list once triggers async population; the browser fires
  // voiceschanged — after which pickMaleVoice sees the real voices.
  void speechSynthesis.getVoices();
 } catch {
  // best-effort
 }
}

/** Speak text via the Web Speech API in the male tutor voice. No-op if
 *  TTS unavailable. */
export function speakTTS(text: string): void {
 if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
 try {
 speechSynthesis.cancel();
 const u = new SpeechSynthesisUtterance(text);
 const voice = pickMaleVoice();
 if (voice) u.voice = voice;
 u.rate = 1;
 u.pitch = 0.9; // slightly lower pitch reads as a male voice on neutral defaults
 speechSynthesis.speak(u);
 } catch {
 // best-effort — TTS is non-critical
 }
}

/** Stop any in-progress speech. */
export function stopTTS(): void {
 if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
 try {
 speechSynthesis.cancel();
 } catch {
 // best-effort
 }
}

/** True if the browser supports speech synthesis. */
export function isTTSAvailable(): boolean {
 return typeof window !== "undefined" && "speechSynthesis" in window;
}
