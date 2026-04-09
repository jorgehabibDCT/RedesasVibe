import { describe, expect, it } from 'vitest';
import { joinApiUrl } from './apiBaseUrl.js';

describe('joinApiUrl', () => {
  it('uses relative path when base is empty', () => {
    expect(joinApiUrl('', '/api/v1/bitacora')).toBe('/api/v1/bitacora');
  });

  it('strips trailing slash from base', () => {
    expect(joinApiUrl('https://bff.example.com/', '/api/v1/bitacora')).toBe(
      'https://bff.example.com/api/v1/bitacora',
    );
  });

  it('prefixes path without leading slash', () => {
    expect(joinApiUrl('https://bff.example.com', 'api/v1/bitacora')).toBe(
      'https://bff.example.com/api/v1/bitacora',
    );
  });
});
