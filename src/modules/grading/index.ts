/** Grading Module — public API
 *
 * Grading — grade overrides, report cards, certificates, peer assessment
 *
 * This module is a skeleton — the actual code still lives in src/lib/ and
 * src/components/examiner/. The re-exports below provide a stable import
 * path (@/modules/grading) that other modules can use. Over time,
 * the implementation files will be moved into this directory.
 *
 * API routes for this domain live under src/app/api/grades/report-cards/
 * and are thin HTTP wrappers that call into this module's library functions.
 */

// Re-export shared library functions
export * from "@/lib/csv-export";
