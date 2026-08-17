/**
 * modules/org-portal/lib/csv-parse.ts — small robust CSV parser
 *
 * B2B enterprise ops (2026-08-17): server-side parsing for the member
 * bulk-import route. Handles RFC-4180 basics — quoted fields, embedded
 * commas + newlines, escaped double quotes ("") and CRLF line endings —
 * without pulling in a dependency.
 */

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

/** Parse CSV text into rows of string cells. Never throws on content —
 *  malformed quoting degrades gracefully (the quote is kept literal). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Trailing row without a final newline (skip a fully-empty trailing cell).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface MemberCsvRow {
  email: string;
  /** admin | mentor | member — defaults to "member". */
  role: string;
  seat: boolean;
  department?: string;
}

/** Map raw CSV text onto member-import rows using a header row
 *  (email, role, seat, department — case-insensitive, any order). */
export function parseMemberRows(csv: string): MemberCsvRow[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const emailIdx = headers.indexOf("email");
  if (emailIdx === -1) {
    throw new CsvParseError("CSV must include an email column");
  }
  const roleIdx = headers.indexOf("role");
  const seatIdx = headers.indexOf("seat");
  const deptIdx = headers.indexOf("department");

  const out: MemberCsvRow[] = [];
  for (const raw of rows.slice(1)) {
    // Skip fully-blank rows (e.g. trailing newline artifacts).
    if (raw.every((cell) => cell.trim() === "")) continue;

    const email = (raw[emailIdx] ?? "").trim();
    const roleRaw = roleIdx >= 0 ? (raw[roleIdx] ?? "").trim().toLowerCase() : "";
    const role =
      roleRaw === "admin" || roleRaw === "mentor" || roleRaw === "member"
        ? roleRaw
        : "member";
    const seatRaw = seatIdx >= 0 ? (raw[seatIdx] ?? "").trim().toLowerCase() : "";
    const seat = seatRaw === "true" || seatRaw === "yes" || seatRaw === "1";
    const department = deptIdx >= 0 ? (raw[deptIdx] ?? "").trim() : "";

    out.push({ email, role, seat, department: department || undefined });
  }
  return out;
}
