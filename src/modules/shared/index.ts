/** Shared Module — public API
 *
 * Shared infrastructure — DB, logging, API client, feature flags, utilities
 *
 * This module is a skeleton — the actual code still lives in src/lib/ and
 * src/components/examiner/. The re-exports below provide a stable import
 * path (@/modules/shared) that other modules can use. Over time,
 * the implementation files will be moved into this directory.
 *
 * API routes for this domain live under src/app/api/health/
 * and are thin HTTP wrappers that call into this module's library functions.
 */

// Re-export shared library functions
export * from "@/lib/db";
export * from "@/lib/logger";
export * from "@/lib/utils";
export * from "@/lib/api-client";
export * from "@/lib/api-response";
export * from "@/lib/feature-flags";
export * from "@/lib/constants";
export * from "@/lib/chart-theme";
export * from "@/lib/toast-helpers";
