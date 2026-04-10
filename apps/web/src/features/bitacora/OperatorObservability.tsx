import type { OperatorMetaPayload } from '../../lib/api/fetchOperatorMeta.js';
import { OperatorJoinProofPanel } from './OperatorJoinProofPanel.js';

function yn(v: boolean): string {
  return v ? 'Sí' : 'No';
}

export function OperatorObservability({ meta }: { meta: OperatorMetaPayload }) {
  const id = meta.pegasusIdentity ?? { loginUserId: null, resources: null };
  const res = id.resources;

  return (
    <section className="section section--secondary operator-obs" aria-label="Información operativa">
      <h2 className="section__title-secondary">Detalle operativo (solo operadores)</h2>
      <h3 className="operator-obs__subhead">Entorno y expediente</h3>
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
      <h3 className="operator-obs__subhead">Identidad Pegasus</h3>
      <dl className="grid-dl grid-dl--compact">
        <dt>Usuario (login)</dt>
        <dd>{id.loginUserId ?? '—'}</dd>
        <dt>Perfil /user/resources</dt>
        <dd>{res ? 'Disponible' : 'No disponible'}</dd>
        {res ? (
          <>
            <dt>ID (recursos)</dt>
            <dd>{res.id ?? '—'}</dd>
            <dt>Usuario</dt>
            <dd>{res.username ?? '—'}</dd>
            <dt>Correo</dt>
            <dd>{res.email ?? '—'}</dd>
            <dt>Staff</dt>
            <dd>{yn(res.isStaff)}</dd>
            <dt>Superusuario</dt>
            <dd>{yn(res.isSuperuser)}</dd>
          </>
        ) : null}
      </dl>
      <OperatorJoinProofPanel policyIncident={meta.policyIncident} />
    </section>
  );
}
