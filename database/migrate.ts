import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';

const LOCK_ID = 7281940;

function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  if (process.env.DATABASE_PRIVATE_URL?.trim()) return process.env.DATABASE_PRIVATE_URL.trim();
  if (process.env.DATABASE_PUBLIC_URL?.trim()) return process.env.DATABASE_PUBLIC_URL.trim();
  if (process.env.POSTGRES_URL?.trim()) return process.env.POSTGRES_URL.trim();
  if (process.env.POSTGRESQL_URL?.trim()) return process.env.POSTGRESQL_URL.trim();

  // Variables individuales de PostgreSQL (comunes en Railway y otros proveedores)
  if (process.env.PGHOST && process.env.PGDATABASE) {
    const user = encodeURIComponent(process.env.PGUSER || 'postgres');
    const password = process.env.PGPASSWORD ? `:${encodeURIComponent(process.env.PGPASSWORD)}` : '';
    const host = process.env.PGHOST;
    const port = process.env.PGPORT || '5432';
    const db = process.env.PGDATABASE;
    return `postgres://${user}${password}@${host}:${port}/${db}`;
  }

  return undefined;
}

async function connectWithRetry(url: string, ssl: boolean, maxAttempts = 5): Promise<Client> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    const client = new Client({
      connectionString: url,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10_000,
    });

    try {
      await client.connect();
      return client;
    } catch (err) {
      console.warn(`[migrate] Intento ${attempt}/${maxAttempts} de conexión a PostgreSQL falló: ${(err as Error).message}`);
      await client.end().catch(() => undefined);
      if (attempt >= maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw new Error('No se pudo conectar a la base de datos tras múltiples intentos');
}

async function main(): Promise<void> {
  const url = resolveDatabaseUrl();
  if (!url) {
    console.error('\n' + '='.repeat(68));
    console.error('❌ ERROR: Variable de base de datos no encontrada en Railway');
    console.error('='.repeat(68));
    console.error('Para solucionar este error en tu panel de Railway (o entorno de despliegue):');
    console.error('');
    console.error('1. Entra a tu proyecto en Railway.');
    console.error('2. Si aún no tienes PostgreSQL, presiona "+ New" -> "Database" -> "Add PostgreSQL".');
    console.error('3. Entra a tu servicio (ej. RSKP-STUDIOS) -> Ve a la pestaña "Variables".');
    console.error('4. Agrega la variable:');
    console.error('   DATABASE_URL = ${{Postgres.DATABASE_URL}}');
    console.error('');
    console.error('5. Asegúrate de configurar también las variables obligatorias:');
    console.error('   - DISCORD_TOKEN  (Token de tu bot en Discord Developer Portal)');
    console.error('   - CLIENT_ID      (Application ID de tu bot)');
    console.error('   - ROBLOX_API_KEY (Clave secreta de mínimo 32 caracteres)');
    console.error('='.repeat(68) + '\n');
    process.exit(1);
  }

  const ssl = process.env.DATABASE_SSL === 'true' || url.includes('sslmode=require');
  const client = await connectWithRetry(url, ssl);

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
      console.log(`[migrate] aplicando migración: ${file}`);
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
    console.log('[migrate] Base de datos sincronizada y al día.');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('[migrate] Error fatal ejecutando migraciones:', err);
  process.exit(1);
});
