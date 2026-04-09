import type { BitacoraDocument } from '@redesas-lite/shared';
import {
  displayScalar,
  formatInsuredAmountMxn,
  formatPolicyDate,
  mapEnvLabel,
} from '@redesas-lite/shared';

export function HeaderSummary({ doc }: { doc: BitacoraDocument }) {
  const p = doc.payload;
  const envLabel = doc.env ? mapEnvLabel(doc.env) : '';

  return (
    <dl className="grid-dl">
      <dt>Incidente / expediente</dt>
      <dd>{displayScalar(p.policy_incident)}</dd>
      <dt>Póliza</dt>
      <dd>{displayScalar(p.policy_number)}</dd>
      <dt>Asegurado / contratante</dt>
      <dd>{displayScalar(p.insured_name)}</dd>
      <dt>Tipo de incidente</dt>
      <dd>{displayScalar(p.incident_type)}</dd>
      <dt>Vigencia (inicio)</dt>
      <dd>{formatPolicyDate(p.policy_start_date)}</dd>
      <dt>Vigencia (fin)</dt>
      <dd>{formatPolicyDate(p.policy_end_date)}</dd>
      <dt>Suma asegurada</dt>
      <dd>{formatInsuredAmountMxn(p.insured_amount)}</dd>
      <dt>Clave de agente</dt>
      <dd>{displayScalar(p.agent_code)}</dd>
      {envLabel ? (
        <>
          <dt>Entorno</dt>
          <dd>{envLabel}</dd>
        </>
      ) : null}
    </dl>
  );
}
