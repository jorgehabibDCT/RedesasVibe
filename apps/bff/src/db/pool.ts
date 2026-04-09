import pg from 'pg';

let pool: pg.Pool | null = null;

/** Returns a shared pool when `DATABASE_URL` is set; otherwise ingest is unavailable. */
export function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: url });
  }
  return pool;
}

/** For tests: reset singleton pool. */
export function resetPoolForTests(): void {
  if (pool) {
    void pool.end();
    pool = null;
  }
}
