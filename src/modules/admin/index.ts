/** Admin Module — public API
 *
 * Administration — users, batches, roles, settings, audit logs
 *
 * This module is a skeleton — the actual code still lives in src/lib/ and
 * src/components/examiner/. The re-exports below provide a stable import
 * path (@/modules/admin) that other modules can use. Over time,
 * the implementation files will be moved into this directory.
 *
 * API routes for this domain live under src/app/api/admin/batches/
 * and are thin HTTP wrappers that call into this module's library functions.
 */

// Re-export shared library functions
export * from "@/lib/audit-log";
export * from "@/lib/seed";
