import { getBearerToken } from '../auth/memoryToken.js';
import { apiUrl } from './apiBaseUrl.js';

/** Subset of Pegasus principal for operator UI (no tokens or raw API payloads). */
export interface OperatorMetaPegasusIdentity {
  /** From **`/api/login`** body or configured identity headers. */
  loginUserId: string | null;
  /** From **`/user/resources`** when enrichment succeeded; otherwise **`null`**. */
  resources: {
    id: string | null;
    username: string | null;
    email: string | null;
    isStaff: boolean;
    isSuperuser: boolean;
  } | null;
}

/** Response from **`GET /api/v1/bitacora/operator-meta`** (operators only). */
export interface OperatorMetaPayload {
  bitacoraDataMode: string;
  pegasusAuthMode: string;
  pegasusIdentity: OperatorMetaPegasusIdentity;
  policyIncident: string | null;
  caseId: string | null;
  latestRawId: string | null;
  caseUpdatedAt: string | null;
  documentEnv: string | null;
}

/**
 * Loads operator observability metadata. Returns **`null`** when the user is not an operator (**404**)
 * or on other errors — callers must not treat **`null`** as failure for normal users.
 */
export async function fetchOperatorMeta(policyIncident: string | undefined): Promise<OperatorMetaPayload | null> {
  const token = getBearerToken();
  if (!token) return null;

  const params = new URLSearchParams();
  if (policyIncident != null && policyIncident.trim() !== '') {
    params.set('policy_incident', policyIncident.trim());
  }
  const qs = params.toString();
  const path = qs ? `/api/v1/bitacora/operator-meta?${qs}` : '/api/v1/bitacora/operator-meta';
  const url = apiUrl(path);

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as OperatorMetaPayload;
}
