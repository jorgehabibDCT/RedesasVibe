import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPegasusAuthCacheForTests } from '../auth/pegasusAuthCache.js';
import { createServer } from '../server.js';

function stubPegasusLoginThenResources(
  loginJson: unknown,
  resourcesJson: Record<string, unknown> = { is_staff: false, is_superuser: false },
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : String(input);
      if (u.includes('/user/resources')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: async () => resourcesJson,
        });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        headers: new Headers(),
        clone() {
          return this;
        },
        json: async () => loginJson,
      });
    }),
  );
}

describe('GET /api/v1/bitacora/operator-join-proof', () => {
  const originalEnv = { ...process.env };
  const app = createServer();

  beforeEach(() => {
    resetPegasusAuthCacheForTests();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.BITACORA_DATA_MODE = 'fixture';
    process.env.PEGASUS_AUTH_DISABLED = 'false';
    process.env.PEGASUS_SITE = 'https://pegasus.example.com';
    process.env.PEGASUS_OPERATOR_USER_IDS = 'u-op';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns 404 for non-operators', async () => {
    process.env.PEGASUS_OPERATOR_USER_IDS = 'other';
    stubPegasusLoginThenResources({ user_id: 'u-normal' });

    const res = await request(app)
      .get('/api/v1/bitacora/operator-join-proof')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(404);
  });

  it('returns join summary for operator with membership pass', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const u = typeof input === 'string' ? input : String(input);
        if (u.includes('/api/login')) {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers(),
            clone() {
              return this;
            },
            json: async () => ({ user_id: 'u-op' }),
          });
        }
        if (u.includes('/user/resources')) {
          return Promise.resolve({
            status: 200,
            ok: true,
            json: async () => ({
              is_staff: false,
              is_superuser: false,
              vehicles: [{ id: 100 }, { id: 200 }],
            }),
          });
        }
        if (u.includes('/devices/472568141300009')) {
          return Promise.resolve({
            status: 200,
            ok: true,
            json: async () => ({ vehicle: { id: 100 } }),
          });
        }
        throw new Error(`unexpected fetch: ${u}`);
      }),
    );

    const res = await request(app)
      .get('/api/v1/bitacora/operator-join-proof')
      .set('Authorization', 'Bearer op');

    expect(res.status).toBe(200);
    expect(res.body.membership).toEqual({
      evaluable: true,
      passes: true,
      rule: 'device_vehicle.id_in_user_resources_vehicles_ids',
    });
    expect(res.body.deviceLookup.vehicleId).toBe('100');
    expect(res.body.resourcesVehicles.vehicleIdCount).toBe(2);
    expect(res.body.caseDeviceId).toBe('472568141300009');
    expect(res.body.policyIncident).toBe('0501227');
  });
});
