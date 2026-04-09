import type { NextFunction, Request, Response } from 'express';
import { AuthProblems, authErrorBody } from '../auth/authProblems.js';
import { extractBearerToken } from '../auth/bearer.js';
import { validatePegasusSession } from '../auth/pegasusAuth.service.js';
import { logAuthFailure, logAuthMiddlewareError } from '../observability/log.js';

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
      const extracted = extractBearerToken(req.headers.authorization);
      if (!extracted.ok) {
        const problem = extracted.problem;
        logAuthFailure({
          requestId: req.requestId ?? 'unknown',
          path: req.path,
          problem,
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
        });
        res.status(401).json(authErrorBody(problem, messages[problem] ?? 'No autorizado'));
        return;
      }

      req.pegasusToken = extracted.token;
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
