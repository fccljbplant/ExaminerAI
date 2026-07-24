/**
 * Structured logger — lightweight, zero-dependency.
 *
 * Phase 5.6: Replaces ad-hoc console.log/error/warn calls with a structured
 * logger that adds:
 *  - ISO timestamps (so logs are sortable + timezone-clear)
 *  - Log levels (debug/info/warn/error)
 *  - Optional context (userId, requestId, feature) for tracing
 *  - JSON output in production (parseable by Vercel logs / Datadog / etc.)
 *  - Pretty output in development (readable in the terminal)
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("User logged in", { userId: "abc123", email: "x@y.com" });
 *   logger.error("AI call failed", { feature: "weekly-test", error: "timeout" });
 *   logger.warn("Rate limit approaching", { rpmUsed: 55, rpmLimit: 60 });
 *
 * In production (NODE_ENV=production): outputs JSON lines.
 * In development: outputs colored, human-readable lines.
 *
 * Logs are written to stdout via console.log/error — Vercel captures these
 * automatically. No external service (Sentry, Datadog) is required, but
 * the JSON format makes it easy to add one later.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  userId?: string;
  requestId?: string;
  feature?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";
const isVerbose = process.env.LOG_LEVEL === "debug"; // set LOG_LEVEL=debug for verbose logs

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: LogLevel = isVerbose ? "debug" : "info";

const levelColors: Record<LogLevel, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m",  // cyan
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
};
const resetColor = "\x1b[0m";

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[minLevel];
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();

  if (isProduction) {
    // JSON lines — parseable by log aggregators
    const entry = {
      ts: timestamp,
      level,
      msg: message,
      ...context,
    };
    const line = JSON.stringify(entry);
    if (level === "error" || level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
  } else {
    // Pretty output for development
    const color = levelColors[level];
    const ctxStr = context && Object.keys(context).length > 0
      ? " " + JSON.stringify(context)
      : "";
    const line = `${color}[${timestamp}] ${level.toUpperCase().padEnd(5)}${resetColor} ${message}${ctxStr}`;
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};

/** Create a child logger with fixed context (e.g. a requestId for a single
 *  HTTP request). All subsequent logs include this context automatically.
 *
 *  Usage:
 *    const reqLogger = logger.child({ requestId: "abc", userId: "xyz" });
 *    reqLogger.info("Processing request");
 *    reqLogger.error("Failed", { error: "timeout" });
 */
export function createChildLogger(fixedContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) => log("debug", message, { ...fixedContext, ...context }),
    info: (message: string, context?: LogContext) => log("info", message, { ...fixedContext, ...context }),
    warn: (message: string, context?: LogContext) => log("warn", message, { ...fixedContext, ...context }),
    error: (message: string, context?: LogContext) => log("error", message, { ...fixedContext, ...context }),
  };
}
