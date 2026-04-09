/**
 * Stable `problem` field for 401/403 JSON (aligned with qualitas-installations client interceptors).
 */
export const AuthProblems = {
  missingToken: 'missing_token',
  malformedAuthHeader: 'malformed_auth_header',
  invalidToken: 'invalid_token',
  tokenExpired: 'token_expired',
  authUnavailable: 'auth_unavailable',
} as const;

export type AuthProblem = (typeof AuthProblems)[keyof typeof AuthProblems];

export function authErrorBody(problem: AuthProblem, message: string) {
  return { message, problem };
}
