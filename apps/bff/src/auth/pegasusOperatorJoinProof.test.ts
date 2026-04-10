import { describe, expect, it } from 'vitest';
import {
  evaluateVehicleMembership,
  extractVehicleIdFromDeviceBody,
  extractVehicleIdsFromUserResourcesBody,
} from './pegasusOperatorJoinProof.js';

describe('extractVehicleIdFromDeviceBody', () => {
  it('reads vehicle.id as number or string', () => {
    expect(extractVehicleIdFromDeviceBody({ vehicle: { id: 42 } })).toBe('42');
    expect(extractVehicleIdFromDeviceBody({ vehicle: { id: ' 99 ' } })).toBe('99');
  });

  it('returns null when missing', () => {
    expect(extractVehicleIdFromDeviceBody({})).toBeNull();
    expect(extractVehicleIdFromDeviceBody({ vehicle: {} })).toBeNull();
  });
});

describe('extractVehicleIdsFromUserResourcesBody', () => {
  it('reads root vehicles array', () => {
    const { allIds, sampleElementKeys } = extractVehicleIdsFromUserResourcesBody({
      vehicles: [{ id: 1 }, { id: 2 }],
    });
    expect(allIds).toEqual(['1', '2']);
    expect(sampleElementKeys).toContain('id');
  });

  it('reads nested user.vehicles and alternate keys', () => {
    const { allIds } = extractVehicleIdsFromUserResourcesBody({
      user: { vehicles: [{ vehicle_id: 'a' }, { vid: 7 }] },
    });
    expect(allIds).toEqual(['a', '7']);
  });

  it('dedupes', () => {
    const { allIds } = extractVehicleIdsFromUserResourcesBody({
      vehicles: [{ id: 1 }, { id: 1 }],
    });
    expect(allIds).toEqual(['1']);
  });
});

describe('evaluateVehicleMembership', () => {
  it('passes when device vehicle id is in resources set', () => {
    expect(evaluateVehicleMembership('10', ['9', '10', '11'])).toEqual({
      evaluable: true,
      passes: true,
    });
  });

  it('not evaluable without device id or empty resources', () => {
    expect(evaluateVehicleMembership(null, ['1'])).toEqual({ evaluable: false, passes: null });
    expect(evaluateVehicleMembership('1', [])).toEqual({ evaluable: false, passes: null });
  });
});
