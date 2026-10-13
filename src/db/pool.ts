import { Pool } from 'pg';

export function createPool(connectionString: string, ssl: boolean): Pool {
  const pool = new Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (err) => console.error('[db] error en un cliente inactivo', err));
  return pool;
}
