/**
 * Structured BFF logs — **never** pass raw bearer tokens or full `Authorization` headers.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  ts: string;
  level: LogLevel;
  event: string;
  service: 'redesas-lite-bff';
  [key: string]: unknown;
}

const SERVICE = 'redesas-lite-bff' as const;

function emit(level: LogLevel, event: string, fields: Record<string, unknown>): void {
  const entry: StructuredLogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    service: SERVICE,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logRequestComplete(fields: {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}): void {
  emit('info', 'request_complete', fields);
}

export function logAuthFailure(fields: {
  requestId: string;
  path: string;
  problem: string;
  authMode: 'bypass' | 'pegasus_http';
  reason:
    | 'authorization_header_missing_or_invalid'
    | 'pegasus_site_unset'
    | 'pegasus_http_401'
    | 'pegasus_http_403'
    | 'pegasus_http_4xx'
    | 'pegasus_http_5xx'
    | 'pegasus_timeout'
    | 'pegasus_network_error'
    | 'token_invalid_or_expired';
}): void {
  emit('warn', 'auth_failure', fields);
}

export function logAuthSuccess(fields: {
  requestId: string;
  path: string;
  authMode: 'bypass' | 'pegasus_http';
}): void {
  emit('info', 'auth_success', fields);
}

/** Safe summary only — never log tokens or full Pegasus JSON bodies. */
export function logPegasusPrincipalSummary(fields: {
  requestId: string;
  path: string;
  hasUserId: boolean;
  groupCount: number;
  pathsMatched: string[];
  bodyParseFailed?: boolean;
}): void {
  emit('info', 'pegasus_principal_summary', fields);
}

export function logAuthorizationFailure(fields: {
  requestId: string;
  path: string;
  authMode: 'bypass' | 'pegasus_http';
  reason: 'principal_missing' | 'user_not_allowed' | 'group_not_allowed';
  hasUserId: boolean;
  groupCount: number;
}): void {
  emit('warn', 'authorization_failure', fields);
}

export function logAuthorizationSuccess(fields: {
  requestId: string;
  path: string;
  authMode: 'bypass' | 'pegasus_http';
  hasUserId: boolean;
  groupCount: number;
}): void {
  emit('info', 'authorization_success', fields);
}

export function logAuthMiddlewareError(fields: { requestId: string; path: string; message: string }): void {
  emit('error', 'auth_middleware_error', fields);
}

export function logUpstreamFailure(fields: {
  requestId: string;
  kind: 'upstream_unavailable' | 'upstream_invalid' | 'bitacora_failed';
  message: string;
}): void {
  emit('warn', 'upstream_failure', fields);
}

export function logCorsBlocked(fields: { requestId: string }): void {
  emit('warn', 'cors_blocked', fields);
}
