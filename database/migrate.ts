import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';

const LOCK_ID = 7281940;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no está definido');

  const client = new Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );

    const dir = path.join(__dirname, 'migrations');
    const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(path.join(dir, file), 'utf8');
      console.log(`[migrate] aplicando ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${file}: ${(err as Error).message}`);
      }
    }
    console.log('[migrate] base de datos al día');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
