import type { Request, Response } from 'express';
import type { BitacoraService } from '../bitacora/bitacoraService.js';
import {
  evaluateVehicleMembership,
  fetchPegasusDeviceVehicleId,
  fetchUserResourcesVehiclesForJoinProof,
} from '../auth/pegasusOperatorJoinProof.js';
import { resolveCaseDeviceIdForJoinProof } from '../bitacora/resolveCaseDeviceId.js';
import { captureExceptionForObservability } from '../observability/sentryHooks.js';

const MAX_VEHICLE_IDS_IN_RESPONSE = 48;

/**
 * Operator-only JSON for validating **`device_id` → /devices → vehicle.id ∈ /user/resources.vehicles`**.
 * No tokens or raw Pegasus bodies in the response.
 */
export async function handleOperatorJoinProof(
  req: Request,
  res: Response,
  service: BitacoraService,
): Promise<void> {
  if (!req.pegasusIsOperator) {
    res.status(404).json({ error: 'not_found', message: 'Not found' });
    return;
  }

  const pegasusAuthMode = req.pegasusAuthMode ?? 'pegasus_http';

  if (pegasusAuthMode !== 'pegasus_http') {
    res.status(200).json({
      pegasusAuthMode,
      policyIncident: null,
      caseDeviceId: null,
      resolution: { source: 'none' as const, note: 'pegasus_http_required_for_join_proof' },
      deviceLookup: {
        attempted: false,
        imeiUsed: null,
        httpStatus: null,
        errorCode: 'skipped' as const,
        vehicleId: null,
      },
      resourcesVehicles: {
        attempted: false,
        httpStatus: null,
        errorCode: 'skipped' as const,
        vehicleIdCount: 0,
        vehicleIdsSample: [] as string[],
        vehicleIdsTruncated: false,
        sampleElementKeys: null as string[] | null,
      },
      membership: {
        evaluable: false,
        passes: null as boolean | null,
        rule: 'device_vehicle.id_in_user_resources_vehicles_ids',
      },
    });
    return;
  }

  const token = req.pegasusToken;
  const site = process.env.PEGASUS_SITE?.trim();
  if (!token || !site) {
    res.status(200).json({
      pegasusAuthMode,
      policyIncident: null,
      caseDeviceId: null,
      resolution: { source: 'none' as const, note: !site ? 'pegasus_site_unset' : 'missing_session' },
      deviceLookup: {
        attempted: false,
        imeiUsed: null,
        httpStatus: null,
        errorCode: 'skipped' as const,
        vehicleId: null,
      },
      resourcesVehicles: {
        attempted: false,
        httpStatus: null,
        errorCode: 'skipped' as const,
        vehicleIdCount: 0,
        vehicleIdsSample: [],
        vehicleIdsTruncated: false,
        sampleElementKeys: null,
      },
      membership: {
        evaluable: false,
        passes: null,
        rule: 'device_vehicle.id_in_user_resources_vehicles_ids',
      },
    });
    return;
  }

  try {
    const resolved = await resolveCaseDeviceIdForJoinProof(req, service);
    const base = site.replace(/\/$/, '');

    const devicePromise =
      resolved.deviceId != null
        ? fetchPegasusDeviceVehicleId(base, token, resolved.deviceId)
        : Promise.resolve({
            vehicleId: null as string | null,
            httpStatus: null as number | null,
            errorCode: 'skipped' as const,
          });

    const resourcesPromise = fetchUserResourcesVehiclesForJoinProof(base, token);

    const [deviceResult, resourcesResult] = await Promise.all([devicePromise, resourcesPromise]);

    const allResourceIds = resourcesResult.extraction.allIds;
    const membership = evaluateVehicleMembership(deviceResult.vehicleId, allResourceIds);

    const vehicleIdsSample = allResourceIds.slice(0, MAX_VEHICLE_IDS_IN_RESPONSE);
    const vehicleIdsTruncated = allResourceIds.length > vehicleIdsSample.length;

    res.status(200).json({
      pegasusAuthMode,
      policyIncident: resolved.policyIncident,
      caseDeviceId: resolved.deviceId,
      resolution: { source: resolved.source, note: resolved.note },
      deviceLookup: {
        attempted: resolved.deviceId != null,
        imeiUsed: resolved.deviceId,
        httpStatus: deviceResult.httpStatus,
        errorCode: deviceResult.errorCode,
        vehicleId: deviceResult.vehicleId,
      },
      resourcesVehicles: {
        attempted: true,
        httpStatus: resourcesResult.httpStatus,
        errorCode: resourcesResult.errorCode,
        vehicleIdCount: allResourceIds.length,
        vehicleIdsSample,
        vehicleIdsTruncated,
        sampleElementKeys: resourcesResult.extraction.sampleElementKeys,
      },
      membership: {
        evaluable: membership.evaluable,
        passes: membership.passes,
        rule: 'device_vehicle.id_in_user_resources_vehicles_ids',
      },
    });
  } catch (e) {
    captureExceptionForObservability(e, {
      requestId: req.requestId ?? 'unknown',
      route: 'bitacora/operator-join-proof',
    });
    res.status(500).json({ error: 'operator_join_proof_failed', message: 'Could not run join proof' });
  }
}
