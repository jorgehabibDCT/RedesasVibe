import type { AuthProblem } from './authProblems.js';

/** Result of Pegasus session validation (cacheable HTTP path). */
export type PegasusValidateResult =
  | { ok: true; mode: 'bypass' | 'pegasus_http' }
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
