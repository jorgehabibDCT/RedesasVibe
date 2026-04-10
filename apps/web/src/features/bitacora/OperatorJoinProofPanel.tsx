import { useEffect, useState } from 'react';
import {
  fetchOperatorJoinProof,
  type OperatorJoinProofPayload,
} from '../../lib/api/fetchOperatorJoinProof.js';

function formatErrorCode(code: string | null): string {
  if (code == null) return '—';
  if (code === 'skipped') return 'omitido';
  if (code === 'non_success_http') return 'HTTP no exitoso';
  if (code === 'network_or_timeout') return 'red / tiempo agotado';
  if (code === 'json_parse_failed') return 'JSON inválido';
  if (code === 'disabled') return 'PEGASUS_USER_RESOURCES_DISABLED';
  return code;
}

export function OperatorJoinProofPanel({ policyIncident }: { policyIncident: string | null }) {
  const [data, setData] = useState<OperatorJoinProofPayload | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    void fetchOperatorJoinProof(policyIncident ?? undefined).then((payload) => {
      if (cancelled) return;
      if (payload) {
        setData(payload);
        setPhase('ready');
      } else {
        setData(null);
        setPhase('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [policyIncident]);

  if (phase === 'loading') {
    return (
      <p className="muted operator-join-proof__status" aria-live="polite">
        Comprobando enlace dispositivo / recursos…
      </p>
    );
  }

  if (phase === 'error' || !data) {
    return (
      <p className="muted operator-join-proof__status" role="status">
        Prueba de enlace no disponible (sesión u operador).
      </p>
    );
  }

  const passLabel =
    data.membership.passes === true ? 'Sí' : data.membership.passes === false ? 'No' : '—';
  const evalLabel = data.membership.evaluable ? 'Sí' : 'No';

  return (
    <div className="operator-join-proof">
      <h3 className="operator-obs__subhead">Prueba de enlace (dispositivo → vehículo → recursos)</h3>
      <p className="muted operator-join-proof__hint">
        Solo diagnóstico; no afecta el acceso al expediente.
      </p>
      <dl className="grid-dl grid-dl--compact">
        <dt>IMEI / device_id (caso)</dt>
        <dd>{data.caseDeviceId ?? '—'}</dd>
        <dt>vehicle.id (GET /devices/…)</dt>
        <dd>{data.deviceLookup.vehicleId ?? '—'}</dd>
        <dt>HTTP dispositivo</dt>
        <dd>{data.deviceLookup.httpStatus ?? '—'}</dd>
        <dt>Error dispositivo</dt>
        <dd>{formatErrorCode(data.deviceLookup.errorCode)}</dd>
        <dt>Vehículos en /user/resources</dt>
        <dd>{data.resourcesVehicles.vehicleIdCount}</dd>
        <dt>Claves (1.er elemento)</dt>
        <dd>
          {data.resourcesVehicles.sampleElementKeys?.length
            ? data.resourcesVehicles.sampleElementKeys.join(', ')
            : '—'}
        </dd>
        <dt>IDs muestra</dt>
        <dd className="operator-join-proof__mono">
          {data.resourcesVehicles.vehicleIdsSample.length > 0
            ? data.resourcesVehicles.vehicleIdsSample.join(', ') +
              (data.resourcesVehicles.vehicleIdsTruncated ? ' …' : '')
            : '—'}
        </dd>
        <dt>HTTP recursos</dt>
        <dd>{data.resourcesVehicles.httpStatus ?? '—'}</dd>
        <dt>Error recursos</dt>
        <dd>{formatErrorCode(data.resourcesVehicles.errorCode)}</dd>
        <dt>¿Comparable?</dt>
        <dd>{evalLabel}</dd>
        <dt>¿Pasa membresía?</dt>
        <dd>{passLabel}</dd>
        <dt>Regla</dt>
        <dd className="operator-join-proof__mono">{data.membership.rule}</dd>
      </dl>
      {data.resolution.note ? (
        <p className="muted operator-join-proof__note">Nota: {data.resolution.note}</p>
      ) : null}
    </div>
  );
}
