import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { endReasonLabel, formatDuration, unix } from '../utils/format';
import { checkStaff, safeReply, staffCheckMessage } from './actions';
import { BotContext } from './context';
import { buildPanel } from './panel';

interface ResolvedRobloxUser {
  id: number;
  name: string;
  displayName?: string;
}

async function fetchRobloxUser(input: string): Promise<ResolvedRobloxUser | null> {
  const trimmed = input.trim();
  const isNumeric = /^\d+$/.test(trimmed);

  if (isNumeric) {
    const userId = Number(trimmed);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;

    try {
      const res = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { id: number; name: string; displayName?: string };
      if (!data.id || !data.name) return null;
      return { id: data.id, name: data.name, displayName: data.displayName };
    } catch (err) {
      console.error('[roblox-api] Error consultando usuario por ID:', err);
      return null;
    }
  } else {
    try {
      const res = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          usernames: [trimmed],
          excludeBannedUsers: false,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        data?: Array<{ id: number; name: string; displayName?: string }>;
      };
      if (!data.data || data.data.length === 0) return null;
      const user = data.data[0];
      return { id: user.id, name: user.name, displayName: user.displayName };
    } catch (err) {
      console.error('[roblox-api] Error consultando usuario por nombre:', err);
      return null;
    }
  }
}

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('set-enterinserv')
    .setDescription('Envía el panel interactivo de servicio al canal actual o especificado')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal donde se publicará el panel (por defecto el canal actual)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('vincular')
    .setDescription('Vincula tu cuenta de Discord con tu cuenta de Roblox por ID o nombre de usuario')
    .addStringOption((option) =>
      option
        .setName('roblox_id')
        .setDescription('Tu ID numérico de Roblox o tu nombre de usuario')
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('servicio')
    .setDescription('Consulta tu estado actual de servicio, tiempo acumulado y cuenta vinculada'),

  new SlashCommandBuilder()
    .setName('historial')
    .setDescription('Muestra el historial de tus turnos de servicio recientes')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuario a consultar (solo administradores)')
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('horas-staff')
    .setDescription('Consulta las horas de servicio acumuladas de un miembro del staff')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Miembro del staff a consultar (por defecto tú)')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('periodo')
        .setDescription('Periodo de tiempo a consultar')
        .setRequired(false)
        .addChoices(
          { name: 'Hoy (Últimas 24 horas)', value: 'day' },
          { name: 'Esta semana (Últimos 7 días)', value: 'week' },
          { name: 'Este mes (Últimos 30 días)', value: 'month' },
          { name: 'Histórico total', value: 'all' },
        ),
    ),

  new SlashCommandBuilder()
    .setName('forzarsalida')
    .setDescription('Fuerza el cierre de la sesión de servicio de un miembro del staff')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuario cuya sesión deseas finalizar')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo de la finalización forzada')
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('configurar')
    .setDescription('Configura los ajustes del sistema de servicio en este servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((option) =>
      option
        .setName('rol_staff')
        .setDescription('Rol de Discord requerido para utilizar el sistema de servicio')
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('canal_panel')
        .setDescription('Canal sugerido para ubicar el panel de fichaje')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    ),
];

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  ctx: BotContext,
): Promise<void> {
  const { commandName } = interaction;

  // 1. /set-enterinserv
  if (commandName === 'set-enterinserv') {
    if (!interaction.inGuild() || !interaction.guildId) {
      await safeReply(interaction, '❌ Este comando solo puede utilizarse en un servidor.');
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await safeReply(interaction, '⛔ Necesitas permisos de administración para ejecutar este comando.');
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const targetChannel =
      (interaction.options.getChannel('canal') as typeof interaction.channel) ||
      interaction.channel;

    if (!targetChannel || !('send' in targetChannel)) {
      await interaction.editReply('❌ No se pudo encontrar un canal de texto válido.');
      return;
    }

    try {
      const panelData = buildPanel();
      const message = await targetChannel.send(panelData);

      await ctx.repo.setPanelMessage(interaction.guildId, targetChannel.id, message.id);

      await interaction.editReply(
        `✅ Panel de servicio enviado con éxito en <#${targetChannel.id}>. Los botones ya están operativos.`,
      );
    } catch (err) {
      console.error('[bot] error enviando panel:', err);
      await interaction.editReply('❌ Ocurrió un error al intentar enviar el panel interactivo.');
    }
    return;
  }

  // 2. /vincular
  if (commandName === 'vincular') {
    await interaction.deferReply({ ephemeral: true });

    const rawInput = interaction.options.getString('roblox_id', true).trim();

    try {
      const resolved = await fetchRobloxUser(rawInput);
      if (!resolved) {
        const isNumeric = /^\d+$/.test(rawInput);
        const errorMsg = isNumeric
          ? `❌ No se encontró ningún usuario de Roblox con el ID \`${rawInput}\`. Verifica que el ID numérico sea correcto.`
          : `❌ No se encontró ningún usuario de Roblox con el nombre de usuario \`${rawInput}\`. Verifica que el nombre esté bien escrito.`;
        await interaction.editReply(errorMsg);
        return;
      }

      const robloxUserId = resolved.id;
      const robloxUsername = resolved.name;

      // Verificar si la cuenta de Roblox ya está vinculada a otro usuario de Discord
      const existingLink = await ctx.repo.getLinkByRoblox(robloxUserId);
      if (existingLink && existingLink.discordId !== interaction.user.id) {
        await interaction.editReply(
          `⚠️ Esta cuenta de Roblox (**${robloxUsername}**) ya está vinculada a otro usuario de Discord (<@${existingLink.discordId}>). Si crees que se trata de un error, contacta a un administrador.`,
        );
        return;
      }

      // Verificar si el usuario tiene una sesión abierta con otra cuenta
      const openSession = await ctx.repo.getOpenSessionByDiscord(interaction.user.id);
      if (openSession && openSession.robloxUserId !== robloxUserId) {
        await interaction.editReply(
          `⚠️ Tienes una sesión de servicio abierta con otra cuenta de Roblox (**${openSession.robloxUsername}**). Debes finalizar tu turno antes de cambiar tu vinculación.`,
        );
        return;
      }

      // Guardar la vinculación directamente en la base de datos
      await ctx.repo.upsertLink({
        discordId: interaction.user.id,
        robloxUserId,
        robloxUsername,
        linkedAt: new Date(),
      });

      const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxUserId}&width=150&height=150&format=png`;

      const embed = new EmbedBuilder()
        .setTitle('✅ Cuenta de Roblox Vinculada')
        .setColor(0x57f287)
        .setDescription(
          `Tu cuenta de Discord ha sido vinculada exitosamente con tu usuario de Roblox.\n\n` +
            `• **Usuario:** **${robloxUsername}**${resolved.displayName ? ` (${resolved.displayName})` : ''}\n` +
            `• **ID de Roblox:** \`${robloxUserId}\`\n` +
            `• **Perfil:** [Ver perfil en Roblox](https://www.roblox.com/users/${robloxUserId}/profile)\n\n` +
            `Ya puedes usar el botón **Entrar en servicio** en el panel para iniciar tus turnos.`,
        )
        .setThumbnail(avatarUrl)
        .setFooter({ text: 'Sistema de Servicio Staff • Vinculación directa' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[bot] error vinculando cuenta:', err);
      await interaction.editReply('❌ Ocurrió un error inesperado al intentar vincular tu cuenta de Roblox.');
    }
    return;
  }

  // 3. /servicio
  if (commandName === 'servicio') {
    const staffStatus = await checkStaff(interaction, ctx.repo);
    if (staffStatus !== 'ok') {
      await safeReply(interaction, staffCheckMessage(staffStatus));
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;
    const [link, openSession, totalWeek] = await Promise.all([
      ctx.repo.getLinkByDiscord(discordId),
      ctx.repo.getOpenSessionByDiscord(discordId),
      ctx.repo.getTotalSeconds(discordId, new Date(Date.now() - 7 * 24 * 3600 * 1000)),
    ]);

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Estado de Servicio')
      .setColor(openSession?.status === 'active' ? 0x57f287 : 0xfee75c)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    if (link) {
      embed.addFields({
        name: '👤 Cuenta de Roblox',
        value: `**${link.robloxUsername}** (ID: \`${link.robloxUserId}\`)`,
        inline: true,
      });
    } else {
      embed.addFields({
        name: '👤 Cuenta de Roblox',
        value: '❌ *No vinculada* (Usa `/vincular`)',
        inline: true,
      });
    }

    embed.addFields({
      name: '⏱️ Horas esta semana',
      value: `**${formatDuration(totalWeek)}**`,
      inline: true,
    });

    if (!openSession) {
      embed.addFields({
        name: '🔘 Estado Actual',
        value: '🔴 **Fuera de servicio**\nPresiona el botón en el panel para iniciar turno.',
        inline: false,
      });
    } else if (openSession.status === 'pending') {
      const deadline = new Date(openSession.requestedAt.getTime() + ctx.sessions.pendingTtlSeconds * 1000);
      embed.addFields({
        name: '🔘 Estado Actual',
        value:
          `⏳ **Pendiente de ingreso al juego**\n` +
          `Entra al juego con **${openSession.robloxUsername}** antes de <t:${unix(deadline)}:t> (<t:${unix(deadline)}:R>).`,
        inline: false,
      });
    } else if (openSession.status === 'active' && openSession.startedAt) {
      const elapsed = (Date.now() - openSession.startedAt.getTime()) / 1000;
      embed.addFields({
        name: '🔘 Estado Actual',
        value:
          `🟢 **En servicio activo**\n` +
          `• Inicio: <t:${unix(openSession.startedAt)}:T> (<t:${unix(openSession.startedAt)}:R>)\n` +
          `• Transcurrido: **${formatDuration(elapsed)}**\n` +
          `• Servidor JobId: \`${openSession.jobId ?? 'Detectado'}\``,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // 4. /historial
  if (commandName === 'historial') {
    const staffStatus = await checkStaff(interaction, ctx.repo);
    if (staffStatus !== 'ok') {
      await safeReply(interaction, staffCheckMessage(staffStatus));
      return;
    }

    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const isOther = targetUser.id !== interaction.user.id;

    if (isOther && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await safeReply(interaction, '⛔ Solo administradores pueden ver el historial de otros usuarios.');
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const sessions = await ctx.repo.getRecentSessions(targetUser.id, 10);

    const embed = new EmbedBuilder()
      .setTitle(`📜 Historial de Servicio: ${targetUser.username}`)
      .setColor(0x5865f2)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    if (sessions.length === 0) {
      embed.setDescription('No hay registros de servicio recientes para este usuario.');
    } else {
      const lines = sessions.map((s, idx) => {
        const startStr = s.startedAt ? `<t:${unix(s.startedAt)}:d> <t:${unix(s.startedAt)}:t>` : `<t:${unix(s.requestedAt)}:t>`;
        const durStr = s.durationSeconds !== null ? formatDuration(s.durationSeconds) : 'En curso';
        const reason = s.status === 'active' ? '🟢 En curso' : endReasonLabel(s.endReason);
        return `**${idx + 1}.** ${startStr} — **${durStr}**\n   ↳ Estado: *${reason}* | Jugador: \`${s.robloxUsername}\``;
      });
      embed.setDescription(lines.join('\n\n'));
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // 5. /horas-staff
  if (commandName === 'horas-staff') {
    const staffStatus = await checkStaff(interaction, ctx.repo);
    if (staffStatus !== 'ok') {
      await safeReply(interaction, staffCheckMessage(staffStatus));
      return;
    }

    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const period = interaction.options.getString('periodo') || 'week';

    await interaction.deferReply({ ephemeral: true });

    let since: Date;
    let periodName: string;

    const now = Date.now();
    if (period === 'day') {
      since = new Date(now - 24 * 3600 * 1000);
      periodName = 'Últimas 24 horas';
    } else if (period === 'week') {
      since = new Date(now - 7 * 24 * 3600 * 1000);
      periodName = 'Últimos 7 días';
    } else if (period === 'month') {
      since = new Date(now - 30 * 24 * 3600 * 1000);
      periodName = 'Últimos 30 días';
    } else {
      since = new Date(0); // Epoch start
      periodName = 'Histórico total';
    }

    const [totalSecs, link, openSession] = await Promise.all([
      ctx.repo.getTotalSeconds(targetUser.id, since),
      ctx.repo.getLinkByDiscord(targetUser.id),
      ctx.repo.getOpenSessionByDiscord(targetUser.id),
    ]);

    const totalHours = (totalSecs / 3600).toFixed(2);

    const embed = new EmbedBuilder()
      .setTitle(`⏱️ Reporte de Horas: ${targetUser.username}`)
      .setColor(0x57f287)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '📅 Periodo', value: periodName, inline: true },
        { name: '⏳ Tiempo Acumulado', value: `**${formatDuration(totalSecs)}**\n(${totalHours} horas)`, inline: true },
        {
          name: '👤 Roblox',
          value: link ? `**${link.robloxUsername}** (\`${link.robloxUserId}\`)` : '*No vinculado*',
          inline: true,
        },
        {
          name: '🔘 Estado Actual',
          value: openSession
            ? openSession.status === 'active'
              ? '🟢 **En servicio activo**'
              : '⏳ **Pendiente de ingreso**'
            : '⚪ **Fuera de servicio**',
          inline: false,
        },
      )
      .setFooter({ text: 'Sistema de Control de Turnos' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // 6. /forzarsalida
  if (commandName === 'forzarsalida') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await safeReply(interaction, '⛔ Necesitas permisos de administración para ejecutar este comando.');
      return;
    }

    const targetUser = interaction.options.getUser('usuario', true);
    const reasonText = interaction.options.getString('motivo') || 'Finalizado por un administrador';

    await interaction.deferReply({ ephemeral: true });

    const open = await ctx.repo.getOpenSessionByDiscord(targetUser.id);
    if (!open) {
      await interaction.editReply(`⚠️ El usuario <@${targetUser.id}> no tiene ninguna sesión de servicio activa.`);
      return;
    }

    const result = await ctx.sessions.stop(targetUser.id, reasonText);
    if (result.kind === 'none') {
      await interaction.editReply(`⚠️ No se encontró sesión activa para <@${targetUser.id}>.`);
      return;
    }

    if (result.kind === 'cancelled') {
      await interaction.editReply(`🛑 Se canceló la solicitud pendiente de <@${targetUser.id}>.`);
    } else {
      const dur = formatDuration(result.session.durationSeconds ?? 0);
      await interaction.editReply(
        `✅ Sesión de <@${targetUser.id}> finalizada con éxito.\n• Duración: **${dur}**\n• Motivo: *${reasonText}*`,
      );
    }
    return;
  }

  // 7. /configurar
  if (commandName === 'configurar') {
    if (!interaction.inGuild() || !interaction.guildId) {
      await safeReply(interaction, '❌ Este comando solo puede utilizarse en un servidor.');
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await safeReply(interaction, '⛔ Necesitas permisos de administración para ejecutar este comando.');
      return;
    }

    const role = interaction.options.getRole('rol_staff', true);
    const channel = interaction.options.getChannel('canal_panel');

    await interaction.deferReply({ ephemeral: true });

    await ctx.repo.upsertGuildConfig({
      guildId: interaction.guildId,
      staffRoleId: role.id,
      updatedBy: interaction.user.id,
    });

    if (channel) {
      await ctx.repo.setPanelMessage(interaction.guildId, channel.id, '');
    }

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuración Guardada')
      .setColor(0x57f287)
      .setDescription(
        `Se han actualizado los parámetros del sistema:\n\n` +
          `• **Rol de Staff Autorizado:** <@&${role.id}>\n` +
          (channel ? `• **Canal de Panel:** <#${channel.id}>\n` : '') +
          `\nYa puedes publicar el panel interactivo usando \`/set-enterinserv\`.`,
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
