import { afterEach, describe, expect, it } from 'vitest';
import { isOperatorPrincipal } from './operatorGateConfig.js';

describe('operatorGateConfig', () => {
  const origU = process.env.PEGASUS_OPERATOR_USER_IDS;
  const origG = process.env.PEGASUS_OPERATOR_GROUP_IDS;

  afterEach(() => {
    if (origU === undefined) delete process.env.PEGASUS_OPERATOR_USER_IDS;
    else process.env.PEGASUS_OPERATOR_USER_IDS = origU;
    if (origG === undefined) delete process.env.PEGASUS_OPERATOR_GROUP_IDS;
    else process.env.PEGASUS_OPERATOR_GROUP_IDS = origG;
  });

  it('returns false when env lists are empty and no staff resources', () => {
    delete process.env.PEGASUS_OPERATOR_USER_IDS;
    delete process.env.PEGASUS_OPERATOR_GROUP_IDS;
    expect(isOperatorPrincipal({ userId: 'u1', groupIds: [] }, 'pegasus_http')).toBe(false);
    expect(
      isOperatorPrincipal(
        { userId: 'u1', groupIds: [], resources: { isStaff: false, isSuperuser: false } },
        'pegasus_http',
      ),
    ).toBe(false);
  });

  it('returns true when is_staff from resources (env lists empty)', () => {
    delete process.env.PEGASUS_OPERATOR_USER_IDS;
    delete process.env.PEGASUS_OPERATOR_GROUP_IDS;
    expect(
      isOperatorPrincipal(
        { userId: 'u1', groupIds: [], resources: { isStaff: true, isSuperuser: false } },
        'pegasus_http',
      ),
    ).toBe(true);
  });

  it('returns true when is_superuser from resources (env lists empty)', () => {
    delete process.env.PEGASUS_OPERATOR_USER_IDS;
    delete process.env.PEGASUS_OPERATOR_GROUP_IDS;
    expect(
      isOperatorPrincipal(
        { userId: 'u1', groupIds: [], resources: { isStaff: false, isSuperuser: true } },
        'pegasus_http',
      ),
    ).toBe(true);
  });

  it('matches operator user id', () => {
    process.env.PEGASUS_OPERATOR_USER_IDS = 'a,b';
    expect(isOperatorPrincipal({ userId: 'b', groupIds: [] }, 'pegasus_http')).toBe(true);
    expect(isOperatorPrincipal({ userId: 'x', groupIds: [] }, 'pegasus_http')).toBe(false);
  });

  it('rejects machine_ingest and bypass', () => {
    process.env.PEGASUS_OPERATOR_USER_IDS = 'm';
    expect(isOperatorPrincipal({ userId: 'm', groupIds: [] }, 'machine_ingest')).toBe(false);
    expect(isOperatorPrincipal(undefined, 'bypass')).toBe(false);
  });
});
