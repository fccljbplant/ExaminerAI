/** Format a course price for display — consistent across all marketplace UI. */
export function formatPrice(price: number, currency: string = "USD"): string {
  if (price === 0) return "Free";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${price.toFixed(2)}`;
}

/** Format a date for display — consistent across the app. */
export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Format a relative time (e.g., "2 hours ago", "just now"). */
export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d);
}
