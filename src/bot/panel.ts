import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { BUTTON } from './ids';

export function buildPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ Panel de Control de Servicio Staff')
    .setDescription(
      'Bienvenido al sistema de fichaje y registro de actividad para el equipo del staff.\n\n' +
        '**Instrucciones de uso:**\n' +
        '• **🟢 Entrar en servicio:** Inicia tu turno. Si ya estás dentro del servidor de Roblox, el tiempo empezará a contar al instante. Si aún no estás en el juego, dispondrás de un margen para conectarte.\n' +
        '• **🔴 Salir:** Concluye tu turno actual y guarda el tiempo total trabajado en la base de datos.\n' +
        '• **📊 Mi Estado:** Muestra en un mensaje privado tu estado actual, tiempo transcurrido y cuenta vinculada.\n\n' +
        '⚠️ *Nota: Es indispensable vincular tu cuenta previamente con `/vincular`.*',
    )
    .setColor(0x2b2d31)
    .setFooter({ text: 'Sistema de Servicio Staff • Sincronizado en tiempo real con Roblox' })
    .setTimestamp();

  const startBtn = new ButtonBuilder()
    .setCustomId(BUTTON.START)
    .setLabel('Entrar en servicio')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🟢');

  const stopBtn = new ButtonBuilder()
    .setCustomId(BUTTON.STOP)
    .setLabel('Salir')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🔴');

  const statusBtn = new ButtonBuilder()
    .setCustomId(BUTTON.STATUS)
    .setLabel('Mi Estado')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('📊');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(startBtn, stopBtn, statusBtn);

  return {
    embeds: [embed],
    components: [row],
  };
}
