/**
 * Tests for src/modules/submission/lib/lifecycle.ts (pure state machine).
 *
 * Covers the W4 submission lifecycle (REDESIGN-P4 §5): submit validation,
 * resubmission cycle/cooldown limits, mandatory feedback on request_changes,
 * and the ordered multi-signer chain used by HSE-style configs.
 */

import { describe, it, expect } from "vitest";
import type { PartInput, ResubmissionPolicy, SubmissionStatus } from "../contracts";
import {
  DEFAULT_POLICY,
} from "../contracts";
import {
  parsePolicy,
  partIsFilled,
  validateSubmit,
  canResubmit,
  validateDecision,
  canSign,
  chainComplete,
  resolveDecisionStatus,
  type SignOffDone,
  type SignerRef,
} from "../lib/lifecycle";

describe("parsePolicy", () => {
  it("returns a valid policy unchanged", () => {
    const policy = { maxCycles: 5, cooldownHours: 12 };
    expect(parsePolicy(policy)).toEqual({ maxCycles: 5, cooldownHours: 12 });
  });

  it("fills missing fields with defaults", () => {
    expect(parsePolicy({ maxCycles: 2 })).toMatchObject({
      maxCycles: 2,
      cooldownHours: 0,
    });
  });

  it("falls back to defaults on junk input", () => {
    expect(parsePolicy("not-an-object")).toEqual(DEFAULT_POLICY);
    expect(parsePolicy({ maxCycles: -1 })).toEqual(DEFAULT_POLICY);
    expect(parsePolicy(undefined)).toEqual(DEFAULT_POLICY);
  });
});

describe("partIsFilled", () => {
  it("text is filled when non-blank", () => {
    expect(partIsFilled({ type: "text", text: "hi" })).toBe(true);
    expect(partIsFilled({ type: "text", text: "   " })).toBe(false);
    expect(partIsFilled({ type: "text" })).toBe(false);
  });

  it("photo/video/link are filled by url or dataUrl", () => {
    expect(partIsFilled({ type: "photo", url: "https://x/y.png" })).toBe(true);
    expect(partIsFilled({ type: "video", dataUrl: "data:..." })).toBe(true);
    expect(partIsFilled({ type: "link", url: "https://x" })).toBe(true);
    expect(partIsFilled({ type: "link" })).toBe(false);
  });

  it("checklist is filled when it has any items", () => {
    expect(
      partIsFilled({ type: "checklist", checklist: [{ label: "a", checked: true }] }),
    ).toBe(true);
    expect(partIsFilled({ type: "checklist", checklist: [] })).toBe(false);
  });

  it("file is filled by fileName", () => {
    expect(partIsFilled({ type: "file", fileName: "report.docx" })).toBe(true);
    expect(partIsFilled({ type: "file" })).toBe(false);
  });
});

describe("validateSubmit", () => {
  const parts: PartInput[] = [
    { type: "text", text: "answer" },
    { type: "photo", url: "https://x/p.png" },
  ];

  it("passes when summary and all required parts are filled", () => {
    expect(validateSubmit(["text", "photo"], parts, "my summary")).toEqual({ ok: true });
  });

  it("rejects a blank learner summary (SUMMARY_REQUIRED)", () => {
    const res = validateSubmit(["text"], parts, "   ");
    expect(res).toMatchObject({ ok: false, code: "SUMMARY_REQUIRED" });
  });

  it("rejects a missing required part type (PART_REQUIRED)", () => {
    const res = validateSubmit(["checklist"], parts, "summary");
    expect(res).toMatchObject({ ok: false, code: "PART_REQUIRED" });
  });

  it("rejects an empty required part (PART_EMPTY)", () => {
    const res = validateSubmit(["photo"], [{ type: "photo" }], "summary");
    expect(res).toMatchObject({ ok: false, code: "PART_EMPTY" });
  });
});

describe("canResubmit", () => {
  const policy: ResubmissionPolicy = { maxCycles: 3, cooldownHours: 24 };

  it("allows resubmit from changes_requested within limits", () => {
    const decidedAt = new Date(Date.now() - 25 * 3_600_000); // 25h ago
    expect(canResubmit("changes_requested", 1, decidedAt, policy)).toEqual({ ok: true });
  });

  it("rejects a non-returned status (STATUS)", () => {
    expect(canResubmit("submitted", 0, null, policy)).toMatchObject({
      ok: false,
      code: "STATUS",
    });
  });

  it("rejects when the cycle limit is reached (CYCLE_LIMIT)", () => {
    expect(canResubmit("changes_requested", 3, null, policy)).toMatchObject({
      ok: false,
      code: "CYCLE_LIMIT",
    });
  });

  it("rejects within the cooldown window (COOLDOWN)", () => {
    const decidedAt = new Date(Date.now() - 5 * 3_600_000); // 5h ago
    expect(canResubmit("changes_requested", 0, decidedAt, policy)).toMatchObject({
      ok: false,
      code: "COOLDOWN",
    });
  });

  it("ignores cooldown when policy.cooldownHours is 0", () => {
    const noCooldown: ResubmissionPolicy = { maxCycles: 3, cooldownHours: 0 };
    const decidedAt = new Date(Date.now() - 1_000);
    expect(canResubmit("changes_requested", 0, decidedAt, noCooldown)).toEqual({
      ok: true,
    });
  });
});

describe("validateDecision", () => {
  it("allows approve and signoff without feedback", () => {
    expect(validateDecision("approve", undefined)).toEqual({ ok: true });
    expect(validateDecision("signoff", "")).toEqual({ ok: true });
  });

  it("requires feedback for request_changes", () => {
    expect(validateDecision("request_changes", undefined)).toMatchObject({ ok: false });
    expect(validateDecision("request_changes", "please fix")).toEqual({ ok: true });
  });
});

describe("sign-off chains", () => {
  const chain: SignerRef[] = [
    { signerId: "mentor", signerName: "Mentor", signerRole: "instructor" },
    { signerId: "officer", signerName: "Safety Officer", signerRole: "org_admin" },
  ];

  it("allows the first signer", () => {
    expect(canSign(chain, [], "mentor")).toEqual({ ok: true });
  });

  it("blocks a later signer before the first has signed", () => {
    const res = canSign(chain, [], "officer");
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.message).toContain("Mentor");
  });

  it("blocks a signer not on the chain", () => {
    expect(canSign(chain, [], "stranger")).toMatchObject({ ok: false });
  });

  it("blocks a duplicate signature", () => {
    const done: SignOffDone[] = [{ signerId: "mentor", order: 0 }];
    expect(canSign(chain, done, "mentor")).toMatchObject({ ok: false });
  });

  it("allows the second signer once the first has signed", () => {
    const done: SignOffDone[] = [{ signerId: "mentor", order: 0 }];
    expect(canSign(chain, done, "officer")).toEqual({ ok: true });
  });

  it("chainComplete requires every member", () => {
    const done: SignOffDone[] = [{ signerId: "mentor", order: 0 }];
    expect(chainComplete(chain, done)).toBe(false);
    expect(chainComplete(chain, [...done, { signerId: "officer", order: 1 }])).toBe(true);
  });

  it("chainComplete is true for an empty chain", () => {
    expect(chainComplete([], [])).toBe(true);
  });
});

describe("resolveDecisionStatus", () => {
  it("request_changes → changes_requested", () => {
    expect(resolveDecisionStatus("request_changes", [], [], "m")).toBe("changes_requested");
  });

  it("approve → approved", () => {
    expect(resolveDecisionStatus("approve", [], [], "m")).toBe("approved");
  });

  it("signoff on empty chain → signed_off", () => {
    expect(resolveDecisionStatus("signoff", [], [], "m")).toBe("signed_off");
  });

  it("signoff with pending chain members → approved", () => {
    const chain: SignerRef[] = [
      { signerId: "mentor", signerName: "M", signerRole: "instructor" },
      { signerId: "officer", signerName: "O", signerRole: "org_admin" },
    ];
    const done: SignOffDone[] = [{ signerId: "mentor", order: 0 }];
    expect(resolveDecisionStatus("signoff", chain, done, "officer")).toBe("signed_off");
    expect(resolveDecisionStatus("signoff", chain, [], "mentor")).toBe("approved");
  });
});
