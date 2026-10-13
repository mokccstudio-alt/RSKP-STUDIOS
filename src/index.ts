import 'dotenv/config';
import { Client, Events, GatewayIntentBits, Interaction } from 'discord.js';
import { createApiServer } from './api/server';
import { createCore } from './app';
import { checkStaff, safeReply, staffCheckMessage, startText, statusText, stopText } from './bot/actions';
import { handleSlashCommand } from './bot/commands';
import { BotContext } from './bot/context';
import { BUTTON } from './bot/ids';
import { loadConfig } from './config';
import { startReconciler } from './services/reconciler';
import { installCrashLogging, onShutdown } from './utils/shutdown';

installCrashLogging();

async function main(): Promise<void> {
  console.log('[app] Iniciando sistema de turnos de servicio Roblox/Discord...');

  const config = loadConfig();
  const core = createCore(config);

  const botContext: BotContext = {
    repo: core.repo,
    sessions: core.sessions,
    links: core.links,
    config,
  };

  // 1. Iniciar servidor Fastify para API de Roblox y Webhooks
  const server = createApiServer(core, config);
  const host = '0.0.0.0';
  const port = config.PORT;

  await server.listen({ port, host });
  console.log(`[api] Servidor Fastify escuchando en http://${host}:${port}`);

  // 2. Iniciar reconciliador periódico de sesiones
  const reconciler = startReconciler({
    sessions: core.sessions,
    repo: core.repo,
    notifier: core.notifier,
    intervalSeconds: config.RECONCILE_INTERVAL_SECONDS,
  });
  console.log(`[reconciler] Intervalo de reconciliación activo cada ${config.RECONCILE_INTERVAL_SECONDS}s`);

  // 3. Inicializar bot de Discord
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`[bot] Sesión de Discord iniciada como ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // Manejo de Comandos Slash
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, botContext);
        return;
      }

      // Manejo de Botones del Panel
      if (interaction.isButton()) {
        const { customId } = interaction;

        if (customId === BUTTON.START) {
          const staffCheck = await checkStaff(interaction, core.repo);
          if (staffCheck !== 'ok') {
            await safeReply(interaction, staffCheckMessage(staffCheck));
            return;
          }
          if (!interaction.guildId) {
            await safeReply(interaction, '❌ Esta acción solo es válida dentro de un servidor.');
            return;
          }
          const reply = await startText(interaction.guildId, interaction.user.id, botContext);
          await safeReply(interaction, reply);
          return;
        }

        if (customId === BUTTON.STOP) {
          const staffCheck = await checkStaff(interaction, core.repo);
          if (staffCheck !== 'ok') {
            await safeReply(interaction, staffCheckMessage(staffCheck));
            return;
          }
          const reply = await stopText(interaction.user.id, botContext);
          await safeReply(interaction, reply);
          return;
        }

        if (customId === BUTTON.STATUS) {
          const reply = await statusText(interaction.user.id, botContext);
          await safeReply(interaction, reply);
          return;
        }
      }
    } catch (err) {
      console.error('[bot] Error procesando interacción:', err);
      if (interaction.isRepliable()) {
        await safeReply(interaction, '❌ Ocurrió un error inesperado al procesar la solicitud.');
      }
    }
  });

  if (config.DISCORD_TOKEN) {
    await client.login(config.DISCORD_TOKEN);
  } else {
    console.warn('[bot] DISCORD_TOKEN no configurado. El bot de Discord no se conectará.');
  }

  // 4. Manejo de apagado limpio
  onShutdown(async () => {
    console.log('[app] Finalizando procesos y desconectando recursos...');
    reconciler.stop();
    await server.close().catch((e) => console.error('[api] Error al cerrar servidor:', e));
    client.destroy();
    await core.pool.end().catch((e) => console.error('[db] Error cerrando pool de PostgreSQL:', e));
    console.log('[app] Cierre completado.');
  });
}

main().catch((err) => {
  console.error('[app] Error crítico al arrancar la aplicación:', err);
  process.exit(1);
});
