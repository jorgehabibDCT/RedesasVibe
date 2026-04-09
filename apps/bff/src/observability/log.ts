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
}): void {
  emit('warn', 'auth_failure', fields);
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
