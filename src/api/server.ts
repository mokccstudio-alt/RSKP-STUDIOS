import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { Core } from '../app';
import { AppConfig, requireApiKeys } from '../config';
import { Repository, StoredResponse } from '../domain/types';
import { LinkService, RedeemResult } from '../services/linkService';
import { Notifier } from '../services/notifier';
import { PresencePlayer, PresenceResult, SessionService } from '../services/sessionService';

export interface ApiDeps {
  repo: Repository;
  sessions: SessionService;
  links: LinkService;
  notifier: Notifier;
  apiKeys: string[];
  maxClockSkewSeconds: number;
  rateLimitPerMinute: number;
  now?: () => Date;
  logger?: boolean;
}

export function verifyBearer(header: string | undefined, keys: string[]): boolean {
  if (!header || !header.startsWith('Bearer ')) return false;
  const token = header.slice(7).trim();
  const provided = createHash('sha256').update(token).digest();
  let ok = false;
  for (const key of keys) {
    const expected = createHash('sha256').update(key).digest();
    if (timingSafeEqual(provided, expected)) ok = true;
  }
  return ok;
}

const robloxId = z
  .union([z.number().int().positive(), z.string().regex(/^\d{1,16}$/)])
  .transform((v) => Number(v))
  .refine((v) => Number.isSafeInteger(v) && v > 0, 'robloxUserId inválido');

const username = z.string().min(1).max(50);
const jobId = z.string().min(1).max(100);

const REDEEM_ERRORS: Record<Exclude<RedeemResult['kind'], 'linked'>, [number, string, string]> = {
  invalid: [404, 'invalid_code', 'Código no válido o no encontrado'],
  expired: [410, 'code_expired', 'El código de vinculación ha caducado'],
  used: [409, 'code_used', 'El código ya fue utilizado'],
  roblox_taken: [409, 'roblox_already_linked', 'Esta cuenta de Roblox ya está vinculada a otro usuario de Discord'],
  session_open: [409, 'session_open', 'El usuario de Discord tiene una sesión activa con otra cuenta de Roblox'],
};

// Schema for /api/roblox/presence
const presenceBodySchema = z.object({
  requestId: z.string().optional(),
  placeId: z.union([z.number(), z.string()]).optional(),
  jobId: jobId,
  timestamp: z.number().finite().positive().optional(),
  players: z.array(
    z.object({
      userId: robloxId,
      username: username,
      displayName: z.string().optional(),
    }),
  ).default([]),
});

// Schema for /api/roblox/link/verify
const linkVerifyBodySchema = z.object({
  requestId: z.string().optional(),
  robloxUserId: robloxId,
  username: username,
  code: z.string().min(4).max(32),
  timestamp: z.number().finite().positive().optional(),
});

export function buildServer(deps: ApiDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, trustProxy: true, bodyLimit: 64 * 1024 });
  const clock = deps.now ?? (() => new Date());

  app.register(rateLimit, {
    max: deps.rateLimitPerMinute,
    timeWindow: '1 minute',
    allowList: (req) => req.url.startsWith('/health'),
  });

  app.setErrorHandler((err: any, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) req.log.error(err);
    reply.code(status).send({
      ok: false,
      error: status === 500 ? 'internal_error' : err.code ?? 'request_error',
      message: status === 500 ? 'Error interno' : err.message,
    });
  });

  const dispatch = (r: PresenceResult) => {
    for (const session of r.activated) deps.notifier.notify({ type: 'started', session });
    for (const session of r.ended) deps.notifier.notify({ type: 'ended', session });
    for (const session of r.expired) deps.notifier.notify({ type: 'expired', session });
  };

  // Health check
  app.get('/health', async (_req, reply) => {
    try {
      await deps.repo.ping();
      return { ok: true, status: 'healthy', uptime: Math.round(process.uptime()), timestamp: Date.now() };
    } catch {
      return reply.code(503).send({ ok: false, status: 'unhealthy', error: 'database_unavailable' });
    }
  });

  // Endpoints with Auth for Roblox
  app.register(async (api) => {
    api.addHook('onRequest', async (req, reply) => {
      if (!verifyBearer(req.headers.authorization, deps.apiKeys)) {
        reply.code(401).send({ ok: false, error: 'unauthorized', message: 'API Key inválida o ausente' });
        return reply;
      }
    });

    // Roblox Staff Presence Heartbeat
    api.post('/roblox/presence', async (req, reply) => {
      const parsed = presenceBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: 'invalid_body',
          details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        });
      }

      const body = parsed.data;
      const playersList: PresencePlayer[] = body.players.map((p) => ({
        robloxUserId: p.userId,
        username: p.username,
      }));

      const result = await deps.sessions.heartbeat(body.jobId, playersList);
      dispatch(result);

      return reply.code(200).send({
        ok: true,
        activeUserIds: result.activeUserIds,
        timestamp: Date.now(),
      });
    });

    // Roblox Staff Account Linking Verification
    api.post('/roblox/link/verify', async (req, reply) => {
      const parsed = linkVerifyBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: 'invalid_body',
          details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        });
      }

      const body = parsed.data;
      const result = await deps.links.redeem(body.code, body.robloxUserId, body.username);

      if (result.kind === 'linked') {
        deps.notifier.notify({
          type: 'linked',
          discordId: result.discordId,
          robloxUserId: body.robloxUserId,
          robloxUsername: body.username,
        });
        return reply.code(200).send({
          ok: true,
          discordId: result.discordId,
          message: 'Cuenta vinculada exitosamente con Discord',
        });
      }

      const [statusCode, error, message] = REDEEM_ERRORS[result.kind];
      return reply.code(statusCode).send({ ok: false, error, message });
    });
  }, { prefix: '/api' });

  return app;
}

export function createApiServer(core: Core, config: AppConfig): FastifyInstance {
  const apiKeys = requireApiKeys(config);
  return buildServer({
    repo: core.repo,
    sessions: core.sessions,
    links: core.links,
    notifier: core.notifier,
    apiKeys,
    maxClockSkewSeconds: config.MAX_CLOCK_SKEW_SECONDS,
    rateLimitPerMinute: config.RATE_LIMIT_PER_MINUTE,
    logger: true,
  });
}
