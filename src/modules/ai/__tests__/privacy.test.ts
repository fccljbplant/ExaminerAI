import { describe, it, expect } from "vitest";
import {
  pseudonym,
  estimateTokens,
  encryptPayload,
  decryptPayload,
} from "../privacy";

describe("modules/ai — privacy layer", () => {
  it("produces stable, deterministic pseudonyms for the same id", () => {
    const a = pseudonym("user-1");
    const b = pseudonym("user-1");
    expect(a).toBe(b);
    expect(a).toMatch(/^student-[a-f0-9]{8}$/);
  });

  it("never contains the raw id, names or emails", () => {
    const p = pseudonym("cmssud3ts0002vkx4mpj31d9a");
    expect(p).not.toContain("cmssud3ts");
    expect(p).not.toContain("@");
    const instr = pseudonym("user-2", "instructor");
    expect(instr).toMatch(/^instructor-[a-f0-9]{8}$/);
  });

  it("differs across ids", () => {
    expect(pseudonym("user-a")).not.toBe(pseudonym("user-b"));
  });

  it("estimates tokens with the chars/4 heuristic", () => {
    expect(estimateTokens("")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("12345678")).toBe(2);
  });

  it("encrypts and decrypts payloads round-trip", () => {
    const plain = JSON.stringify({ course: "HSE", week: 2 });
    const enc = encryptPayload(plain);
    // ciphertext is not the plaintext
    expect(enc).not.toContain("HSE");
    expect(decryptPayload(enc)).toBe(plain);
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptPayload("sensitive context");
    const tampered = enc.replace(/^.{10}/, "XXXXXXXXXX");
    expect(decryptPayload(tampered)).toBeNull();
  });

  it("rejects non-JSON garbage", () => {
    expect(decryptPayload("not-a-payload")).toBeNull();
  });
});
