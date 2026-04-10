import type { NextFunction, Request, Response } from 'express';
import { AuthProblems, authErrorBody } from '../auth/authProblems.js';
import { extractBearerToken } from '../auth/bearer.js';
import { validatePegasusSession } from '../auth/pegasusAuth.service.js';
import {
  logAuthFailure,
  logAuthMiddlewareError,
  logAuthSuccess,
  logPegasusPrincipalSummary,
} from '../observability/log.js';

const messages: Record<string, string> = {
  [AuthProblems.missingToken]: 'No autorizado',
  [AuthProblems.malformedAuthHeader]: 'Cabecera Authorization inválida',
  [AuthProblems.invalidToken]: 'Token inválido',
  [AuthProblems.tokenExpired]: 'Sesión finalizada, token expirado',
  [AuthProblems.authUnavailable]: 'Autenticación no disponible',
};

export function requireAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const authMode = process.env.PEGASUS_AUTH_DISABLED === 'true' ? 'bypass' : 'pegasus_http';
      const extracted = extractBearerToken(req.headers.authorization);
      if (!extracted.ok) {
        const problem = extracted.problem;
        logAuthFailure({
          requestId: req.requestId ?? 'unknown',
          path: req.path,
          problem,
          authMode,
          reason: 'authorization_header_missing_or_invalid',
        });
        res.status(401).json(authErrorBody(problem, messages[problem] ?? 'No autorizado'));
        return;
      }

      const pegasus = await validatePegasusSession(extracted.token);
      if (!pegasus.ok) {
        const problem = pegasus.problem;
        logAuthFailure({
          requestId: req.requestId ?? 'unknown',
          path: req.path,
          problem,
          authMode: pegasus.mode,
          reason:
            pegasus.reason === 'pegasus_http_401' || pegasus.reason === 'pegasus_http_403'
              ? 'token_invalid_or_expired'
              : pegasus.reason,
        });
        res.status(401).json(authErrorBody(problem, messages[problem] ?? 'No autorizado'));
        return;
      }

      logAuthSuccess({
        requestId: req.requestId ?? 'unknown',
        path: req.path,
        authMode: pegasus.mode,
      });
      if (
        pegasus.ok &&
        pegasus.mode === 'pegasus_http' &&
        pegasus.principalExtraction &&
        process.env.PEGASUS_PRINCIPAL_SUMMARY_LOG !== 'false'
      ) {
        const m = pegasus.principalExtraction;
        logPegasusPrincipalSummary({
          requestId: req.requestId ?? 'unknown',
          path: req.path,
          hasUserId: m.hasUserId,
          groupCount: m.groupCount,
          pathsMatched: m.pathsMatched,
          userIdSource: m.userIdSource,
          bodyParseFailed: m.bodyParseFailed,
        });
      }
      req.pegasusToken = extracted.token;
      req.pegasusAuthMode = pegasus.mode;
      if (pegasus.ok) {
        req.pegasusPrincipal = pegasus.principal;
      }
      next();
    } catch (e) {
      logAuthMiddlewareError({
        requestId: req.requestId ?? 'unknown',
        path: req.path,
        message: e instanceof Error ? e.message : String(e),
      });
      next(e);
    }
  })();
}
