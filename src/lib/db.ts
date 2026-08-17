import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { getDemoDb } from "./demo-db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Postgres pool cap for serverless (2026-08-17): every function instance
 *  opens its own Prisma pool, and Neon's pooled endpoint has a small
 *  slot ceiling — uncapped pools exhaust it ("remaining connection slots
 *  are reserved for roles with the SUPERUSER attribute"). 4 connections
 *  per instance is plenty for request-scoped queries. */
const MAIN_DATABASE_URL =
  process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("connection_limit=")
    ? process.env.DATABASE_URL +
      (process.env.DATABASE_URL.includes("?") ? "&" : "?") +
      "connection_limit=4&pool_timeout=10"
    : process.env.DATABASE_URL;

const mainDb =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
    ...(MAIN_DATABASE_URL ? { datasourceUrl: MAIN_DATABASE_URL } : {}),
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
