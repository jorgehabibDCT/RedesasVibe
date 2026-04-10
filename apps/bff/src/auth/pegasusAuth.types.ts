import type { AuthProblem } from './authProblems.js';

/** Minimal fields from Pegasus **`GET /user/resources`** (after successful `/api/login` validation). */
export interface PegasusUserResourcesProfile {
  id?: string;
  username?: string;
  email?: string;
  isStaff: boolean;
  isSuperuser: boolean;
}

export interface PegasusPrincipal {
  userId?: string;
  groupIds: string[];
  /**
   * Set only when **`/user/resources`** returned parseable JSON. Omitted when fetch is disabled,
   * fails, or returns non-2xx — so missing **`resources`** never implies staff.
   */
  resources?: PegasusUserResourcesProfile;
}

/**
 * Safe summary of what was inferred from `/api/login` JSON and **response headers** (for ops validation).
 * Never includes raw tokens or full payloads.
 */
export interface PegasusPrincipalExtractionMeta {
  hasUserId: boolean;
  groupCount: number;
  /**
   * Which JSON paths or header slots contributed (e.g. `root.user_id`, `response.header.x-peg-user-id`).
   * Does not include secret values.
   */
  pathsMatched: string[];
  /**
   * When `hasUserId` is true, whether the resolved id came from JSON vs response headers (body wins if both present).
   * Omitted when there is no user id.
   */
  userIdSource?: 'body' | 'header';
  /** True when the response was not a JSON object or JSON read/parse failed. */
  bodyParseFailed?: boolean;
}

/** Result of Pegasus session validation (cacheable HTTP path). */
export type PegasusValidateResult =
  | {
      ok: true;
      mode: 'bypass' | 'pegasus_http';
      principal?: PegasusPrincipal;
      /** Present after successful `pegasus_http` validation when JSON and/or response headers were inspected (principal may still be empty). */
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
