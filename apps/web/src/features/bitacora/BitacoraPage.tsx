import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BitacoraCaseListItem, BitacoraDocument } from '@redesas-lite/shared';
import { BitacoraAuthError } from '../../lib/api/authErrors.js';
import { fetchBitacoraCasesList } from '../../lib/api/fetchBitacoraCasesList.js';
import { fetchBitacoraDocument } from '../../lib/api/fetchBitacora.js';
import { captureTokenFromUrlOnce, getBearerToken } from '../../lib/auth/memoryToken.js';
import { labelForAuthProblem, messageForUnknownError } from '../../lib/ui/errorPresentation.js';
import { CaseSwitcher } from './CaseSwitcher.js';
import { ConflictBanner } from './ConflictBanner.js';
import { ContactDirectory } from './ContactDirectory.js';
import { EmbedStandalone } from './EmbedStandalone.js';
import { HeaderSummary } from './HeaderSummary.js';
import { LatestPosition } from './LatestPosition.js';
import { ResultMetadata } from './ResultMetadata.js';
import { StatusCards } from './StatusCards.js';
import { VehicleDetails } from './VehicleDetails.js';

type Phase = 'loading' | 'missing_token' | 'ready' | 'error';

export function BitacoraPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const policyIncident = searchParams.get('policy_incident')?.trim() || undefined;

  const [doc, setDoc] = useState<BitacoraDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');

  const [cases, setCases] = useState<BitacoraCaseListItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [debouncedCaseSearch, setDebouncedCaseSearch] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedCaseSearch(caseSearch), 300);
    return () => window.clearTimeout(t);
  }, [caseSearch]);

  useEffect(() => {
    const token = getBearerToken() ?? captureTokenFromUrlOnce();
    if (!token) return;

    let cancelled = false;
    setCasesLoading(true);
    void fetchBitacoraCasesList({ search: debouncedCaseSearch || undefined, limit: 50 })
      .then((r) => {
        if (!cancelled) setCases(r.cases);
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      })
      .finally(() => {
        if (!cancelled) setCasesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCaseSearch]);

  useEffect(() => {
    const token = captureTokenFromUrlOnce();
    if (!token) {
      setPhase('missing_token');
      return;
    }

    let cancelled = false;
    setPhase('loading');
    setError(null);
    void (async () => {
      try {
        const data = await fetchBitacoraDocument(policyIncident);
        if (!cancelled) {
          setDoc(data);
          setPhase('ready');
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof BitacoraAuthError) {
          setError(labelForAuthProblem(e.problem) ?? e.message);
        } else {
          setError(messageForUnknownError(e));
        }
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [policyIncident]);

  const handleSelectCase = (pi: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('policy_incident', pi);
        return next;
      },
      { replace: true },
    );
  };

  if (phase === 'loading') {
    return (
      <div className="page">
        <p className="muted">Cargando información…</p>
      </div>
    );
  }

  if (phase === 'missing_token') {
    return <EmbedStandalone />;
  }

  if (phase === 'error' || !doc) {
    return (
      <div className="page">
        <div className="banner error" role="alert">
          <div className="banner__title">No se pudo cargar la información</div>
          <p className="banner__detail">{error ?? 'Intente de nuevo más tarde.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Bitácora de Siniestro REDESAS LITE</h1>
        <p className="muted">Resumen del incidente, póliza, vehículo y estado del registro.</p>
      </header>
      <CaseSwitcher
        cases={cases}
        loading={casesLoading}
        search={caseSearch}
        onSearchChange={setCaseSearch}
        selectedPolicyIncident={policyIncident ?? doc.payload.policy_incident}
        onSelect={handleSelectCase}
      />
      <ConflictBanner doc={doc} />
      <section className="section">
        <h2>Resumen</h2>
        <HeaderSummary doc={doc} />
      </section>
      <section className="section">
        <h2>Vehículo</h2>
        <VehicleDetails doc={doc} />
      </section>
      <section className="section">
        <h2>Estado del registro</h2>
        <StatusCards doc={doc} />
      </section>
      <section className="section">
        <h2>Contactos</h2>
        <ContactDirectory doc={doc} />
      </section>
      <section className="section section--secondary">
        <h2 className="section__title-secondary">Detalle del resultado</h2>
        <ResultMetadata doc={doc} />
      </section>
      <section className="section section--secondary section--deferred">
        <h2 className="section__title-secondary">Última posición</h2>
        <LatestPosition />
      </section>
    </div>
  );
}
