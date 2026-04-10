import type { NextFunction, Request, Response } from 'express';
import { getAppAuthorizationConfig, isAppAuthorizationEnabled } from '../config/authzConfig.js';
import { logAuthorizationFailure, logAuthorizationSuccess } from '../observability/log.js';

const FORBIDDEN_BODY = {
  error: 'forbidden',
  problem: 'app_access_denied',
  message: 'No autorizado para usar esta aplicación.',
} as const;

export function requireAuthorizationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.requestId ?? 'unknown';
  const path = req.path;
  const authMode = req.pegasusAuthMode ?? 'pegasus_http';
  const config = getAppAuthorizationConfig();

  // Keep current behavior when no explicit app-level allowlists are configured.
  if (!isAppAuthorizationEnabled(config)) {
    logAuthorizationSuccess({
      requestId,
      path,
      authMode,
      hasUserId: Boolean(req.pegasusPrincipal?.userId),
      groupCount: req.pegasusPrincipal?.groupIds.length ?? 0,
    });
    next();
    return;
  }

  const principal = req.pegasusPrincipal;
  if (!principal || (!principal.userId && principal.groupIds.length === 0)) {
    logAuthorizationFailure({
      requestId,
      path,
      authMode,
      reason: 'principal_missing',
      hasUserId: false,
      groupCount: 0,
    });
    res.status(403).json(FORBIDDEN_BODY);
    return;
  }

  const userAllowed = principal.userId ? config.allowedUserIds.has(principal.userId) : false;
  const groupAllowed = principal.groupIds.some((g) => config.allowedGroupIds.has(g));
  if (userAllowed || groupAllowed) {
    logAuthorizationSuccess({
      requestId,
      path,
      authMode,
      hasUserId: Boolean(principal.userId),
      groupCount: principal.groupIds.length,
    });
    next();
    return;
  }

  logAuthorizationFailure({
    requestId,
    path,
    authMode,
    reason: config.allowedUserIds.size > 0 && config.allowedGroupIds.size === 0 ? 'user_not_allowed' : 'group_not_allowed',
    hasUserId: Boolean(principal.userId),
    groupCount: principal.groupIds.length,
  });
  res.status(403).json(FORBIDDEN_BODY);
}
