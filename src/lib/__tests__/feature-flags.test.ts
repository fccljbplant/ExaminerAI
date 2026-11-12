import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settingFindUnique: vi.fn(),
}));

vi.mock("../db", () => ({
  db: { setting: { findUnique: mocks.settingFindUnique } },
}));

import { isFeatureEnabled } from "../feature-flags";

describe("isFeatureEnabled", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("preserves the documented default for an absent feature setting", async () => {
    mocks.settingFindUnique.mockResolvedValue(null);

    await expect(isFeatureEnabled("test-default-enabled")).resolves.toBe(true);
    expect(mocks.settingFindUnique).toHaveBeenCalledWith({
      where: { key: "feature_test-default-enabled" },
    });
  });

  it("honours an explicit disabled setting", async () => {
    mocks.settingFindUnique.mockResolvedValue({ value: "false" });

    await expect(isFeatureEnabled("test-explicit-disabled")).resolves.toBe(false);
  });

  it("fails closed when the settings store is unavailable", async () => {
    vi.useFakeTimers();
    mocks.settingFindUnique.mockRejectedValue(new Error("settings database unavailable"));

    await expect(isFeatureEnabled("test-settings-outage")).resolves.toBe(false);
  });
});
