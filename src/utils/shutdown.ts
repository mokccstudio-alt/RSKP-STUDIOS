export function onShutdown(fn: () => Promise<void>): void {
  let done = false;
  const handler = async (signal: string) => {
    if (done) return;
    done = true;
    console.log(`[app] ${signal} recibido, cerrando...`);
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    try {
      await fn();
    } catch (err) {
      console.error('[app] error al cerrar', err);
    }
    process.exit(0);
  };
  process.once('SIGTERM', () => void handler('SIGTERM'));
  process.once('SIGINT', () => void handler('SIGINT'));
}

export function installCrashLogging(): void {
  process.on('unhandledRejection', (err) => console.error('[app] promesa rechazada sin manejar', err));
}
