import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Production-oriented security headers for the BFF JSON API.
 *
 * **CSP `frame-ancestors`:** lists **parent** origins allowed to embed the **web app** in an iframe.
 * Apply the same (or stricter) policy on the CDN / static host that serves `index.html` — the BFF header alone does not protect the SPA shell.
 *
 * **HSTS:** Prefer termination at the load balancer / CDN. The BFF only emits `Strict-Transport-Security`
 * when `ENABLE_HSTS_HEADER=true` and `HSTS_MAX_AGE` is set — use only when the app is **always** served over HTTPS behind a correct `X-Forwarded-Proto` or direct TLS.
 */
export function securityHeadersMiddleware(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const hstsAge = process.env.HSTS_MAX_AGE?.trim();
    if (process.env.ENABLE_HSTS_HEADER === 'true' && hstsAge && /^\d+$/.test(hstsAge)) {
      res.setHeader('Strict-Transport-Security', `max-age=${hstsAge}; includeSubDomains`);
    }

    const raw = process.env.FRAME_ANCESTORS?.trim();
    if (raw) {
      const list = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length > 0) {
        res.setHeader('Content-Security-Policy', `frame-ancestors ${list.join(' ')}`);
      }
    }
    next();
  };
}
