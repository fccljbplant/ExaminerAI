/**
 * modules/submission/lib/registries.ts — W4 registry defaults (REDESIGN-P4 §5)
 *
 * Registries make domains zero-code: adding a submission type or a whole
 * domain (HSE evidence, eBay listing, device repair) is a RegistryRow
 * insert, never a code change. This file defines the platform defaults
 * that submission-db seeds idempotently (orgId = null).
 *
 * Pure — no db, no React.
 */

import type { ResubmissionPolicy } from "../contracts";
import type { RubricCriterionDef } from "./rubric-engine";

// ── Submission types ─────────────────────────────────────────────────────

export interface SubmissionTypeDef {
  key: string;
  label: string;
  /** Hint shown in the L6 MediaCapture / drop UI. */
  captureHint: string;
  maxBytes: number;
  acceptMime: string[];
  /** Whether this part feeds the text-only AI packet (P2 §3.4). */
  aiVisible: boolean;
}

export const DEFAULT_SUBMISSION_TYPES: SubmissionTypeDef[] = [
  {
    key: "text",
    label: "Written answer",
    captureHint: "Type your answer — markdown supported.",
    maxBytes: 0,
    acceptMime: [],
    aiVisible: true,
  },
  {
    key: "photo",
    label: "Photo evidence",
    captureHint: "Take or upload a clear photo of your work.",
    maxBytes: 5_000_000,
    acceptMime: ["image/jpeg", "image/png", "image/webp"],
    aiVisible: false,
  },
  {
    key: "video",
    label: "Video evidence",
    captureHint: "Record a short clip demonstrating the task.",
    maxBytes: 0, // videos are linked, not uploaded, in the W4 slice
    acceptMime: [],
    aiVisible: false,
  },
  {
    key: "link",
    label: "Live artifact link",
    captureHint: "Paste a URL reviewers can open (repo, listing, deploy).",
    maxBytes: 0,
    acceptMime: [],
    aiVisible: true,
  },
  {
    key: "checklist",
    label: "Checklist",
    captureHint: "Tick each step you completed.",
    maxBytes: 0,
    acceptMime: [],
    aiVisible: true,
  },
  {
    key: "file",
    label: "Document (docx/pdf)",
    captureHint: "Word or PDF — converted to text for AI assistance.",
    maxBytes: 10_000_000,
    acceptMime: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/pdf",
    ],
    aiVisible: true,
  },
];

// ── Domain templates (kind = assignment_template) ────────────────────────

export interface DomainTemplateDef {
  key: string;
  label: string;
  description: string;
  partTypes: string[];
  policy: ResubmissionPolicy;
  rubricTitle: string;
  criteria: RubricCriterionDef[];
  instructions: string;
}

/** Four-level descriptive scale shared by the sample criteria. */
function levels(max: number, labels: [string, string, string, string]) {
  return [
    { level: 0, label: labels[0], score: 0 },
    { level: 1, label: labels[1], score: Math.round(max * 0.4) },
    { level: 2, label: labels[2], score: Math.round(max * 0.7) },
    { level: 3, label: labels[3], score: max },
  ];
}

/**
 * W4 exit criteria samples (P5 §2): HSE / eBay / repair must pass
 * submission → review → resubmit → sign-off e2e with ZERO code changes —
 * each is pure configuration below.
 */
export const SAMPLE_DOMAIN_TEMPLATES: DomainTemplateDef[] = [
  {
    key: "hse_safety_evidence",
    label: "HSE — Safety evidence",
    description:
      "Workplace safety compliance evidence with photo + checklist; supports an ordered multi-signer chain (signer IDs are set per assignment).",
    partTypes: ["photo", "checklist", "text"],
    policy: { maxCycles: 2, cooldownHours: 24, signOffChain: [] },
    rubricTitle: "HSE safety evidence rubric",
    instructions:
      "Photograph the completed safety procedure, tick every checklist step, and describe what you did in your own words.",
    criteria: [
      {
        key: "compliance",
        label: "Procedure compliance",
        weight: 2,
        aiAssist: false,
        levels: levels(20, [
          "Not followed",
          "Partially followed",
          "Followed with minor gaps",
          "Fully followed",
        ]),
      },
      {
        key: "evidence_quality",
        label: "Evidence quality",
        weight: 1,
        aiAssist: false,
        levels: levels(10, [
          "Unclear",
          "Blurry/incomplete",
          "Clear enough",
          "Clear and complete",
        ]),
      },
      {
        key: "reflection",
        label: "Safety reflection",
        weight: 1,
        aiAssist: true,
        levels: levels(10, [
          "Missing",
          "Surface-level",
          "Thoughtful",
          "Insightful with risks named",
        ]),
      },
    ],
  },
  {
    key: "ebay_listing",
    label: "eBay — Live listing",
    description:
      "Marketplace listing assignment: publish a real listing and justify pricing + keywords.",
    partTypes: ["link", "text"],
    policy: { maxCycles: 3, cooldownHours: 0 },
    rubricTitle: "eBay listing rubric",
    instructions:
      "Publish your listing, paste the live URL, and summarize your pricing and keyword strategy.",
    criteria: [
      {
        key: "listing_live",
        label: "Listing is live and reachable",
        weight: 2,
        aiAssist: false,
        levels: levels(20, [
          "No link",
          "Dead link",
          "Live with issues",
          "Live and complete",
        ]),
      },
      {
        key: "pricing",
        label: "Pricing rationale",
        weight: 1,
        aiAssist: true,
        levels: levels(10, [
          "None",
          "Guessed",
          "Comparable-based",
          "Researched + justified",
        ]),
      },
      {
        key: "keywords",
        label: "Title & keywords",
        weight: 1,
        aiAssist: true,
        levels: levels(10, [
          "Generic",
          "Basic",
          "Targeted",
          "Optimized with search terms",
        ]),
      },
    ],
  },
  {
    key: "repair_job",
    label: "Repair — Device repair job",
    description:
      "Hands-on repair evidence: video of the fix, photo of the result, completed safety checklist.",
    partTypes: ["video", "photo", "checklist"],
    policy: { maxCycles: 2, cooldownHours: 12 },
    rubricTitle: "Repair job rubric",
    instructions:
      "Record the repair, photograph the finished device, and complete the diagnostic checklist.",
    criteria: [
      {
        key: "diagnosis",
        label: "Diagnosis process",
        weight: 1,
        aiAssist: false,
        levels: levels(15, [
          "Skipped",
          "Trial-and-error",
          "Systematic",
          "Systematic + verified",
        ]),
      },
      {
        key: "workmanship",
        label: "Workmanship",
        weight: 2,
        aiAssist: false,
        levels: levels(20, [
          "Damaged",
          "Rough",
          "Acceptable",
          "Clean and professional",
        ]),
      },
      {
        key: "verification",
        label: "Post-repair verification",
        weight: 1,
        aiAssist: false,
        levels: levels(15, [
          "None",
          "Powers on",
          "Function-tested",
          "Fully validated + explained",
        ]),
      },
    ],
  },
];
