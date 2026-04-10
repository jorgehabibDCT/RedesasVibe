import type { AuthProblem } from './authProblems.js';

export interface PegasusPrincipal {
  userId?: string;
  groupIds: string[];
}

/**
 * Safe summary of what was inferred from `/api/login` JSON (for ops validation).
 * Never includes raw tokens or full payloads.
 */
export interface PegasusPrincipalExtractionMeta {
  hasUserId: boolean;
  groupCount: number;
  /** Which JSON paths contributed user id and/or group ids (e.g. `root.user_id`, `nested.user.groups`). */
  pathsMatched: string[];
  /** True when the response was not a JSON object or JSON read/parse failed. */
  bodyParseFailed?: boolean;
}

/** Result of Pegasus session validation (cacheable HTTP path). */
export type PegasusValidateResult =
  | {
      ok: true;
      mode: 'bypass' | 'pegasus_http';
      principal?: PegasusPrincipal;
      /** Present after a successful `pegasus_http` validation when JSON was inspected (may be empty principal). */
      principalExtraction?: PegasusPrincipalExtractionMeta;
    }
  | {
      ok: false;
      problem: AuthProblem;
      mode: 'pegasus_http';
      reason:
        | 'pegasus_site_unset'
        | 'pegasus_http_401'
        | 'pegasus_http_403'
        | 'pegasus_http_4xx'
        | 'pegasus_http_5xx'
        | 'pegasus_timeout'
        | 'pegasus_network_error';
    };
