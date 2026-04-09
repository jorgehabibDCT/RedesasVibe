import { describe, expect, it, vi } from 'vitest';
import { listCasesCompact } from './bitacoraCaseReadRepository.js';

describe('listCasesCompact', () => {
  it('queries without search when search is empty', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    await listCasesCompact({ query } as never, { limit: 25 });
    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY updated_at DESC');
    expect(sql).not.toContain('ILIKE');
    expect(query.mock.calls[0][1]).toEqual([25]);
  });

  it('uses ILIKE when search is provided', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    await listCasesCompact({ query } as never, { limit: 10, search: 'EXP' });
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('ILIKE');
    const params = query.mock.calls[0][1] as unknown[];
    expect(params).toHaveLength(2);
    expect(params[1]).toBe(10);
  });
});
