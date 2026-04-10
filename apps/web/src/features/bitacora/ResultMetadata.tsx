import type { BitacoraDocument } from '@redesas-lite/shared';
import {
  formatBitacoraResultStatusLabel,
  mapEnvLabel,
  resultMessageOrFallback,
} from '@redesas-lite/shared';

export function ResultMetadata({ doc }: { doc: BitacoraDocument }) {
  const success = doc.result?.result?.success;
  const msg = resultMessageOrFallback(doc);
  const outer = doc.result?.status;
  const envRaw = doc.env ? mapEnvLabel(doc.env) : '';
  const envDisplay = envRaw === '' ? '—' : envRaw;

  return (
    <dl className="grid-dl grid-dl--compact">
      <dt>Mensaje del sistema</dt>
      <dd>{msg}</dd>
      <dt>Resultado en sistema</dt>
      <dd>{success === undefined ? '—' : success ? 'Sí' : 'No'}</dd>
      <dt>Estado general</dt>
      <dd>{formatBitacoraResultStatusLabel(outer)}</dd>
      <dt>Entorno</dt>
      <dd>{envDisplay}</dd>
    </dl>
  );
}
