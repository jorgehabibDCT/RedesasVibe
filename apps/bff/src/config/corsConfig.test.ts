import { afterEach, describe, expect, it } from 'vitest';
import { createCorsOptions, parseCorsOrigins } from './corsConfig.js';

describe('parseCorsOrigins', () => {
  const savedCors = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (savedCors === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = savedCors;
  });

  it('defaults when CORS_ORIGINS unset', () => {
    delete process.env.CORS_ORIGINS;
    expect(parseCorsOrigins()).toEqual(['http://localhost:5173']);
  });

  it('returns empty array when explicitly empty', () => {
    process.env.CORS_ORIGINS = '';
    expect(parseCorsOrigins()).toEqual([]);
  });

  it('splits comma-separated origins', () => {
    process.env.CORS_ORIGINS = 'https://a.com, https://b.com';
    expect(parseCorsOrigins()).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('createCorsOptions', () => {
  const savedCors = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (savedCors === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = savedCors;
  });

  it('allows no Origin (non-browser)', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    const { origin } = createCorsOptions();
    if (typeof origin !== 'function') throw new Error('expected CustomOrigin');
    const result = await new Promise<boolean>((resolve, reject) => {
      origin(undefined, (err: Error | null, allow?: boolean) => {
        if (err) reject(err);
        else resolve(allow as boolean);
      });
    });
    expect(result).toBe(true);
  });

  it('rejects browser Origin when allowlist is empty', async () => {
    process.env.CORS_ORIGINS = '';
    const { origin } = createCorsOptions();
    if (typeof origin !== 'function') throw new Error('expected CustomOrigin');
    await expect(
      new Promise((resolve, reject) => {
        origin('http://evil.com', (err: Error | null, allow?: boolean) => {
          if (err) reject(err);
          else resolve(allow);
        });
      }),
    ).rejects.toThrow(/CORS/);
  });
});
