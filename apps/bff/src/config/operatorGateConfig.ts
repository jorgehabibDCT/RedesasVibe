import type { PegasusPrincipal } from '../auth/pegasusAuth.types.js';

function parseCsvSet(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  );
}

/**
 * Operator / admin UI gate: users whose Pegasus-derived **`userId`** or **`groupIds`**
 * match these sets may call **`GET /api/v1/bitacora/operator-meta`**. Independent of
 * **`PEGASUS_ALLOWED_*`** (app access).
 *
 * We do **not** parse Pegasus OAuth-style `scope` strings today; configure explicit ids here.
 */
export function getOperatorGateConfig(): { operatorUserIds: Set<string>; operatorGroupIds: Set<string> } {
  return {
    operatorUserIds: parseCsvSet(process.env.PEGASUS_OPERATOR_USER_IDS),
    operatorGroupIds: parseCsvSet(process.env.PEGASUS_OPERATOR_GROUP_IDS),
  };
}

export function isOperatorGateConfigured(): boolean {
  const c = getOperatorGateConfig();
  return c.operatorUserIds.size > 0 || c.operatorGroupIds.size > 0;
}

/**
 * True when the principal matches operator env lists. **`machine_ingest`** and **`bypass`**
 * (no principal) never qualify.
 */
export function isOperatorPrincipal(
  principal: PegasusPrincipal | undefined,
  authMode: string | undefined,
): boolean {
  if (authMode === 'machine_ingest' || authMode === 'bypass') return false;
  if (!principal) return false;
  const c = getOperatorGateConfig();
  if (c.operatorUserIds.size === 0 && c.operatorGroupIds.size === 0) return false;
  if (principal.userId && c.operatorUserIds.has(principal.userId)) return true;
  if (principal.groupIds.some((g) => c.operatorGroupIds.has(g))) return true;
  return false;
}
