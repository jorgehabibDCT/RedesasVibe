import type { NextFunction, Request, Response } from 'express';
import { isOperatorPrincipal } from '../config/operatorGateConfig.js';

/**
 * Sets **`req.pegasusIsOperator`** after auth + app allowlists. Used for operator-only routes.
 */
export function attachOperatorContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authMode = req.pegasusAuthMode ?? 'pegasus_http';
  req.pegasusIsOperator = isOperatorPrincipal(req.pegasusPrincipal, authMode);
  next();
}
