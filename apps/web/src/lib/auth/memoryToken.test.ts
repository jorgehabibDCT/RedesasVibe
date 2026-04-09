import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureTokenFromUrlOnce,
  clearMemoryToken,
  parseAccessTokenFromSearch,
  setMemoryTokenForTests,
} from './memoryToken.js';

describe('parseAccessTokenFromSearch', () => {
  it('reads access_token from query string', () => {
    expect(parseAccessTokenFromSearch('?access_token=abc&x=1')).toBe('abc');
    expect(parseAccessTokenFromSearch('access_token=xyz')).toBe('xyz');
  });

  it('returns null when absent', () => {
    expect(parseAccessTokenFromSearch('?foo=1')).toBeNull();
  });
});

describe('captureTokenFromUrlOnce', () => {
  beforeEach(() => {
    clearMemoryToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('stores token and strips access_token from URL via history.replaceState', () => {
    window.history.replaceState({}, '', '/?access_token=strip-me&keep=1');
    const replaceState = vi.spyOn(window.history, 'replaceState');

    const t = captureTokenFromUrlOnce();
    expect(t).toBe('strip-me');
    expect(replaceState).toHaveBeenCalled();
    const thirdArg = replaceState.mock.calls[0][2] as string;
    expect(thirdArg).not.toContain('access_token');
    expect(thirdArg).toContain('keep=1');
  });
});

describe('setMemoryTokenForTests', () => {
  beforeEach(() => clearMemoryToken());

  it('allows tests to set in-memory token without URL', () => {
    setMemoryTokenForTests('from-test');
    expect(captureTokenFromUrlOnce()).toBe('from-test');
  });
});
