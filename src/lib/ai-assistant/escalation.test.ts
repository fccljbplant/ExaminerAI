/**
 * Escalation Engine Tests (Section 3 VERIFY)
 */
import { describe, it, expect } from "vitest";
import { shouldEscalate, type EscalatableFlag } from "@/lib/ai-assistant/escalation";

// Helper: create a test flag
function makeFlag(overrides: Partial<EscalatableFlag> = {}): EscalatableFlag {
  return {
    id: "test-flag-id",
    tier: "warning",
    type: "psychological",
    userId: "test-user-id",
    status: "open",
    createdAt: new Date(), // now by default
    resolvedAt: null,
    ...overrides,
  };
}

describe("AI Assistant — Escalation Engine", () => {
  it("does not escalate a fresh amber flag (0 days, 1 occurrence)", () => {
    const flag = makeFlag({ createdAt: new Date() }); // just now
    const result = shouldEscalate(flag, 1);
    expect(result.escalated).toBe(false);
    expect(result.trigger).toBe("none");
  });

  it("escalates an amber flag after 7 days (duration trigger)", () => {
    const flag = makeFlag({ createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) }); // 8 days ago
    const result = shouldEscalate(flag, 1);
    expect(result.escalated).toBe(true);
    expect(result.toTier).toBe("red");
    expect(result.trigger).toBe("duration");
    expect(result.reason).toContain("8 days");
  });

  it("escalates a repeat amber flag after 2 days (shortened timer)", () => {
    const flag = makeFlag({ createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }); // 3 days ago
    const result = shouldEscalate(flag, 2); // 2nd occurrence
    expect(result.escalated).toBe(true);
    expect(result.toTier).toBe("red");
    expect(result.trigger).toBe("repeat");
    expect(result.reason).toContain("repeat");
  });

  it("escalates immediately on 3rd+ recurrence (immediate trigger)", () => {
    const flag = makeFlag({ createdAt: new Date() }); // just created
    const result = shouldEscalate(flag, 3); // 3rd occurrence
    expect(result.escalated).toBe(true);
    expect(result.toTier).toBe("red");
    expect(result.trigger).toBe("repeat");
    expect(result.reason).toContain("Immediate");
  });

  it("does not escalate a resolved flag", () => {
    const flag = makeFlag({ status: "resolved", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const result = shouldEscalate(flag, 1);
    expect(result.escalated).toBe(false);
  });

  it("does not escalate a dismissed flag", () => {
    const flag = makeFlag({ status: "dismissed", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const result = shouldEscalate(flag, 1);
    expect(result.escalated).toBe(false);
  });

  it("does not escalate a green flag", () => {
    const flag = makeFlag({ tier: "green", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const result = shouldEscalate(flag, 1);
    expect(result.escalated).toBe(false);
  });

  it("does not escalate a red flag (already escalated)", () => {
    const flag = makeFlag({ tier: "red", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const result = shouldEscalate(flag, 1);
    expect(result.escalated).toBe(false);
  });
});
