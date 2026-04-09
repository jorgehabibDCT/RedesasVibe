import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BitacoraDocument } from '@redesas-lite/shared';
import { clearMemoryToken, setMemoryTokenForTests } from '../../lib/auth/memoryToken.js';
import { BitacoraPage } from './BitacoraPage.js';

const basePayload = {
  device_id: 1,
  vehicle_vin: 'V',
  vehicle_year: 2026,
  vehicle_plates: 'P',
  vehicle_make: 'M',
  vehicle_model: 'M',
  vehicle_color: 'N/A',
  insured_name: 'I',
  incident_type: 'Otro',
  reporter_name: 'R',
  reporter_phone: '1',
  driver_name: 'D',
  policy_number: 'P',
  policy_incident: 'PI',
  policy_start_date: '01/01/2026',
  policy_end_date: '01/01/2027',
  insured_amount: 100,
  agent_code: 'A',
};

function docFor(pi: string): BitacoraDocument {
  return {
    payload: { ...basePayload, policy_incident: pi },
    env: 'staging',
  };
}

function renderPage(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BitacoraPage />
    </MemoryRouter>,
  );
}

describe('BitacoraPage', () => {
  beforeEach(() => {
    clearMemoryToken();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearMemoryToken();
  });

  it('renders standalone message when no token', async () => {
    renderPage('/');
    await waitFor(() => {
      expect(screen.getByText(/Sin ese token no hay datos que mostrar/)).toBeInTheDocument();
    });
  });

  it('renders summary from fixture response when token present', async () => {
    setMemoryTokenForTests('test-token');
    const minimalDoc = docFor('PI');
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/bitacora/cases')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ cases: [] }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(minimalDoc),
      } as Response);
    });

    renderPage('/');

    await waitFor(() => {
      expect(screen.getByText('PI')).toBeInTheDocument();
    });

    expect(screen.getByText(/Bitácora de Siniestro REDESAS LITE/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin datos de posición/i)).toBeInTheDocument();
  });

  it('selecting another case updates URL and refetches with policy_incident', async () => {
    setMemoryTokenForTests('test-token');
    // Distinct agent_code so getByText('A'|'B') is not ambiguous with policy_incident.
    const docA = { ...docFor('A'), payload: { ...docFor('A').payload, agent_code: 'AG1' } };
    const docB = { ...docFor('B'), payload: { ...docFor('B').payload, agent_code: 'AG2' } };

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/bitacora/cases')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              cases: [
                {
                  policy_incident: 'A',
                  plates: 'PA',
                  insured_name: 'IA',
                  updated_at: '2026-01-01T00:00:00.000Z',
                },
                {
                  policy_incident: 'B',
                  plates: 'PB',
                  insured_name: 'IB',
                  updated_at: '2026-01-02T00:00:00.000Z',
                },
              ],
            }),
        } as Response);
      }
      if (url.includes('policy_incident=B')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(docB),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(docA),
      } as Response);
    });

    renderPage('/?policy_incident=A');

    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox', { name: /Casos recientes/i });
    fireEvent.change(select, { target: { value: 'B' } });

    await waitFor(() => {
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    const bitacoraCalls = vi.mocked(fetch).mock.calls.filter((c) => {
      const url = typeof c[0] === 'string' ? c[0] : (c[0] as Request).url;
      return url.includes('/api/v1/bitacora') && !url.includes('cases');
    });
    const lastBitacora = bitacoraCalls[bitacoraCalls.length - 1][0] as string;
    expect(lastBitacora).toContain('policy_incident=B');
  });
});
