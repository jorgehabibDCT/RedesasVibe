import type { BitacoraDocument } from '@redesas-lite/shared';
import {
  displayColorOrUnspecified,
  resolveDeviceIdDisplay,
  resolvePlatesResolution,
  resolveVinResolution,
  trimVehicleMakeModel,
} from '@redesas-lite/shared';

function formatModelYear(year: number | null | undefined): string {
  if (year == null || year === 0 || !Number.isFinite(Number(year))) return '—';
  return String(year);
}

export function VehicleDetails({ doc }: { doc: BitacoraDocument }) {
  const { make, model } = trimVehicleMakeModel(doc.payload);
  const vin = resolveVinResolution(doc);
  const plates = resolvePlatesResolution(doc);
  const deviceId = resolveDeviceIdDisplay(doc);

  return (
    <dl className="grid-dl">
      <dt>ID dispositivo</dt>
      <dd>{deviceId}</dd>
      <dt>VIN</dt>
      <dd>{vin.display}</dd>
      <dt>Año modelo</dt>
      <dd>{formatModelYear(doc.payload.vehicle_year)}</dd>
      <dt>Placas</dt>
      <dd>{plates.display}</dd>
      <dt>Marca</dt>
      <dd>{make || '—'}</dd>
      <dt>Modelo</dt>
      <dd>{model || '—'}</dd>
      <dt>Color</dt>
      <dd>{displayColorOrUnspecified(doc.payload.vehicle_color)}</dd>
    </dl>
  );
}
