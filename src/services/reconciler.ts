import { Repository } from '../domain/types';
import { Notifier } from './notifier';
import { SessionService } from './sessionService';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Reconciler {
  stop(): void;
  runOnce(): Promise<void>;
}

export function startReconciler(opts: {
  sessions: SessionService;
  repo: Repository;
  notifier: Notifier;
  intervalSeconds: number;
}): Reconciler {
  let running = false;
  let ticks = 0;

  const runOnce = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const r = await opts.sessions.reconcile();
      for (const session of r.timedOut) opts.notifier.notify({ type: 'ended', session });
      for (const session of r.expired) opts.notifier.notify({ type: 'expired', session });
      if (r.timedOut.length || r.expired.length) {
        console.log(`[reconciler] cerradas por inactividad: ${r.timedOut.length}, pendientes caducadas: ${r.expired.length}`);
      }
      if (ticks++ % 20 === 0) {
        const cutoff = new Date(Date.now() - DAY_MS);
        await opts.repo.pruneApiRequests(cutoff);
        await opts.repo.deleteExpiredLinkCodes(cutoff);
      }
    } catch (err) {
      console.error('[reconciler] error', err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void runOnce(), opts.intervalSeconds * 1000);
  timer.unref();
  void runOnce();

  return { stop: () => clearInterval(timer), runOnce };
}
