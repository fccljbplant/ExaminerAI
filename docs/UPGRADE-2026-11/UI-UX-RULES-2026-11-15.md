# UI/UX deep research — 15 November 2026 (session 2)

**Scope of this research pass.** UXPeak's public footprint was mined end-to-end: the Scribd preview of *The UI/UX Playbook* (public table of contents and marketing copy only — the document itself is bot-gated and its paid pages were **not** copied, consistent with DECISIONS-REGISTER §1), five of UXPeak's own public Medium articles, their YouTube channel topic map, the published Playbook/product descriptions on uxpeak.com, and the established UX laws (lawsofux.com) that UXPeak's teaching rests on. Everything below cites what was actually opened.

---

## 1. Research corpus

### 1.1 The UI/UX Playbook (Scribd preview + product pages)

- The Scribd document (`scribd.com/document/805328183`) returns HTTP 403 to both fetch methods; no bypass was attempted. The **public table of contents**, visible in search-engine snippets of the preview: *Intro · Visual hierarchy · Proximity · Clarity · Alignment · Contrast · Simplicity · Whitespace · Layout · Balance and harmony …*
- The public playbook landing (uxpeak.com/pages/playbook, retrieved 2026-11-15): "140+ pages… 100+ practical UI tips, each with do/don't visuals"; the product FAQ states it "covers layout, hierarchy, spacing, typography, color, interaction, and more."
- A public search snippet of preview text shows the book is organized around **"Problem to solve:"** framings — e.g. "How do I guide users through conversion flow and make forms as easy as possible."
- Landing-page before/after demos (retrieved 2026-11-15) already distilled in UXPEAK-RESEARCH-2026-11-15.md: value-first listing card; hero score + qualitative word + percentage composition.

### 1.2 UXPeak Medium articles (their own public teaching)

**Part 3 — Top UI/UX design tips (medium.com/@uxpeak.com/…part-3-51b839458029)**
1. *Prioritize important information* — before designing, list and rank every element; spotlight importance with "color, size, position, and contrast." Named mistake: emphasizing the metric **label** ("Sales") over the **value** ("591").
2. *Reduce user barriers by exposing content* — interaction cost is "the cognitive, physical, and time effort a user has to exert to reach their goal." Show real content immediately (curated "Top 10") instead of a banner that forces a tap: quick value, reduced friction, relevancy.
3. *Design fields for the type of input* — OTP gets four large boxes; CVC gets a short field; a form "doesn't just capture information; it aids in the accurate and efficient entry of that information."

**Part 4 — (…part-4-f002a1f954b1)**
1. *Don't overdo it with borders* — "overuse of borders can clutter your interface and make it look busy, confusing, or outdated"; prefer background colors + whitespace for separation; borders sparingly.
2. *If we use borders, they should be thin and light* — "Subtlety is key… less is often more."
3. *Avoid too light colours for your text* — light-gray text trades readability for a minimal aesthetic; not worth it, "especially for users with poorer vision."

**Part 5 — (…part-5-0856f07e09a6)**
1. *Add visual cues* — they "help users understand your message faster"; engagement + memorability.
2. *Sender identification in inboxes* — colored initial-letter icons are good; real photos and logos are better ("users can easily identify the sender and quickly understand the context").
3. *Match your shadow color to the background* — tint shadows to the surface, never pure grey on colored backgrounds.

**"Don't tell users the status. Show it." (…95116b2ac24c)**
- Delivery-app example: a text timeline *tells*; a live map with courier pin, one ETA banner, and Call/Message actions *shows*.
- Why telling fails: it gives **a range, not a moment**; **stale labels** (static text looks identical minutes later); **no answer to the spatial question**.
- Why showing works: **one committed number** ("12 min away"), **visible change over time** (a pulsing pin proves the system is alive), **a face and a way out** (recovery actions in hand before they're needed).
- Definition of calm: "The user has fewer questions after looking at the screen than they had before."
- **Four-question audit for every waiting screen**: (1) One definite answer? (2) Visible change? (3) A countable unit? (4) A way out if it stalls? — "Four yeses means you're showing; anything less asks users for blind trust."
- Closing lines: "Most interfaces that frustrate users aren't slow. They're silent." / "Text describes. Visuals answer."

**"Make Your UI Designs 2X Better by Minimizing Interaction Cost" (…b5f20de4322a)**
- Interaction cost = mental + physical + time effort to reach a goal; the aim is to minimize reading, scrolling, searching, clicking, typing, waiting, task-switching, memorizing.
- **Seven strategies**: (1) *Keep related actions close* (Fitts's Law — "targets that are closer and larger are faster to click"; Spotify's pinned playback bar). (2) *Minimize choice* (Hick's Law — fewer options plus a highlighted recommended set speeds decisions; delivery apps show a curated "popular" section). (3) *Respect working memory* (Miller — ~seven items, chunk into meaningful groups; Airbnb's "Amenities" sections). (4) *Reduce distractions* (Medium's clean reading view). (5) *Promote recognition* — labels and menu items stay visible; in-context step-by-step help over long docs; forms fit one display. (6) *Streamline tasks* — map the steps, "remove or combine any that don't affect the outcome"; auto-fill previously entered data. (7) *Reduce repetition* — automate recurring work.
- Worked example (buying two chairs): 5 clicks → 3. Color **swatches visible upfront** instead of a dropdown — "When choices are hidden in dropdowns or nested menus, users might not know they exist"; a **stepper** (+/−) for quantity; **Add-to-cart moved next to the selector**; one-click ordering with stored data.
- Text blocks: split into segments, **a subheading per paragraph**, line height **120% → 160%**.
- Benefits: satisfaction, retention, efficiency, accessibility, conversion, reputation.

**Bottom navigation series, part 6 (…bottom-mobile-navigation-bar-part-6-97acd8b28453)** — 11 rules: sizes (~24px icons, 10–12px labels); **max 5 tabs**; **44px targets**; active state changes icon style *and* color (outline → filled) plus bolder label; **simple, familiar icons** (magnifier, not binoculars); short one-line labels; no boxes around tabs; **one icon style** everywhere (the selected tab may switch to filled); **no per-tab rainbow** (stick to brand palette); notification badges top-right, outlined, reserved for essentials; visually separate the bar from content.

*(Parts 1–2 of the tips series are not on the visible Medium profile; part 6 of the main series returned 403. Recorded honestly as gaps.)*

### 1.3 UXPeak YouTube channel (@uxpeak, ~130K subscribers)

Topic map from public titles (video pages are JS-rendered; titles via search):
- **"This UI/UX Redesign Will Teach You More Than 100 Tutorials Combined"** (~603K views) — full before/after redesign teardowns.
- **"The UX Psychology Behind Apps People Can't Stop Using"** (~668K views) — six principles, each with a before/after. Third-party transcript notes (sciencebasedsoftware.com/resources/creators, retrieved 2026-11-15) identify the effects: **choice overload** (the jam study — 24 flavors, 3% buy; 6 flavors, 30%), **loss aversion**, **reciprocity**, the **IKEA effect**, **endowed progress** (the car-wash loyalty card, Nunes & Drèze 2006), and **defaults** (most users never change them — the notes flag the specific 70–90% figure as uncited, so we treat "most users keep defaults" as qualitative).
  - The micro-fixes that carry the video: **button copy that states the payoff** ("Search" → "12 results waiting"); **honest refusal copy** ("Maybe later" → "I'll risk it"); **fields arrive pre-filled**; **progress bars that start at 20%** (endowed progress).
  - Teaching structure: bad screen → name the pain → cite the effect → fixed screen → one-line rule → famous-app proof (LinkedIn's profile meter, Duolingo's pre-signup lesson). "Abstract psychology becomes a diff you can see."
- **"The INSANE Gap Between Average and World-Class UI/UX Design"**, **"This Video Will Take You From Junior to Senior UX/UI Designer"** — the junior-vs-senior decision framing behind their course of the same name.
- **"The Shortest UX/UI Design Course"**, **"Ecommerce Page Redesign: UX/UI Tips to 3.5x Conversion"**, **"Live UI/UX Review"** (public critique format).
- Channel themes overall: teardowns, psychology, junior→senior decisions, conversion, live critique.

### 1.4 Established laws (lawsofux.com, definitions verified 2026-11-15)

- **Jakob's Law** — "Users spend most of their time on other sites. This means that users prefer your site to work the same way as all the other sites they already know."
- **Hick's Law** — "The time it takes to make a decision increases with the number and complexity of choices."
- **Fitts's Law** — closer, larger targets are faster to hit (UXPeak cites it for action proximity and 44px targets).
- **Miller's Law** — working memory holds ~7±2 items; chunk.
- **Recognition over recall** — see options, don't reconstruct them from memory.
- Related effects used above: endowed progress (Nunes & Drèze 2006), goal-gradient, loss aversion (Kahneman–Tversky).

---

## 2. The owner's bar, translated

The owner's brief — *"extremely decent, modern, professional app; easy to use; self-explanatory; with flows; something the user already knows; don't ask the user — give the user options; grab the user by its power, not force anything upon them"* — decomposes into six testable properties:

| Owner's phrase | Testable property | Anchored in |
|---|---|---|
| "something user already knows" | The screen matches a pattern from mainstream apps; no invented interactions | Jakob's Law; bottom-nav tips 5–8 |
| "don't ask user, give user options" | Options visible at the point of choice; fields pre-filled; defaults chosen; nothing interrogated that can be inferred | Interaction-cost strategies 2/5/6; psychology video (pre-fill, defaults); chair example (swatches vs dropdown) |
| "grab by power, not force" | No forced flows: every wait has an exit, every destructive step confirmable, no dark patterns; users act from surfaced information | Show-don't-tell (way out); SDT autonomy; loss-aversion used for the user's benefit, never against |
| "self-explanatory" | The calm test: fewer questions after looking than before | "Don't tell users the status" definition of calm |
| "with flows" | Next step always visible; steps streamlined; related actions adjacent | Interaction-cost strategies 1/6; empty-state CTAs |
| "decent, modern, professional" | The craft levers: hierarchy, spacing, contrast, restrained lines, readable text, consistent icons | Playbook TOC; Part 4 tips; Part 5 tip 3 |

---

## 3. The TraineesAI UI/UX ruleset (v2, supersedes the 6-principle checklist)

These twelve rules govern every surface, bottom-up. Each is checkable against real markup.

**Familiarity — "something the user already knows"**

1. **Standard pattern first.** If a mainstream pattern exists (top bar + tabs for learners, sidebar for staff, list rows, status chips, breadcrumbs), use it. Never invent an interaction where a familiar one exists. Active nav state changes icon style *and* color *and* label weight — at least two visual changes.
2. **Recognition over recall.** Small choice sets (≤7) render inline — chips, toggles, swatches, steppers — never in dropdowns or nested menus ("users might not know they exist"). Labels are visible at the point of choice; users never retype what they just saw.
3. **One icon family.** Lucide outline everywhere; the selected state may switch to filled. Simple familiar glyphs only (magnifier = search). No per-item rainbow — brand palette plus the fixed status tones.

**Options, not interrogation — "don't ask the user"**

4. **Infer, don't ask.** Pre-fill from known context (course in scope, today's date, last used value); pick the sensible default. A form field exists only for information the system genuinely cannot know. "A form doesn't just capture information; it aids in the accurate and efficient entry of that information."
5. **Curate, don't shrink.** When a list is long, surface a recommended/popular subset first and keep the full set one visible tap away (Hick's Law mitigated by curation, not by hiding).
6. **Never force.** No blocking modal outside red-tier alerts. Every flow shows its exit; every wait shows a way out (retry/cancel); destructive actions get one plain-language confirm — never typed incantations or forced re-login.

**Show, don't tell — status and feedback**

7. **Status is visual.** Toned chip + icon (+ count) — never a prose sentence. Status colors come only from the fixed status tokens (success/warning/danger/info), never from the brand.
8. **The four-question audit.** Every waiting screen answers: one definite answer? visible change? a countable unit? a way out? Progress bars reflect real units (tasks done of total), and every number shown is computed from real data.
9. **The calm test.** A screen is done when the user has fewer questions after looking at it than before: where am I, what is this, what changed, what's next.

**Value-first hierarchy — "decent, modern, professional"**

10. **The decision value leads.** The number/name the user acts on is the title and the largest element; labels demote to meta ("For sale · £845,000", "591" not "Sales"). One hero number per card, with a plain-language reading beside it.
11. **One primary action per view.** Exactly one brand-filled button; the rest outline/ghost. The primary action sits adjacent to what it affects (Fitts). Button copy states the payoff ("Start 15-min session", "See 12 results"), and refusal copy is honest ("I'll risk it", not "Maybe later").
12. **Craft levers.** Hierarchy by size/contrast/spacing/placement; sections separated by whitespace and surface tones before borders; borders thin and light (`border-line`); secondary text never too light (≥4.5:1); paragraphs get leading and a subheading when long; 44px targets everywhere; shadows tinted to their surface; spacing on the 4px grid; 3–5 nav items, short labels.

**How these rules enter the bottom-up fixation.** Each component is audited against all twelve rules before touching code; violations are fixed with existing tokens only; every slice ships with tests asserting the rules that apply to it (focus rings, target sizes, chip tones, value-first ordering, empty-state CTAs, exit affordances).

---

## 4. Sources

- uxpeak.com home, /pages/playbook, /pages/about, /pages/resources (retrieved 2026-11-15).
- Scribd preview of The UI/UX Playbook — public table of contents and description via search snippets (document fetch blocked with HTTP 403; no bypass attempted).
- Medium @uxpeak.com: tips parts 3, 4, 5; "Don't tell users the status. Show it."; "Minimizing Interaction Cost"; bottom-navigation part 6 (retrieved 2026-11-15).
- YouTube @uxpeak — video titles and view counts via public search; psychology-video principles via third-party transcript notes at sciencebasedsoftware.com/resources/creators (retrieved 2026-11-15).
- lawsofux.com — Jakob's Law, Hick's Law definitions (retrieved 2026-11-15).
- Nunes & Drèze (2006), "The Endowed Progress Effect," Journal of Consumer Research — the car-wash loyalty-card study cited by the video notes.
