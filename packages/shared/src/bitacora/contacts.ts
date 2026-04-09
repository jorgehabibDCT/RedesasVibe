import type { BitacoraDocument, EmergencyContact } from './types.js';
import { digitsOnly, trimOrEmpty } from './normalize.js';
import { isRegistrationSuccess } from './resolve.js';

export interface ContactRow {
  /** UI role label */
  role: string;
  name: string;
  phone?: string;
}

function contactsEqual(a: EmergencyContact, b: EmergencyContact): boolean {
  const nameA = trimOrEmpty(a.name).toLowerCase();
  const nameB = trimOrEmpty(b.name).toLowerCase();
  const phoneA = digitsOnly(a.phone);
  const phoneB = digitsOnly(b.phone);
  return nameA === nameB && phoneA === phoneB && phoneA.length > 0;
}

/**
 * Build contact rows per spec §11: dedupe reporter + emergency when same name+phone;
 * if emergency missing from registration data, use reporter as emergency source (may merge).
 */
export function buildContactRows(doc: BitacoraDocument): ContactRow[] {
  const rows: ContactRow[] = [];
  const reporterName = trimOrEmpty(doc.payload.reporter_name);
  const reporterPhone = trimOrEmpty(doc.payload.reporter_phone);
  const driverName = trimOrEmpty(doc.payload.driver_name);

  const reporter: EmergencyContact | null =
    reporterName || reporterPhone
      ? { name: reporterName || '—', phone: reporterPhone }
      : null;

  let emergency: EmergencyContact | null = null;
  const data = doc.result?.result?.data;

  if (isRegistrationSuccess(doc) && data?.emergency_contact) {
    emergency = {
      name: trimOrEmpty(data.emergency_contact.name),
      phone: trimOrEmpty(data.emergency_contact.phone),
    };
  } else if (reporter) {
    emergency = { ...reporter };
  }

  if (reporter && emergency && contactsEqual(reporter, emergency)) {
    rows.push({
      role: 'Reporter / contacto de emergencia',
      name: reporter.name,
      phone: reporter.phone || undefined,
    });
  } else {
    if (reporter) {
      rows.push({
        role: 'Reportante',
        name: reporter.name,
        phone: reporter.phone || undefined,
      });
    }
    if (emergency && (!reporter || !contactsEqual(reporter, emergency))) {
      rows.push({
        role: 'Contacto de emergencia',
        name: emergency.name,
        phone: emergency.phone || undefined,
      });
    }
  }

  if (!reporter && !emergency) {
    rows.push({
      role: 'Contacto de emergencia',
      name: 'Sin contacto de emergencia',
    });
  }

  if (driverName) {
    rows.push({
      role: 'Conductor',
      name: driverName,
    });
  }

  return rows;
}
