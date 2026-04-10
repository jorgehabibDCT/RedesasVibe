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
 * Operator / admin UI gate for **`GET /api/v1/bitacora/operator-meta`**. Independent of
 * **`PEGASUS_ALLOWED_*`** (app access).
 *
 * Precedence:
 * 1. **`PEGASUS_OPERATOR_USER_IDS`** / **`PEGASUS_OPERATOR_GROUP_IDS`** (explicit allow / rollout override).
 * 2. Pegasus **`/user/resources`**: **`is_staff`** or **`is_superuser`** when enrichment succeeded
 *    (**`principal.resources`** is set — omitted if the fetch failed, so failure never grants operator).
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
 * True for operator UI. **`machine_ingest`** and **`bypass`** never qualify.
 */
export function isOperatorPrincipal(
  principal: PegasusPrincipal | undefined,
  authMode: string | undefined,
): boolean {
  if (authMode === 'machine_ingest' || authMode === 'bypass') return false;
  if (!principal) return false;
  const c = getOperatorGateConfig();
  if (principal.userId && c.operatorUserIds.has(principal.userId)) return true;
  if (principal.groupIds.some((g) => c.operatorGroupIds.has(g))) return true;
  if (principal.resources) {
    if (principal.resources.isStaff || principal.resources.isSuperuser) return true;
  }
  return false;
}
