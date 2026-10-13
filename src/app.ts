import { Pool } from 'pg';
import { AppConfig, requireDatabaseUrl } from './config';
import { createPool } from './db/pool';
import { PgRepository } from './db/pgRepository';
import { Repository } from './domain/types';
import { LinkService } from './services/linkService';
import { createRestNotifier, noopNotifier, Notifier } from './services/notifier';
import { SessionService } from './services/sessionService';

export interface Core {
  pool: Pool;
  repo: Repository;
  sessions: SessionService;
  links: LinkService;
  notifier: Notifier;
}

export function createCore(config: AppConfig): Core {
  const pool = createPool(requireDatabaseUrl(config), config.DATABASE_SSL === 'true');
  const repo = new PgRepository(pool);
  const sessions = new SessionService(repo, {
    graceSeconds: config.PRESENCE_GRACE_SECONDS,
    pendingTtlSeconds: config.PENDING_TTL_SECONDS,
  });
  const links = new LinkService(repo, { codeTtlSeconds: config.LINK_CODE_TTL_SECONDS });
  const notifier = config.DISCORD_TOKEN ? createRestNotifier(config.DISCORD_TOKEN) : noopNotifier;
  return { pool, repo, sessions, links, notifier };
}
