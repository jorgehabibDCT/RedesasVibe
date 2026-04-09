import type { BitacoraDocument } from '@redesas-lite/shared';
import { hasVinPlatesConflict } from '@redesas-lite/shared';

export function ConflictBanner({ doc }: { doc: BitacoraDocument }) {
  if (!hasVinPlatesConflict(doc)) return null;
  return (
    <div className="banner warn" role="status">
      Hay diferencias entre el VIN o las placas enviadas y lo registrado en el sistema. Se muestra
      el valor registrado en el sistema.
    </div>
  );
}
