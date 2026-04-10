/**
 * Temporary operator-only proof helpers: parse Pegasus **`/devices/{imei}`** and **`/user/resources`**
 * vehicle lists without logging raw payloads. Not used for access control.
 */

function userResourcesPath(): string {
  const raw = process.env.PEGASUS_USER_RESOURCES_PATH?.trim();
  if (!raw) return '/user/resources';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function devicePathPrefix(): string {
  const raw = process.env.PEGASUS_DEVICE_PATH_PREFIX?.trim();
  if (!raw) return 'devices';
  return raw.replace(/^\/+|\/+$/g, '');
}

function getFetchTimeoutMs(): number {
  const n = Number(process.env.PEGASUS_FETCH_TIMEOUT_MS ?? '10000');
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

export function extractVehicleIdFromDeviceBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const vehicle = root.vehicle;
  if (vehicle && typeof vehicle === 'object') {
    const id = (vehicle as Record<string, unknown>).id;
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
    if (typeof id === 'string' && id.trim() !== '') return id.trim();
  }
  return null;
}

export interface ResourcesVehiclesExtraction {
  /** All normalized string ids (for membership). */
  allIds: string[];
  /** Keys from the first object element under `vehicles`, for shape diagnosis. */
  sampleElementKeys: string[] | null;
}

/**
 * Reads **`vehicles`** from root or nested **`user`** (common Pegasus shapes).
 * Accepts primitives or objects with **`id`**, **`vehicle_id`**, **`vehicleId`**, **`vid`**.
 */
export function extractVehicleIdsFromUserResourcesBody(body: unknown): ResourcesVehiclesExtraction {
  if (!body || typeof body !== 'object') {
    return { allIds: [], sampleElementKeys: null };
  }
  const root = body as Record<string, unknown>;
  const user = root.user && typeof root.user === 'object' ? (root.user as Record<string, unknown>) : null;
  const vehiclesRaw = (user?.vehicles ?? root.vehicles) as unknown;
  if (!Array.isArray(vehiclesRaw)) {
    return { allIds: [], sampleElementKeys: null };
  }

  let sampleElementKeys: string[] | null = null;
  const ids: string[] = [];

  for (const item of vehiclesRaw) {
    if (sampleElementKeys === null && item && typeof item === 'object' && !Array.isArray(item)) {
      sampleElementKeys = Object.keys(item as Record<string, unknown>).slice(0, 12);
    }
    if (typeof item === 'number' && Number.isFinite(item)) {
      ids.push(String(item));
      continue;
    }
    if (typeof item === 'string' && item.trim() !== '') {
      ids.push(item.trim());
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const id = o.id ?? o.vehicle_id ?? o.vehicleId ?? o.vid;
      if (typeof id === 'number' && Number.isFinite(id)) {
        ids.push(String(id));
        continue;
      }
      if (typeof id === 'string' && id.trim() !== '') {
        ids.push(id.trim());
      }
    }
  }

  return { allIds: Array.from(new Set(ids)), sampleElementKeys };
}

export type JoinProofFetchErrorCode =
  | 'skipped'
  | 'site_unset'
  | 'network_or_timeout'
  | 'non_success_http'
  | 'json_parse_failed'
  | 'disabled';

export interface DeviceVehicleIdResult {
  vehicleId: string | null;
  httpStatus: number | null;
  errorCode: JoinProofFetchErrorCode | null;
}

export interface ResourcesVehiclesFetchResult {
  extraction: ResourcesVehiclesExtraction;
  httpStatus: number | null;
  errorCode: JoinProofFetchErrorCode | null;
}

export async function fetchPegasusDeviceVehicleId(
  siteBaseNoTrailingSlash: string,
  token: string,
  imei: string,
  timeoutMs: number = getFetchTimeoutMs(),
): Promise<DeviceVehicleIdResult> {
  const prefix = devicePathPrefix();
  const url = `${siteBaseNoTrailingSlash}/${prefix}/${encodeURIComponent(imei)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    clearTimeout(timer);
    const httpStatus = res.status;
    if (!res.ok || httpStatus < 200 || httpStatus >= 300) {
      return { vehicleId: null, httpStatus, errorCode: 'non_success_http' };
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { vehicleId: null, httpStatus, errorCode: 'json_parse_failed' };
    }
    return {
      vehicleId: extractVehicleIdFromDeviceBody(body),
      httpStatus,
      errorCode: null,
    };
  } catch {
    clearTimeout(timer);
    return { vehicleId: null, httpStatus: null, errorCode: 'network_or_timeout' };
  }
}

export async function fetchUserResourcesVehiclesForJoinProof(
  siteBaseNoTrailingSlash: string,
  token: string,
  timeoutMs: number = getFetchTimeoutMs(),
): Promise<ResourcesVehiclesFetchResult> {
  if (process.env.PEGASUS_USER_RESOURCES_DISABLED === 'true') {
    return {
      extraction: { allIds: [], sampleElementKeys: null },
      httpStatus: null,
      errorCode: 'disabled',
    };
  }
  const url = `${siteBaseNoTrailingSlash}${userResourcesPath()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    clearTimeout(timer);
    const httpStatus = res.status;
    if (!res.ok || httpStatus < 200 || httpStatus >= 300) {
      return {
        extraction: { allIds: [], sampleElementKeys: null },
        httpStatus,
        errorCode: 'non_success_http',
      };
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        extraction: { allIds: [], sampleElementKeys: null },
        httpStatus,
        errorCode: 'json_parse_failed',
      };
    }
    return {
      extraction: extractVehicleIdsFromUserResourcesBody(body),
      httpStatus,
      errorCode: null,
    };
  } catch {
    clearTimeout(timer);
    return {
      extraction: { allIds: [], sampleElementKeys: null },
      httpStatus: null,
      errorCode: 'network_or_timeout',
    };
  }
}

/** Membership: resolved Pegasus **`vehicle.id`** from device is in the set from **`/user/resources` vehicles**. */
export function evaluateVehicleMembership(
  deviceVehicleId: string | null,
  resourcesVehicleIds: string[],
): { evaluable: boolean; passes: boolean | null } {
  if (deviceVehicleId == null || deviceVehicleId === '') {
    return { evaluable: false, passes: null };
  }
  if (resourcesVehicleIds.length === 0) {
    return { evaluable: false, passes: null };
  }
  return { evaluable: true, passes: resourcesVehicleIds.includes(deviceVehicleId) };
}
