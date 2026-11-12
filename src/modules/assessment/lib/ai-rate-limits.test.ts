import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settingFindUnique: vi.fn(),
  usageCount: vi.fn(),
  usageAggregate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    setting: { findUnique: mocks.settingFindUnique },
    aIUsageLog: {
      count: mocks.usageCount,
      aggregate: mocks.usageAggregate,
    },
  },
}));

import {
  checkUserAILimit,
  getCategoryLimit,
  getOrgBudgetLimit,
  isDemoAIEnabled,
  isOrgOverBudget,
} from "./ai-rate-limits";

describe("AI rate-limit and budget failure handling", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not replace an unavailable category limit with a permissive default", async () => {
    mocks.settingFindUnique.mockRejectedValue(new Error("settings unavailable"));
    await expect(getCategoryLimit("test")).rejects.toThrow("AI rate-limit settings are unavailable");
  });

  it("rejects malformed configured limits rather than silently using a permissive default", async () => {
    mocks.settingFindUnique.mockResolvedValue({ value: "not-a-number" });
    await expect(getCategoryLimit("test")).rejects.toThrow("AI rate-limit settings are unavailable");
  });

  it("blocks a user request when usage counts cannot be read", async () => {
    mocks.settingFindUnique.mockResolvedValue({ value: "50" });
    mocks.usageCount.mockRejectedValue(new Error("usage store unavailable"));

    await expect(checkUserAILimit("learner-1", "test")).rejects.toThrow("AI usage counts are unavailable");
    expect(mocks.usageCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ success: true }),
    }));
  });

  it("disables demo AI when its setting cannot be verified", async () => {
    mocks.settingFindUnique.mockRejectedValue(new Error("settings unavailable"));
    await expect(isDemoAIEnabled()).resolves.toBe(false);
  });

  it("does not interpret an unavailable organisation budget setting as unlimited", async () => {
    mocks.settingFindUnique.mockRejectedValue(new Error("settings unavailable"));
    await expect(getOrgBudgetLimit("org-1")).rejects.toThrow(
      "Organisation AI budget settings are unavailable",
    );
  });

  it("rejects malformed organisation budgets rather than treating them as unlimited", async () => {
    mocks.settingFindUnique.mockResolvedValue({ value: "unlimited" });
    await expect(getOrgBudgetLimit("org-invalid")).rejects.toThrow(
      "Organisation AI budget settings are unavailable",
    );
  });

  it("blocks an organisation budget decision when usage aggregation fails", async () => {
    mocks.settingFindUnique.mockResolvedValue({ value: "100000" });
    mocks.usageAggregate.mockRejectedValue(new Error("usage store unavailable"));

    await expect(isOrgOverBudget("org-1")).rejects.toThrow(
      "Organisation AI usage is unavailable",
    );
    expect(mocks.usageAggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ success: true }),
    }));
  });
});
