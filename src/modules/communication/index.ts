/** Communication Module — public API
 *
 * Communication — messaging, comments, mentorship touchpoints
 *
 * This module is a skeleton — the actual code still lives in src/lib/ and
 * src/components/examiner/. The re-exports below provide a stable import
 * path (@/modules/communication) that other modules can use. Over time,
 * the implementation files will be moved into this directory.
 *
 * API routes for this domain live under src/app/api/messages/comments/
 * and are thin HTTP wrappers that call into this module's library functions.
 */

// Re-export shared library functions

// Components
export { default as Messages } from "@/components/examiner/Messages";

// Components
export { AskMyTeacher } from "@/components/examiner/AskMyTeacher";
