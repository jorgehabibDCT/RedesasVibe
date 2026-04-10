import { getBearerToken } from '../auth/memoryToken.js';
import { apiUrl } from './apiBaseUrl.js';

/** Operator-only **`GET /api/v1/bitacora/operator-join-proof`** (no enforcement). */
export interface OperatorJoinProofPayload {
  pegasusAuthMode: string;
  policyIncident: string | null;
  caseDeviceId: string | null;
  resolution: { source: string; note?: string };
  deviceLookup: {
    attempted: boolean;
    imeiUsed: string | null;
    httpStatus: number | null;
    errorCode: string | null;
    vehicleId: string | null;
  };
  resourcesVehicles: {
    attempted: boolean;
    httpStatus: number | null;
    errorCode: string | null;
    vehicleIdCount: number;
    vehicleIdsSample: string[];
    vehicleIdsTruncated: boolean;
    sampleElementKeys: string[] | null;
  };
  membership: {
    evaluable: boolean;
    passes: boolean | null;
    rule: string;
  };
}

export async function fetchOperatorJoinProof(
  policyIncident: string | undefined,
): Promise<OperatorJoinProofPayload | null> {
  const token = getBearerToken();
  if (!token) return null;

  const params = new URLSearchParams();
  if (policyIncident != null && policyIncident.trim() !== '') {
    params.set('policy_incident', policyIncident.trim());
  }
  const qs = params.toString();
  const path = qs ? `/api/v1/bitacora/operator-join-proof?${qs}` : '/api/v1/bitacora/operator-join-proof';
  const res = await fetch(apiUrl(path), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as OperatorJoinProofPayload;
}
