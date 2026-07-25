/**
 * Tests for the structured logger.
 *
 * The logger is used everywhere — if it throws or produces malformed output,
 * it could crash API routes or make production logs unparseable.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, createChildLogger } from "../logger";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info calls console.log", () => {
    logger.info("test message");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("warn calls console.warn", () => {
    logger.warn("warning message");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("error calls console.error", () => {
    logger.error("error message");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("includes the message in the output", () => {
    logger.info("unique test marker");
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("unique test marker");
  });

  it("includes context in the output", () => {
    logger.info("test", { userId: "abc123", feature: "test" });
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("abc123");
    expect(output).toContain("test");
  });

  it("includes a timestamp in the output", () => {
    logger.info("timestamped");
    const output = logSpy.mock.calls[0][0] as string;
    // Look for an ISO timestamp pattern (2026-07-20T...)
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("includes the log level in the output", () => {
    logger.error("level test");
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain("ERROR");
  });
});

describe("createChildLogger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes fixed context in all log calls", () => {
    const childLogger = createChildLogger({ requestId: "req-123", userId: "user-456" });
    childLogger.info("first message");
    childLogger.info("second message");

    const firstOutput = logSpy.mock.calls[0][0] as string;
    const secondOutput = logSpy.mock.calls[1][0] as string;

    expect(firstOutput).toContain("req-123");
    expect(firstOutput).toContain("user-456");
    expect(secondOutput).toContain("req-123");
    expect(secondOutput).toContain("user-456");
  });

  it("merges additional context with fixed context", () => {
    const childLogger = createChildLogger({ requestId: "req-123" });
    childLogger.info("test", { feature: "weekly-test" });

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("req-123"); // from fixed context
    expect(output).toContain("weekly-test"); // from additional context
  });
});
