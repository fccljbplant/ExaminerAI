import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { awardTypedXPWithClient } from "../xp-ledger";

describe("awardTypedXPWithClient", () => {
  it("writes the award, level-up bonus, profile total and ledger aggregate through the supplied transaction client", async () => {
    const client = {
      xPLedger: {
        create: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 195 } }),
      },
      learnProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "profile-1",
          totalXP: 90,
          learnerLevel: "Rookie",
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as Parameters<typeof awardTypedXPWithClient>[0];

    const total = await awardTypedXPWithClient(
      client,
      "learner-1",
      "daily_test_done",
      "course-a",
      "daily-test:test-1",
    );

    expect(total).toBe(195);
    expect(client.xPLedger.create).toHaveBeenNthCalledWith(1, {
      data: {
        userId: "learner-1",
        courseId: "course-a",
        amount: 30,
        reason: "daily_test_done",
        referenceId: "daily-test:test-1",
      },
    });
    expect(client.learnProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { totalXP: 195, learnerLevel: "Learner" },
    });
    expect(client.xPLedger.create).toHaveBeenNthCalledWith(2, {
      data: {
        userId: "learner-1",
        courseId: "course-a",
        amount: 75,
        reason: "level_raise",
        referenceId: "level:Learner",
      },
    });
    expect(client.xPLedger.aggregate).toHaveBeenCalledWith({
      where: { userId: "learner-1" },
      _sum: { amount: true },
    });
  });

  it("does not touch a course profile when the award has no course scope", async () => {
    const client = {
      xPLedger: {
        create: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 30 } }),
      },
      learnProfile: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as Parameters<typeof awardTypedXPWithClient>[0];

    await awardTypedXPWithClient(client, "learner-1", "daily_test_done");

    expect(client.learnProfile.findUnique).not.toHaveBeenCalled();
    expect(client.learnProfile.update).not.toHaveBeenCalled();
    expect(client.xPLedger.create).toHaveBeenCalledOnce();
  });
});
