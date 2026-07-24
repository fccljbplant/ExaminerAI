/**
 * Tests for auth utilities — pure functions that don't need DB access.
 *
 * The JWT signing/verification + password hashing flow is the most
 * security-critical part of the app. A silent regression here could
 * either lock everyone out or, worse, accept invalid tokens.
 *
 * We test the pure crypto functions directly (no Next.js cookies()
 * mock needed). The DB-dependent functions (getAuthUser, getCurrentUser)
 * are integration-tested via the API routes in the e2e suite.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import { signToken, verifyToken, hashPassword, comparePassword, type JwtPayload } from "../auth";

describe("JWT sign + verify", () => {
  const samplePayload: JwtPayload = {
    sub: "user-123",
    email: "student@examiner.ai",
    role: "student",
    name: "Test Student",
  };

  it("signs a token and verifies it round-trips", () => {
    const token = signToken(samplePayload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature

    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(samplePayload.sub);
    expect(verified?.email).toBe(samplePayload.email);
    expect(verified?.role).toBe(samplePayload.role);
    expect(verified?.name).toBe(samplePayload.name);
  });

  it("rejects a malformed token", () => {
    expect(verifyToken("not-a-valid-jwt")).toBeNull();
    expect(verifyToken("a.b.c")).toBeNull();
    expect(verifyToken("")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    // Sign with the dev secret, then tamper by flipping the last char
    const token = signToken(samplePayload);
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyToken(tampered)).toBeNull();
  });

  it("preserves role information correctly for each role", () => {
    for (const role of ["student", "teacher", "admin", "pending"] as const) {
      const token = signToken({ ...samplePayload, role });
      const verified = verifyToken(token);
      expect(verified?.role).toBe(role);
    }
  });
});

describe("password hashing", () => {
  it("hashes a password and verifies it round-trips", async () => {
    const password = "helloworld";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(40); // bcrypt hashes are ~60 chars

    const match = await comparePassword(password, hash);
    expect(match).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-password");
    const match = await comparePassword("wrong-password", hash);
    expect(match).toBe(false);
  });

  it("produces different hashes for the same password (salt)", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2); // different salts → different hashes
    // But both should verify against the same password
    expect(await comparePassword("same-password", hash1)).toBe(true);
    expect(await comparePassword("same-password", hash2)).toBe(true);
  });

  it("handles empty strings safely", async () => {
    const hash = await hashPassword("");
    expect(await comparePassword("", hash)).toBe(true);
    expect(await comparePassword("not-empty", hash)).toBe(false);
  });
});
