import { accessSync, constants } from 'node:fs';
import { getBitacoraDataMode } from '../config/bitacoraDataMode.js';
import { getCanonicalFixturePath } from '../config/fixturePath.js';

export type ReadinessOverallStatus = 'ready' | 'not_ready';

export type CheckStatus = 'ok' | 'error';

export interface ReadinessPayload {
  status: ReadinessOverallStatus;
  service: 'redesas-lite-bff';
  checks: {
    process: { status: CheckStatus };
    pegasusAuth: {
      status: CheckStatus;
      mode: 'bypass' | 'pegasus_http';
      reason?: 'pegasus_site_unset';
    };
    bitacoraData: {
      status: CheckStatus;
      mode: 'fixture' | 'integration' | 'db';
      reason?: 'fixture_unreadable' | 'upstream_base_url_unset' | 'database_url_unset';
    };
  };
}

function checkProcess(): ReadinessPayload['checks']['process'] {
  return { status: 'ok' };
}

function checkPegasusAuth(): ReadinessPayload['checks']['pegasusAuth'] {
  const bypass = process.env.PEGASUS_AUTH_DISABLED === 'true';
  if (bypass) {
    return { status: 'ok', mode: 'bypass' };
  }
  const site = process.env.PEGASUS_SITE?.trim();
  if (!site) {
    return { status: 'error', mode: 'pegasus_http', reason: 'pegasus_site_unset' };
  }
  return { status: 'ok', mode: 'pegasus_http' };
}

function checkBitacoraData(): ReadinessPayload['checks']['bitacoraData'] {
  const mode = getBitacoraDataMode();
  if (mode === 'integration') {
    const base = process.env.BITACORA_UPSTREAM_BASE_URL?.trim();
    if (!base) {
      return {
        status: 'error',
        mode: 'integration',
        reason: 'upstream_base_url_unset',
      };
    }
    return { status: 'ok', mode: 'integration' };
  }

  if (mode === 'db') {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      return { status: 'error', mode: 'db', reason: 'database_url_unset' };
    }
    return { status: 'ok', mode: 'db' };
  }

  const fixturePath = getCanonicalFixturePath();
  try {
    accessSync(fixturePath, constants.R_OK);
    return { status: 'ok', mode: 'fixture' };
  } catch {
    return { status: 'error', mode: 'fixture', reason: 'fixture_unreadable' };
  }
}

export function computeReadiness(): ReadinessPayload {
  const processCheck = checkProcess();
  const pegasusAuth = checkPegasusAuth();
  const bitacoraData = checkBitacoraData();

  const allOk =
    processCheck.status === 'ok' &&
    pegasusAuth.status === 'ok' &&
    bitacoraData.status === 'ok';

  return {
    status: allOk ? 'ready' : 'not_ready',
    service: 'redesas-lite-bff',
    checks: {
      process: processCheck,
      pegasusAuth,
      bitacoraData,
    },
  };
}
