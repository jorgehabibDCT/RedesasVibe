/**
 * Spec §12 F: canonical payload has no coordinates — explicit empty state only.
 */
export function LatestPosition() {
  return (
    <div className="empty-state empty-state--inline" role="status">
      <p className="empty-state__lead">Sin datos de posición</p>
      <p className="muted small">
        La ubicación no está incluida en la respuesta actual. Cuando el sistema la proporcione, se
        mostrará aquí.
      </p>
    </div>
  );
}
