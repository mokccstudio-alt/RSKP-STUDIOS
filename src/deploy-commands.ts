import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { slashCommands } from './bot/commands';
import { loadConfig, requireBotConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig();
  const { token, clientId } = requireBotConfig(config);

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
    console.log(`[deploy] Registrando comandos globalmente (esto puede tardar hasta una hora en propagarse en Discord)...`);
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
