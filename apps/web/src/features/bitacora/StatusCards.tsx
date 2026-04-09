import type { BitacoraDocument } from '@redesas-lite/shared';
import {
  isResultFailure,
  mapRegistrationStatusLabel,
  resultMessageOrFallback,
  trimOrEmpty,
} from '@redesas-lite/shared';

export function StatusCards({ doc }: { doc: BitacoraDocument }) {
  const failure = isResultFailure(doc);
  const statusOuter = doc.result?.status;
  const success = doc.result?.result?.success;
  const regStatus = doc.result?.result?.data?.status;
  const message = resultMessageOrFallback(doc);

  return (
    <div className={`cards ${failure ? 'cards--fail' : ''}`}>
      <article className="card">
        <h3>Estado de la operación</h3>
        <p className="card-value">{statusOuter ? trimOrEmpty(statusOuter) : '—'}</p>
      </article>
      <article className="card">
        <h3>Registro exitoso</h3>
        <p className="card-value">{success === undefined ? '—' : success ? 'Sí' : 'No'}</p>
      </article>
      <article className="card">
        <h3>Estado vehículo</h3>
        <p className="card-value">{mapRegistrationStatusLabel(regStatus)}</p>
      </article>
      <article className="card card--wide">
        <h3>Mensaje</h3>
        <p className="card-msg">{message}</p>
      </article>
    </div>
  );
}
