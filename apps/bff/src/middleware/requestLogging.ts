import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { PegasusPrincipal } from '../auth/pegasusAuth.types.js';
import { logRequestComplete } from '../observability/log.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    /** Opaque Pegasus session token after successful validation */
    pegasusToken?: string;
    pegasusAuthMode?: 'bypass' | 'pegasus_http';
    pegasusPrincipal?: PegasusPrincipal;
  }
}

/**
 * Assigns `X-Request-Id` (or propagates inbound `X-Request-Id`), attaches `req.requestId`, logs one line per finished response.
 * Does not log query strings (avoid accidental token leakage from future routes).
 */
export function requestLoggingMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const inbound = req.headers['x-request-id'];
    const requestId =
      typeof inbound === 'string' && inbound.trim() !== '' ? inbound.trim() : randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const start = Date.now();
    res.on('finish', () => {
      logRequestComplete({
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  };
}
