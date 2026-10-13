import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { slashCommands } from './bot/commands';
import { loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.DISCORD_TOKEN || !config.CLIENT_ID) {
    console.warn('\n' + '='.repeat(60));
    console.warn('⚠️ [deploy] AVISO: DISCORD_TOKEN o CLIENT_ID no configurados');
    console.warn('='.repeat(60));
    console.warn('Se omitirá el registro de comandos Slash por ahora.');
    console.warn('La API continuará arrancando.');
    console.warn('Configura DISCORD_TOKEN y CLIENT_ID en Railway para activar el bot.');
    console.warn('='.repeat(60) + '\n');
    return;
  }

  const token = config.DISCORD_TOKEN;
  const clientId = config.CLIENT_ID;

  const rest = new REST({ version: '10' }).setToken(token);
  const body = slashCommands.map((command) => command.toJSON());

  console.log(`[deploy] Iniciando despliegue de ${body.length} comandos de aplicación...`);

  if (config.GUILD_ID) {
    console.log(`[deploy] Registrando comandos en el servidor específico (GUILD_ID: ${config.GUILD_ID})...`);
    await rest.put(Routes.applicationGuildCommands(clientId, config.GUILD_ID), {
      body,
    });
    console.log(`[deploy] ¡Comandos de servidor actualizados exitosamente!`);
  } else {
    console.log(`[deploy] Registrando comandos globalmente...`);
    await rest.put(Routes.applicationCommands(clientId), {
      body,
    });
    console.log(`[deploy] ¡Comandos globales actualizados exitosamente!`);
  }
}

main().catch((err) => {
  console.error('[deploy] Error al desplegar comandos:', err);
  process.exit(1);
});
