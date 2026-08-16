import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { getDemoDb } from "./demo-db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const mainDb =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = mainDb;

/**
 * Per-request demo routing context.
 *
 * The store is a MUTABLE BOX entered synchronously at the very top of
 * auth entry points (getAuthUser, the login route) — BEFORE their first
 * await — because `enterWith` propagates to the caller's await
 * continuations only when performed in the caller's synchronous prefix.
 * Once the JWT/email is known, the box's flag flips to true and every
 * subsequent `db.*` call in that request reads the LOCAL demo SQLite
 * database instead of the remote one.
 */
export interface DemoSessionBox {
  demo: boolean;
}

export const demoSession = new AsyncLocalStorage<DemoSessionBox>();

/** Enter (or reuse) the demo box — MUST be called synchronously before
 *  any await in the request entry point. */
export function enterDemoSessionBox(): DemoSessionBox {
  const box = demoSession.getStore() ?? { demo: false };
  demoSession.enterWith(box);
  return box;
}

/** True while a demo account is being served. */
export function isDemoSession(): boolean {
  return demoSession.getStore()?.demo === true;
}

export const db = new Proxy(mainDb, {
  get(target, prop) {
    const box = demoSession.getStore();
    if (box?.demo) {
      const demo = getDemoDb();
      if (demo) return (demo as unknown as Record<PropertyKey, unknown>)[prop];
    }
    return (target as unknown as Record<PropertyKey, unknown>)[prop];
  },
}) as PrismaClient;
