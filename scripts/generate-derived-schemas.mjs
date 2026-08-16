/**
 * scripts/generate-derived-schemas.mjs — derive the production and demo
 * Prisma schemas from the single source of truth: prisma/schema.prisma.
 *
 *   prisma/schema.prod.prisma = prod header (comments + generator +
 *                               Postgres datasource) + the model section
 *                               of schema.prisma.
 *   prisma/.demo.prisma      = demo header (SQLite + DEMO_DATABASE_URL +
 *                               demo-client output) + the same models.
 *
 * The three schemas can never drift apart again: models are defined once.
 * Run automatically by `npm run db:generate` (postinstall + Vercel build).
 */

import fs from "node:fs";

const MAIN = "prisma/schema.prisma";
const PROD = "prisma/schema.prod.prisma";
const DEMO = "prisma/.demo.prisma";

const main = fs.readFileSync(MAIN, "utf8").replace(/\r\n/g, "\n");
const bodyStart = main.indexOf("model CourseEnrollment");
if (bodyStart === -1) {
  console.error("schema.prisma body anchor (model CourseEnrollment) missing");
  process.exit(1);
}
const models = main.slice(bodyStart);

// ── Production schema ────────────────────────────────────────────────
const prod = fs.readFileSync(PROD, "utf8").replace(/\r\n/g, "\n");
const prodStart = prod.indexOf("model CourseEnrollment");
if (prodStart === -1) {
  console.error("schema.prod.prisma body anchor missing — restore from git and rerun");
  process.exit(1);
}
fs.writeFileSync(PROD, prod.slice(0, prodStart) + models);
console.log("generated", PROD);

// ── Demo schema ──────────────────────────────────────────────────────
const demoHeader =
  "// ExaminerAI — Prisma schema (SQLite demo db for @demo.ai accounts)\n" +
  "//\n" +
  "// AUTO-GENERATED from prisma/schema.prisma — do not edit by hand.\n" +
  "// Regenerate: node scripts/generate-derived-schemas.mjs\n" +
  "\n" +
  "generator client {\n" +
  '  provider = "prisma-client-js"\n' +
  '  output   = "../node_modules/.cache/demo-client"\n' +
  "}\n" +
  "\n" +
  "datasource db {\n" +
  '  provider = "sqlite"\n' +
  '  url      = env("DEMO_DATABASE_URL")\n' +
  "}\n" +
  "\n";
fs.writeFileSync(DEMO, demoHeader + models);
console.log("generated", DEMO);
