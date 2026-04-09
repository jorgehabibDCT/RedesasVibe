import type { AuthProblem } from './authProblems.js';

/** Result of Pegasus session validation (cacheable HTTP path). */
export type PegasusValidateResult =
  | { ok: true; mode: 'bypass' | 'pegasus_http' }
  | { ok: false; problem: AuthProblem };
