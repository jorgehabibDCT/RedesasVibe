import { AuthProblems, type AuthProblem } from './authProblems.js';

export type ExtractBearerResult =
  | { ok: true; token: string }
  | { ok: false; problem: AuthProblem };

const MAX_TOKEN_LEN = 8192;

/**
 * Extract Bearer token from `Authorization` header.
 * Uses a single anchored regex — not the narrow `access_token=[a-zA-Z0-9]+` anti-pattern.
 */
export function extractBearerToken(authorizationHeader: string | undefined): ExtractBearerResult {
  if (authorizationHeader == null || authorizationHeader.trim() === '') {
    return { ok: false, problem: AuthProblems.missingToken };
  }

  const m = /^Bearer\s+(.+)$/.exec(authorizationHeader.trim());
  if (!m) {
    return { ok: false, problem: AuthProblems.malformedAuthHeader };
  }

  const raw = m[1].trim();
  return validateOpaqueTokenShape(raw);
}

/** Validate non-empty opaque token shape before Pegasus (no newlines, bounded length). */
export function validateOpaqueTokenShape(token: string): ExtractBearerResult {
  const t = token.trim();
  if (t.length === 0) {
    return { ok: false, problem: AuthProblems.malformedAuthHeader };
  }
  if (t.length > MAX_TOKEN_LEN) {
    return { ok: false, problem: AuthProblems.invalidToken };
  }
  if (/[\r\n]/.test(t)) {
    return { ok: false, problem: AuthProblems.invalidToken };
  }
  return { ok: true, token: t };
}
