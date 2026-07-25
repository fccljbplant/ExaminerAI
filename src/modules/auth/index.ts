/** Auth Module — public API
 *
 * Authentication + authorization — login, JWT, RBAC, password reset
 *
 * This module is a skeleton — the actual code still lives in src/lib/ and
 * src/components/examiner/. The re-exports below provide a stable import
 * path (@/modules/auth) that other modules can use. Over time,
 * the implementation files will be moved into this directory.
 *
 * API routes for this domain live under src/app/api/auth/password-reset-requests/
 * and are thin HTTP wrappers that call into this module's library functions.
 */

// Re-export shared library functions
export * from "@/lib/auth";
export * from "@/lib/rbac";
