import type { OperatorMetaPayload } from '../../lib/api/fetchOperatorMeta.js';

export function OperatorObservability({ meta }: { meta: OperatorMetaPayload }) {
  return (
    <section className="section section--secondary operator-obs" aria-label="Información operativa">
      <h2 className="section__title-secondary">Detalle operativo (solo operadores)</h2>
      <dl className="grid-dl grid-dl--compact">
        <dt>Modo de datos</dt>
        <dd>{meta.bitacoraDataMode}</dd>
        <dt>Modo de autenticación</dt>
        <dd>{meta.pegasusAuthMode}</dd>
        <dt>Expediente (policy_incident)</dt>
        <dd>{meta.policyIncident ?? '—'}</dd>
        <dt>ID caso (DB)</dt>
        <dd>{meta.caseId ?? '—'}</dd>
        <dt>ID último ingest (raw)</dt>
        <dd>{meta.latestRawId ?? '—'}</dd>
        <dt>Última actualización (caso)</dt>
        <dd>{meta.caseUpdatedAt ?? '—'}</dd>
        <dt>Entorno (documento)</dt>
        <dd>{meta.documentEnv ?? '—'}</dd>
      </dl>
    </section>
  );
}
