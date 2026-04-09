/**
 * Placeholder hooks for future Sentry / APM. Safe no-ops unless wired in a later phase.
 * Call sites stay stable; implementation can delegate to `@sentry/node` when added.
 */

export function captureExceptionForObservability(err: unknown, context: Record<string, unknown>): void {
  if (process.env.OBSERVABILITY_CAPTURE_EXCEPTIONS === 'true') {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'exception_capture_stub',
        service: 'redesas-lite-bff',
        message: err instanceof Error ? err.message : String(err),
        ...context,
      }),
    );
  }
}

export function captureMessageForObservability(message: string, context: Record<string, unknown>): void {
  if (process.env.OBSERVABILITY_CAPTURE_MESSAGES === 'true') {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'message_capture_stub',
        service: 'redesas-lite-bff',
        message,
        ...context,
      }),
    );
  }
}
