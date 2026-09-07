// FILE: src/modules/assessment/lib/__tests__/ai-json.test.ts
// Unit tests for unwrapItemsEnvelope — the json_object-mode array fix.
// Array-schema AI calls are requested as {"items": [...]} (json_object
// mode cannot emit a bare array) and unwrapped before zod validation.

import { describe, expect, it } from "vitest";
import { unwrapItemsEnvelope } from "../ai-json";

describe("unwrapItemsEnvelope", () => {
  it("unwraps the canonical items envelope", () => {
    const parsed = {
      items: [{ question: "Q1" }, { question: "Q2" }],
    };
    expect(unwrapItemsEnvelope(parsed)).toEqual([{ question: "Q1" }, { question: "Q2" }]);
  });

  it("unwraps when the model picks a different key (questions)", () => {
    const parsed = {
      questions: [{ question: "Why does X matter?" }],
    };
    expect(unwrapItemsEnvelope(parsed)).toEqual([{ question: "Why does X matter?" }]);
  });

  it("unwraps when the model nests the array under any key", () => {
    const parsed = { data: [1, 2, 3] };
    expect(unwrapItemsEnvelope(parsed)).toEqual([1, 2, 3]);
  });

  it("passes a bare array through untouched", () => {
    const parsed = [{ question: "Q1" }];
    expect(unwrapItemsEnvelope(parsed)).toEqual([{ question: "Q1" }]);
  });

  it("passes non-object, non-array input through (string, number, null)", () => {
    expect(unwrapItemsEnvelope("hello")).toBe("hello");
    expect(unwrapItemsEnvelope(42)).toBe(42);
    expect(unwrapItemsEnvelope(null)).toBe(null);
  });

  it("passes an object with NO array property through untouched", () => {
    // Validation will then fail with a clear schema error instead of
    // silently swallowing the malformed response.
    const parsed = { error: "I could not generate questions" };
    expect(unwrapItemsEnvelope(parsed)).toEqual(parsed);
  });

  it("returns the FIRST array-valued property when several exist", () => {
    const parsed = { items: ["a"], extra: ["b"] };
    expect(unwrapItemsEnvelope(parsed)).toEqual(["a"]);
  });
});
