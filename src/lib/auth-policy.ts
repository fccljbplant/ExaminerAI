/** Pure fail-closed policy helpers for edge middleware and scheduled routes. */

type RuntimeEnvironment = {
  NODE_ENV?: string;
  JWT_SECRET?: string;
  CRON_SECRET?: string;
};

const DEVELOPMENT_JWT_SECRET = "examiner-ai-dev-secret-change-me";

/**
 * Resolve the Edge middleware signing secret. Production deployments must
 * provide JWT_SECRET; only local/test runtimes may use the development key.
 */
export function getMiddlewareJwtSecret(env: RuntimeEnvironment): string | null {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.NODE_ENV === "production") return null;
  return DEVELOPMENT_JWT_SECRET;
}

/**
 * A missing cron secret is tolerated only outside production. When configured,
 * the bearer token must match exactly in every environment.
 */
export function isCronAuthorizationValid(
  authorizationHeader: string | null,
  env: RuntimeEnvironment,
): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return env.NODE_ENV !== "production";
  return authorizationHeader === "Bearer " + secret;
}
