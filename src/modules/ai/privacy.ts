import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

/**
 * modules/ai — privacy.ts (2026-08-15)
 *
 * Data-scientist-grade anonymization + encryption for anything we hand
 * to an external AI provider. Two guarantees:
 *
 *  1. NO personal data leaves the server. Learners and instructors are
 *     referenced by a deterministic pseudonym ("student-a1b2c3d4")
 *     derived from an HMAC of their id + a server secret — stable
 *     across requests (the tutor can say "student-a1b2c3d4" and the
 *     next turn still means the same person) but irreversible without
 *     the secret. Names, emails and addresses never appear.
 *
 *  2. Cached context packs are ENCRYPTED AT REST (AES-256-GCM). Even
 *     if the DB leaks, the learning-data context is ciphertext.
 *
 * Secret priority: AI_CONTEXT_SECRET → JWT_SECRET → dev default.
 * Rotating the secret invalidates pseudonyms and cached packs — an
 * acceptable, documented trade-off for a cache.
 */

const DEV_SECRET = "examiner-ai-context-dev-secret";

function contextSecret(): string {
  return process.env.AI_CONTEXT_SECRET || process.env.JWT_SECRET || DEV_SECRET;
}

function hmac(value: string): string {
  return createHmac("sha256", contextSecret()).update(value).digest("hex");
}

/** Deterministic, secret-bound pseudonym for a user id. */
export function pseudonym(userId: string, kind: "student" | "instructor" = "student"): string {
  return `${kind}-${hmac(userId).slice(0, 8)}`;
}

/** Rough token estimate — the standard chars/4 heuristic, good enough for
 *  cost accounting on cached context packs. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export interface EncryptedPayload {
  v: 1;
  ct: string; // base64 ciphertext
  iv: string; // base64
  tag: string; // base64 auth tag
}

/** AES-256-GCM encrypt → a JSON string safe to store in AICache.response. */
export function encryptPayload(plaintext: string): string {
  const key = createHmac("sha256", contextSecret()).update("aes-key").digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const payload: EncryptedPayload = {
    v: 1,
    ct: ct.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
  return JSON.stringify(payload);
}

/** Decrypt a payload produced by encryptPayload. Returns null on any
 *  tamper/mismatch (wrong secret, corrupted data). */
export function decryptPayload(encrypted: string): string | null {
  try {
    const payload = JSON.parse(encrypted) as EncryptedPayload;
    if (payload.v !== 1) return null;
    const key = createHmac("sha256", contextSecret()).update("aes-key").digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(payload.ct, "base64")),
      decipher.final(),
    ]);
    return pt.toString("utf8");
  } catch {
    return null;
  }
}
