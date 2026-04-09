import type { BitacoraDocument } from './types.js';

export type TheftDatasetFormat = 'ndjson' | 'json-array';

export interface TheftDatasetRecord {
  /** 1-based index among successfully loaded structural-valid records. */
  recordIndex: number;
  /** Source line (NDJSON) or array index (JSON array). */
  sourceRef: string;
  doc: BitacoraDocument;
}

export interface TheftDatasetLoadError {
  sourceRef: string;
  error: string;
}

export interface TheftDatasetParseResult {
  ok: boolean;
  /** Set when the file cannot be interpreted at all (empty, invalid JSON array parse). */
  fatalError?: string;
  format?: TheftDatasetFormat;
  records: TheftDatasetRecord[];
  /** JSON parse failures or unsupported shape per row/element. */
  loadErrors: TheftDatasetLoadError[];
  /** NDJSON: blank lines only. */
  skippedEmptyLines: number;
  /** NDJSON: non-empty lines; JSON array: length of root array. */
  totalSourceItems: number;
}

/**
 * Structural checks before normalization. Does not enforce full spec typing.
 */
export function validateBitacoraDocumentShape(obj: unknown): { ok: true } | { ok: false; error: string } {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'root must be a JSON object' };
  }
  const o = obj as Record<string, unknown>;
  if (!('payload' in o) || o.payload == null || typeof o.payload !== 'object' || Array.isArray(o.payload)) {
    return { ok: false, error: 'missing or invalid payload' };
  }
  const p = o.payload as Record<string, unknown>;
  if (!('policy_incident' in p)) {
    return { ok: false, error: 'payload.policy_incident is required' };
  }
  const pi = p.policy_incident;
  if (pi === null || pi === undefined) {
    return { ok: false, error: 'payload.policy_incident is null or undefined' };
  }
  if (String(pi).trim() === '') {
    return { ok: false, error: 'payload.policy_incident is empty' };
  }
  return { ok: true };
}

function asDocument(obj: unknown): BitacoraDocument {
  return obj as BitacoraDocument;
}

function parseNdjsonLoose(content: string): Omit<TheftDatasetParseResult, 'fatalError' | 'ok'> {
  const lines = content.split(/\r?\n/);
  const records: TheftDatasetRecord[] = [];
  const loadErrors: TheftDatasetLoadError[] = [];
  let skippedEmptyLines = 0;
  let totalSourceItems = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();
    if (line === '') {
      skippedEmptyLines++;
      continue;
    }
    totalSourceItems++;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      loadErrors.push({ sourceRef: `NDJSON line ${lineNo}`, error: 'invalid JSON' });
      continue;
    }

    const shape = validateBitacoraDocumentShape(parsed);
    if (!shape.ok) {
      loadErrors.push({ sourceRef: `NDJSON line ${lineNo}`, error: shape.error });
      continue;
    }

    records.push({
      recordIndex: records.length + 1,
      sourceRef: `line ${lineNo}`,
      doc: asDocument(parsed),
    });
  }

  return {
    format: 'ndjson',
    records,
    loadErrors,
    skippedEmptyLines,
    totalSourceItems,
  };
}

function parseJsonArrayLoose(content: string): Omit<TheftDatasetParseResult, 'fatalError' | 'ok'> | { fatalError: string } {
  let root: unknown;
  try {
    root = JSON.parse(content);
  } catch (e) {
    return {
      fatalError: `invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!Array.isArray(root)) {
    return { fatalError: 'JSON root must be an array of objects' };
  }

  const records: TheftDatasetRecord[] = [];
  const loadErrors: TheftDatasetLoadError[] = [];

  const totalSourceItems = root.length;

  for (let i = 0; i < root.length; i++) {
    const el = root[i];
    const shape = validateBitacoraDocumentShape(el);
    if (!shape.ok) {
      loadErrors.push({ sourceRef: `array index ${i}`, error: shape.error });
      continue;
    }
    records.push({
      recordIndex: records.length + 1,
      sourceRef: `array index ${i}`,
      doc: asDocument(el),
    });
  }

  return {
    format: 'json-array',
    records,
    loadErrors,
    skippedEmptyLines: 0,
    totalSourceItems,
  };
}

/**
 * Load dataset from file contents.
 *
 * **Detection:** if the first non-whitespace character is `[`, parse as a single JSON **array**
 * (each element validated independently; bad elements are reported in `loadErrors`).
 * Otherwise parse as **NDJSON** (one object per non-empty line; bad lines reported in `loadErrors`).
 *
 * **Fatal** errors (`ok: false`): empty file, or JSON array cannot be parsed.
 */
export function parseTheftDatasetContent(content: string): TheftDatasetParseResult {
  const trimmed = content.trim();
  if (trimmed === '') {
    return {
      ok: false,
      fatalError: 'empty file',
      records: [],
      loadErrors: [],
      skippedEmptyLines: 0,
      totalSourceItems: 0,
    };
  }

  const firstNonWs = trimmed[0];
  if (firstNonWs === '[') {
    const out = parseJsonArrayLoose(content);
    if ('fatalError' in out && out.fatalError) {
      return {
        ok: false,
        fatalError: out.fatalError,
        records: [],
        loadErrors: [],
        skippedEmptyLines: 0,
        totalSourceItems: 0,
      };
    }
    const o = out as Omit<TheftDatasetParseResult, 'fatalError' | 'ok'>;
    return {
      ok: true,
      format: o.format,
      records: o.records,
      loadErrors: o.loadErrors,
      skippedEmptyLines: o.skippedEmptyLines,
      totalSourceItems: o.totalSourceItems,
    };
  }

  const o = parseNdjsonLoose(content);
  return {
    ok: true,
    format: o.format,
    records: o.records,
    loadErrors: o.loadErrors,
    skippedEmptyLines: o.skippedEmptyLines,
    totalSourceItems: o.totalSourceItems,
  };
}
