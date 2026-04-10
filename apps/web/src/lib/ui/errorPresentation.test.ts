import { describe, expect, it } from 'vitest';
import { BitacoraAuthError } from '../api/authErrors.js';
import { labelForAuthProblem, messageForUnknownError } from './errorPresentation.js';

describe('errorPresentation', () => {
  it('maps known auth problems to Spanish copy', () => {
    expect(labelForAuthProblem('token_expired')).toMatch(/expiró/);
    expect(labelForAuthProblem('unknown_code')).toBeNull();
  });

  it('maps fetch failure codes to user copy', () => {
    expect(messageForUnknownError(new Error('bitacora_fetch_failed:502'))).toMatch(/servidor/);
    expect(messageForUnknownError(new Error('unknown_error'))).toMatch(/inesperado/);
  });

  it('maps bitacora_client 404/400 messages', () => {
    expect(messageForUnknownError(new Error('bitacora_client:404:Missing case'))).toBe('Missing case');
    expect(messageForUnknownError(new Error('bitacora_client:400:No default'))).toBe('No default');
    expect(messageForUnknownError(new Error('bitacora_client:403:No autorizado'))).toBe('No autorizado');
  });

  it('passes through BitacoraAuthError message when problem unknown', () => {
    const err = new BitacoraAuthError(401, 'custom', 'Mensaje API');
    expect(labelForAuthProblem(err.problem)).toBeNull();
  });
});
