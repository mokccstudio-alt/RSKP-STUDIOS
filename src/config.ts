import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

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
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${issues}`);
  }
  return parsed.data;
}

export function requireDatabaseUrl(c: AppConfig): string {
  if (!c.DATABASE_URL) throw new Error('Falta DATABASE_URL');
  return c.DATABASE_URL;
}

export function requireBotConfig(c: AppConfig): { token: string; clientId: string } {
  if (!c.DISCORD_TOKEN || !c.CLIENT_ID) throw new Error('Faltan DISCORD_TOKEN o CLIENT_ID');
  return { token: c.DISCORD_TOKEN, clientId: c.CLIENT_ID };
}

export function requireApiKeys(c: AppConfig): string[] {
  if (!c.ROBLOX_API_KEY || c.ROBLOX_API_KEY.length < 32) {
    throw new Error('ROBLOX_API_KEY es obligatorio y debe tener al menos 32 caracteres');
  }
  const keys = [c.ROBLOX_API_KEY];
  if (c.ROBLOX_API_KEY_PREVIOUS) {
    if (c.ROBLOX_API_KEY_PREVIOUS.length < 32) throw new Error('ROBLOX_API_KEY_PREVIOUS debe tener al menos 32 caracteres');
    keys.push(c.ROBLOX_API_KEY_PREVIOUS);
  }
  return keys;
}
