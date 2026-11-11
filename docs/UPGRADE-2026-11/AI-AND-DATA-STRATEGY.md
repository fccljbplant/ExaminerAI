# TraineesAI — AI, Learning Data and Cost Strategy

**Date:** 11 November 2026  
**Purpose:** Maximise teaching value and reliability while minimising unnecessary model calls, data exposure, latency and operating cost.

## 1. Architecture principle

Use software for deterministic decisions and AI for language, explanation and constrained synthesis.

The model must not decide:
- Authentication, RBAC, tenant or course access.
- Enrollment entitlement, expiry or payment.
- Numeric score calculations, KPI totals or certificate eligibility.
- Which evidence is authoritative.
- Crisis confirmation, clinical diagnosis, discipline, hiring or employment decisions.
- Whether a missing record should be treated as zero.

The model can:
- Explain a concept.
- Ask Socratic questions.
- Give rubric-grounded feedback.
- Summarize authorized evidence.
- Draft a lesson, deck, intervention or message for human review.
- Classify text only where data processing, consent, evaluation and human oversight have been approved.

## 2. Provider and model configuration

The uploaded owner specification selects DeepSeek as primary and Z.ai as a fallback, but the live main provider file contains contradictory/stale comments and a legacy DeepSeek model string. Audit the actual request order, SDK payload, fallback behavior and every direct provider call before changing configuration.

Do not assume a model identifier or price remains current.

At the time this document was researched, DeepSeek's official model-discovery endpoint documented GET /models and listed:
- Model ID: deepseek-flash.
- Display name: DeepSeek-V4.1-Flash.
- Context window: 1,048,576 tokens.
- Maximum output: 393,216 tokens.
- Text and image input; text output.
- Thinking effort levels low, high and max.

The official API says to inspect live model capabilities and pricing. Re-query the endpoint and pricing page at implementation time; do not hard-code the above as permanent facts.

References:
- [DeepSeek model discovery](https://api-docs.deepseek.com/api/list-models/)
- [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/)

Required architecture:
- One server-only provider configuration module.
- A capability registry discovered/validated against current provider metadata.
- Per-feature profiles: provider, model, thinking policy, max input/output, temperature, timeout, cache policy, privacy class and fallback.
- Typed provider adapters and normalized error handling.
- No credentials in client bundles, logs or documentation.
- A single observable request path wherever practical; enumerate and remove duplicate direct-call paths only after verifying their behavior.

Do not introduce a new provider, paid plan, external data processor or billing change without owner approval.

## 3. Thinking and cost policy

DeepSeek documents thinking mode as enabled by default (high effort) when not overridden. Therefore every request must set the intended mode explicitly.

Default:
- Thinking disabled for tutoring, grading, test generation, feedback, voice preparation, Copilot lookups, summarization and routine content generation.
- A higher-effort exception is permitted only after a golden evaluation proves material improvement that cannot be obtained with rules, retrieval, a tighter rubric, structured output or examples.
- The owner must approve each exception; use the lowest effort that passes quality evaluation.
- Never store, expose or send model reasoning traces as learner-facing evidence.

Cost controls:
- Set a per-feature input/output token budget.
- Set timeouts, retries and maximum repair attempts.
- Apply per-user, per-organisation and per-feature rate limits.
- Detect runaway tool loops and repeated requests.
- Use a cheaper qualified model for simple tasks only after measured quality tests.
- Compare quality, latency and price together; cheapest output is not best value if it causes retries, corrections or learner harm.
- Record actual provider/model returned, token usage, cache usage where available, latency, error, feature, tenant and cost estimate.
- Report cost per completed learning session, assessment, course and organisation.
- Recalculate cost from current official rate cards; do not copy 2026 pricing figures into code as constants without a versioned pricing source.

## 4. Prompt caching and application caching

DeepSeek's official documentation states that disk-based context caching is enabled by default and depends on reusable matching prefixes.

Make prompts cache-friendly:
1. Stable system policy and task rubric first.
2. Stable course outline and reference material next.
3. Current learner evidence and request-specific content last.

Keep the prefix byte-for-byte stable where possible. Avoid inserting timestamps, user IDs, random IDs or personalized details into the static prefix.

Use application caching carefully:
- Cache reusable, course-level question/deck drafts only when the generation contract permits sharing.
- Key by course, content version, language, difficulty, prompt version and relevant policy.
- Never reuse one learner's personalized result as another learner's answer.
- Do not cache grading outcomes or private learner context across users.
- Apply TTL, invalidation and deletion rules.
- Measure cache-hit rate, staleness and quality impact.

Reference: [DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache/).

## 5. Minimal, scoped learner and instructor context

Never send an entire learner profile, whole database row, unrestricted transcript or cross-course history to a model.

Construct a typed context pack per request:
- Purpose and allowed output.
- Pseudonymous learner identifier where identity is not required.
- Explicit organisation, course and permission scope enforced before context construction.
- Relevant topic, learning objective and current lesson version.
- Small set of recent relevant assessment evidence.
- Topic mastery estimate plus evidence count and confidence.
- Relevant prerequisite gaps.
- Only the top few authorized course-material chunks, with stable source IDs.
- Language/register preference and accessibility requirements when needed.
- Data freshness and missing evidence indicators.

Exclude by default:
- Names, emails, phone numbers, exact addresses and unrelated identifiers.
- Other learners' records.
- Other courses' data.
- Raw chat history and sensitive support notes.
- Crisis-case content.
- Instructor private notes.
- Unnecessary demographic or protected-attribute data.

Instructor Copilot must receive pseudonyms only. An authorized server-side mapping can restore identities after model output and must validate that each returned pseudonym belongs to the instructor's current scope.

## 6. Retrieval-augmented generation

- Enforce organisation and course filters before retrieval, not only in the final prompt.
- Treat retrieved documents and student-authored text as untrusted data; delimit them and defend against direct and indirect prompt injection.
- Retrieve only the few chunks needed for the current learning objective.
- Return source metadata and citations for factual course content.
- Never allow a model to invent URLs, library APIs, dates, totals, grades or assessment evidence.
- If the supplied material does not contain an answer, abstain and direct the learner to an instructor.
- Separate content ingestion, embeddings, vector search and prompt composition.
- Use a dedicated embedding credential/configuration; never pass one provider's API key to another provider.
- Surface embedding failures; do not silently pretend RAG worked.
- Test retrieval against cross-tenant and cross-course poisoning/leakage fixtures.
- Consider vector database changes only after measuring current retrieval latency, accuracy, recall and operating cost.

## 7. Data science and learning analytics

### Canonical evidence model

Audit and define the source of truth for:
- Course enrollment and entitlement.
- Topic and curriculum version.
- Learning events and timestamps.
- Assessment attempts, answers and scores.
- Topic mastery and its history.
- Project/submission/rubric evidence.
- Instructor feedback and human corrections.
- Learner support consent and access audit.
- Course/cohort snapshots and data freshness.

Every derived metric should carry:
- Scope: learner, course, cohort or organisation.
- Source tables/events.
- Formula and version.
- Numerator/denominator.
- Window and timezone.
- Computed-at time and source freshness.
- Evidence count and uncertainty where relevant.

Keep missing data distinct from a genuine zero. A zero can be a real result; an absent or failed query is unavailable.

### Learner model

Estimate mastery at learner × course × topic granularity using observed evidence. Begin with transparent, testable deterministic/statistical methods (for example, recency-weighted evidence or a simple Bayesian/BKT-lite approach) rather than an LLM-generated learner score.

Represent:
- Estimated mastery.
- Evidence count.
- Confidence/uncertainty.
- Recent trend.
- Prerequisite gaps.
- Recommended difficulty.
- Recommended scaffolding/register.
- Model/rule version.

Do not use this as a fixed label or permanent psychological profile. Allow new evidence to update the estimate and show learners/instructors why a teaching choice was made.

### Evaluation

Measure whether the product teaches better:
- Pre/post competency on the same learning objective.
- Delayed retention, not only immediate quiz performance.
- Transfer to workplace-style tasks.
- Error correction and retry behavior.
- Quality of feedback and rubric alignment.
- Differences by course, language, device and learner segment.
- Human mentor workload and time saved.

Use appropriate comparison groups or careful before/after designs. Report sample size, confidence intervals and limitations. Do not equate activity, minutes online, message count or streaks with mastery.

### Business analytics

Use real, auditable events for:
- Activation and time to first learning value.
- Learner and organisation retention.
- Course completion and competency evidence.
- Instructor course load and workflow efficiency (operational only).
- Support SLA process outcomes under the crisis-case policy.
- AI unit cost, infrastructure cost and gross margin.

Do not create instructor behavioral scores or learner psychological rankings.

## 8. Adaptive teaching policy

The system should decide the learning action in code and ask AI to express it well.

Inputs:
- Current topic and objective.
- Evidence-backed mastery estimate and confidence.
- Intent: explain, hint, check, review or project help.
- Prior relevant performance.
- Learner-selected language/register.
- Current assessment state.

Outputs:
- Explanation depth.
- Adult-appropriate register (Foundations, Core, Applied, Expert).
- Scaffolding level.
- Hint step.
- Example type (workplace scenario, analogy, code example).
- Prerequisite recap.
- Check-for-understanding.
- Length and token cap.

Keep question difficulty at five levels. Use a hint ladder (nudge → targeted hint → worked step → full explanation) and fade support as competence grows. Never reveal answers during active tests.

## 9. AI security and governance

Use the current [OWASP GenAI LLM Top 10 (2026)](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/) and [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) as threat and governance references.

Explicitly test:
- Direct and indirect prompt injection.
- Sensitive information disclosure.
- Excessive tool agency.
- Supply-chain and model/provider changes.
- Data and model poisoning.
- Unbounded consumption and cost abuse.
- Misinformation and unsupported claims.
- Hidden context leakage.
- Vector/embedding weaknesses.
- Improper output handling.

Tools must be typed, scoped, read-only by default and limited in steps. Model text must never directly trigger privileged actions. Drafts require a human click before sending; grades, enrollment and support cases stay under authorized application workflows.

## 10. Learner-support and crisis data

This is a separate sensitive-data domain, not ordinary analytics.

- Default off per organisation.
- No new model processing until consent text, jurisdictional review, provider data terms, minimization and retention have been approved.
- Use only necessary derived signals and short, redacted evidence.
- The learner's in-scope instructor sees permitted indicators.
- Designated organisation Learner Support Leads see crisis cases and the case-handling process record only.
- Other org admins and Platform Admins do not see individual psychology/support indicators.
- No instructor psychological/behavioral monitoring.
- AI never diagnoses or confirms a crisis.
- Learner-facing safety text and resource lists require qualified professional review.
- Every sensitive-data read is access-controlled and audited.
- Retention and deletion are explicit and tested.

## 11. AI evaluation and release gates

Golden sets must include:
- English, Roman Urdu, Roman Hindi and mixed technical language.
- Beginner through advanced engineering tasks.
- Correct, partial, ambiguous, adversarial and out-of-scope answers.
- Missing course evidence and conflicting source versions.
- Prompt injection in student text and retrieved documents.
- Cross-course and cross-tenant data fixtures.
- Low bandwidth, retry and provider outage conditions.

Track:
- Factual support/unsupported-claim rate.
- Assessment/rubric agreement.
- Structured-output validity and repair rate.
- Answer leakage during active assessments.
- Wrong-language rate.
- Latency and timeout rate.
- Cost per successful task.
- Privacy/scope violations (release blocker: must be zero in tests).

Do not roll out a new model or prompt globally until it meets or beats the agreed baseline for safety and task quality.


## 12. Human-centred education and responsible AI references

- UNESCO, *Guidance for generative AI in education and research* (2023; updated 16 January 2026): human-centred use, privacy protection, institutional readiness and pedagogical validation. https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research
- NIST AI 600-1, *Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile* (26 July 2024; current NIST listing updated 8 April 2026): lifecycle risk identification and trustworthiness practices. https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- OWASP GenAI LLM Top 10 2026 (3 August 2026): current application threat taxonomy for prompt injection, sensitive information disclosure, excessive agency and other LLM risks. https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/
- DeepSeek model discovery API: use the live metadata rather than assuming a model name, context size or capability remains fixed. https://api-docs.deepseek.com/api/list-models/
- DeepSeek thinking mode: thinking is enabled by default unless explicitly disabled; explicitly set the chosen request mode. https://api-docs.deepseek.com/guides/thinking_mode/
- DeepSeek context caching: cache hits depend on exact reusable prefixes; keep stable instructions/material before dynamic learner data and measure actual hit tokens. https://api-docs.deepseek.com/guides/kv_cache/
