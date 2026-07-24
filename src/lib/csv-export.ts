/**
 * CSV export utility — generates a CSV string from an array of objects
 * and triggers a browser download.
 *
 * Usage:
 *   import { exportToCSV } from "@/lib/csv-export";
 *   exportToCSV("student-grades.csv", [
 *     { name: "Alice", score: 85, week: 3 },
 *     { name: "Bob", score: 72, week: 3 },
 *   ]);
 */

/** Escape a value for CSV — wraps in quotes if it contains commas, quotes, or newlines. */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Export an array of objects as a CSV file download.
 *  The first object's keys become the header row. */
export function exportToCSV(filename: string, data: Record<string, unknown>[]): void {
  if (!data.length) {
    // Empty file with just a note
    const blob = new Blob(["No data to export\n"], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, filename);
    return;
  }

  const headers = Object.keys(data[0]);
  const csvLines = [
    headers.join(","),
    ...data.map(row => headers.map(h => escapeCSVValue(row[h])).join(",")),
  ];
  const csv = csvLines.join("\n");

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
