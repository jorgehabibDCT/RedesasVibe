import type { BitacoraDocument } from '@redesas-lite/shared';
import { buildContactRows } from '@redesas-lite/shared';

export function ContactDirectory({ doc }: { doc: BitacoraDocument }) {
  const rows = buildContactRows(doc);
  if (rows.length === 0) {
    return (
      <div className="empty-state empty-state--inline" role="status">
        <p className="empty-state__lead">Sin contactos</p>
        <p className="muted small">No hay contactos disponibles para este incidente.</p>
      </div>
    );
  }
  return (
    <ul className="contact-list">
      {rows.map((row) => (
        <li key={`${row.role}-${row.name}`} className="contact-card">
          <div className="contact-role">{row.role}</div>
          <div className="contact-name">{row.name}</div>
          {row.phone ? <div className="contact-phone">{row.phone}</div> : null}
        </li>
      ))}
    </ul>
  );
}
