import { randomBytes } from 'crypto';
import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  if (process.env.DATABASE_PRIVATE_URL?.trim()) return process.env.DATABASE_PRIVATE_URL.trim();
  if (process.env.DATABASE_PUBLIC_URL?.trim()) return process.env.DATABASE_PUBLIC_URL.trim();
  if (process.env.POSTGRES_URL?.trim()) return process.env.POSTGRES_URL.trim();
  if (process.env.POSTGRESQL_URL?.trim()) return process.env.POSTGRESQL_URL.trim();

  // Variables estándar de PostgreSQL inyectadas por Railway / proveedores
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

const schema = z.object({
  DISCORD_TOKEN: optionalString,
  CLIENT_ID: optionalString,
  GUILD_ID: optionalString,
  DATABASE_URL: optionalString,
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  ROBLOX_API_KEY: optionalString,
  ROBLOX_API_KEY_PREVIOUS: optionalString,
  PORT: z.coerce.number().int().positive().default(3000),
  PRESENCE_GRACE_SECONDS: z.coerce.number().int().min(45).default(120),
  PENDING_TTL_SECONDS: z.coerce.number().int().min(60).default(600),
  LINK_CODE_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  RECONCILE_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(30),
  MAX_CLOCK_SKEW_SECONDS: z.coerce.number().int().min(30).default(300),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(1200),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(): AppConfig {
  const envWithDb = {
    ...process.env,
    DATABASE_URL: resolveDatabaseUrl(),
  };

  const parsed = schema.safeParse(envWithDb);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${issues}`);
  }
  return parsed.data;
}

export function requireDatabaseUrl(c: AppConfig): string {
  if (!c.DATABASE_URL) {
    throw new Error(
      'Falta DATABASE_URL. En Railway: añade un servicio de PostgreSQL y vincula DATABASE_URL = ${{Postgres.DATABASE_URL}}',
    );
  }
  return c.DATABASE_URL;
}

export function requireBotConfig(c: AppConfig): { token: string; clientId: string } {
  if (!c.DISCORD_TOKEN || !c.CLIENT_ID) {
    throw new Error('Faltan DISCORD_TOKEN o CLIENT_ID en las variables de entorno');
  }
  return { token: c.DISCORD_TOKEN, clientId: c.CLIENT_ID };
}

let generatedFallbackKey: string | null = null;

export function requireApiKeys(c: AppConfig): string[] {
  if (!c.ROBLOX_API_KEY || c.ROBLOX_API_KEY.length < 32) {
    if (!generatedFallbackKey) {
      generatedFallbackKey = randomBytes(32).toString('hex');
      console.warn('\n⚠️ [config] ROBLOX_API_KEY no está definido o tiene menos de 32 caracteres.');
      console.warn(`   Se generó una clave temporal para pruebas: ${generatedFallbackKey}`);
      console.warn('   Para producción, añade la variable ROBLOX_API_KEY en tu panel de Railway.\n');
    }
    return [generatedFallbackKey];
  }
  const keys = [c.ROBLOX_API_KEY];
  if (c.ROBLOX_API_KEY_PREVIOUS) {
    if (c.ROBLOX_API_KEY_PREVIOUS.length >= 32) {
      keys.push(c.ROBLOX_API_KEY_PREVIOUS);
    }
  }
  return keys;
}
