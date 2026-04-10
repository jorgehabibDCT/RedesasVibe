import type { PegasusPrincipal } from '../auth/pegasusAuth.types.js';

/**
 * Operator-meta JSON only: derived from **`req.pegasusPrincipal`** (login + optional `/user/resources`).
 * No tokens, no raw Pegasus payloads.
 */
export interface OperatorMetaPegasusIdentity {
  loginUserId: string | null;
  /** Present when `/user/resources` returned parseable JSON after login; otherwise enrichment unavailable. */
  resources: {
    id: string | null;
    username: string | null;
    email: string | null;
    isStaff: boolean;
    isSuperuser: boolean;
  } | null;
}

export function pegasusIdentityForOperatorMeta(
  principal: PegasusPrincipal | undefined,
): OperatorMetaPegasusIdentity {
  const loginUserId = principal?.userId ?? null;
  const r = principal?.resources;
  if (!r) {
    return { loginUserId, resources: null };
  }
  return {
    loginUserId,
    resources: {
      id: r.id ?? null,
      username: r.username ?? null,
      email: r.email ?? null,
      isStaff: r.isStaff,
      isSuperuser: r.isSuperuser,
    },
  };
}
