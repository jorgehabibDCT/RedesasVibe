import type { BitacoraCaseListItem } from '@redesas-lite/shared';

export interface CaseSwitcherProps {
  cases: BitacoraCaseListItem[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedPolicyIncident: string | undefined;
  onSelect: (policyIncident: string) => void;
}

function formatLabel(c: BitacoraCaseListItem): string {
  const plates = c.plates?.trim() || '—';
  const name = c.insured_name?.trim() || '—';
  return `${c.policy_incident} · ${plates} · ${name}`;
}

/**
 * Secondary toolbar to pick an imported case (db mode). Updates parent URL via `onSelect`.
 */
export function CaseSwitcher({
  cases,
  loading,
  search,
  onSearchChange,
  selectedPolicyIncident,
  onSelect,
}: CaseSwitcherProps) {
  return (
    <div className="case-switcher" aria-label="Selector de expediente">
      <div className="case-switcher__row">
        <label className="case-switcher__label" htmlFor="case-search">
          Buscar expediente
        </label>
        <input
          id="case-search"
          type="search"
          className="case-switcher__input"
          placeholder="Expediente, placas o asegurado"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="case-switcher__row case-switcher__row--select">
        <label className="case-switcher__label" htmlFor="case-select">
          Casos recientes
        </label>
        {loading ? (
          <p className="case-switcher__hint muted">Cargando lista…</p>
        ) : cases.length === 0 ? (
          <p className="case-switcher__hint muted">
            No hay expedientes en la lista. Pruebe otra búsqueda o confirme que existan casos
            cargados.
          </p>
        ) : (
          <select
            id="case-select"
            className="case-switcher__select"
            aria-label="Casos recientes"
            value={selectedPolicyIncident ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onSelect(v);
            }}
          >
            <option value="" disabled>
              Seleccionar expediente…
            </option>
            {selectedPolicyIncident &&
              !cases.some((c) => c.policy_incident === selectedPolicyIncident) && (
                <option value={selectedPolicyIncident}>
                  {selectedPolicyIncident} (vista actual)
                </option>
              )}
            {cases.map((c) => (
              <option key={c.policy_incident} value={c.policy_incident}>
                {formatLabel(c)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
