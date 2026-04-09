import { createHash } from 'node:crypto';
import type { PegasusValidateResult } from './pegasusAuth.types.js';

/**
 * SHA-256 cache key — never log this value as a "token"; it is safe to correlate cache behavior in tests.
 */
export function hashTokenForCacheKey(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isPegasusCacheEnabled(): boolean {
  if (process.env.PEGASUS_AUTH_DISABLED === 'true') return false;
  const raw = process.env.PEGASUS_AUTH_CACHE_ENABLED?.trim().toLowerCase();
  if (raw === 'false') return false;
  return true;
}

export function getPegasusCacheTtlMs(): number {
  const n = Number(process.env.PEGASUS_AUTH_CACHE_TTL_MS ?? '300000');
  return Number.isFinite(n) && n > 0 ? n : 300_000;
}

/** TTL for failed validation responses (4xx) cached to reduce Pegasus load. */
export function getPegasusCacheNegativeTtlMs(): number {
  const raw = process.env.PEGASUS_AUTH_CACHE_NEGATIVE_TTL_MS?.trim();
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fallback = Math.min(60_000, getPegasusCacheTtlMs());
  return fallback > 0 ? fallback : 60_000;
}

/** Short TTL when Pegasus is unreachable (transient); keep low to recover quickly. */
export function getPegasusCacheUnavailableTtlMs(): number {
  const raw = process.env.PEGASUS_AUTH_CACHE_UNAVAILABLE_TTL_MS?.trim();
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 5000;
}

export function getPegasusCacheMaxEntries(): number {
  const n = Number(process.env.PEGASUS_AUTH_CACHE_MAX_ENTRIES ?? '5000');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5000;
}

/**
 * Bounded LRU-ish cache: Map iteration order = insertion; get() refreshes position.
 */
export class PegasusAuthCache {
  private readonly max: number;
  private readonly store = new Map<string, { value: PegasusValidateResult; expires: number }>();

  constructor(maxEntries: number) {
    this.max = maxEntries;
  }

  get(key: string): PegasusValidateResult | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: PegasusValidateResult, ttlMs: number): void {
    while (this.store.size >= this.max) {
      const first = this.store.keys().next().value as string | undefined;
      if (first === undefined) break;
      this.store.delete(first);
    }
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

let singleton: PegasusAuthCache | null = null;

export function getPegasusAuthCache(): PegasusAuthCache {
  if (!singleton) {
    singleton = new PegasusAuthCache(getPegasusCacheMaxEntries());
  }
  return singleton;
}

/** Vitest / integration tests only — resets singleton + entries. */
export function resetPegasusAuthCacheForTests(): void {
  singleton?.clear();
  singleton = null;
}
