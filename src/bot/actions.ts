import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  RepliableInteraction,
} from 'discord.js';
import { Repository } from '../domain/types';
import { formatDuration, unix } from '../utils/format';
import { BotContext } from './context';

export type StaffCheck = 'ok' | 'no_config' | 'denied';

export async function checkStaff(i: ChatInputCommandInteraction | ButtonInteraction, repo: Repository): Promise<StaffCheck> {
  if (!i.guildId) return 'denied';
  if (i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return 'ok';
  const cfg = await repo.getGuildConfig(i.guildId);
  if (!cfg) return 'no_config';
  const roles = i.member?.roles;
  const has = Array.isArray(roles) ? roles.includes(cfg.staffRoleId) : roles?.cache.has(cfg.staffRoleId) ?? false;
  return has ? 'ok' : 'denied';
}

export function staffCheckMessage(r: Exclude<StaffCheck, 'ok'>): string {
  return r === 'no_config'
    ? '⚠️ Este servidor aún no está configurado. Un administrador debe usar `/configurar`.'
    : '⛔ Necesitas el rol de staff configurado para usar esto.';
}

export async function startText(guildId: string, discordId: string, ctx: BotContext): Promise<string> {
  const r = await ctx.sessions.start(guildId, discordId);
  switch (r.kind) {
    case 'not_linked':
      return '⚠️ Primero vincula tu cuenta de Roblox con `/vincular`.';
    case 'already_open':
      return r.session.status === 'active' && r.session.startedAt
        ? `🟢 Ya estás en servicio desde <t:${unix(r.session.startedAt)}:R>.`
        : '⏳ Ya tienes una solicitud pendiente: entra al juego para empezar.';
    case 'roblox_busy':
      return '⚠️ Tu cuenta de Roblox tiene una sesión abierta asociada a otro usuario de Discord. Contacta con un administrador.';
    case 'started':
      return `🟢 Servicio iniciado como **${r.session.robloxUsername}**. El tiempo cuenta mientras sigas en el juego.`;
    case 'pending': {
      const deadline = new Date(r.session.requestedAt.getTime() + ctx.sessions.pendingTtlSeconds * 1000);
      return `⏳ Solicitud registrada. Entra al juego con **${r.session.robloxUsername}** antes de <t:${unix(deadline)}:t> (<t:${unix(deadline)}:R>) para empezar a contar tiempo.`;
    }
  }
}

export async function stopText(discordId: string, ctx: BotContext): Promise<string> {
  const r = await ctx.sessions.stop(discordId);
  switch (r.kind) {
    case 'none':
      return '⚠️ No tienes ninguna sesión abierta.';
    case 'cancelled':
      return '🛑 Solicitud pendiente cancelada.';
    case 'ended':
      return `🔴 Servicio finalizado. Duración: **${formatDuration(r.session.durationSeconds ?? 0)}**.`;
  }
}

export async function statusText(discordId: string, ctx: BotContext): Promise<string> {
  const [link, open] = await Promise.all([ctx.repo.getLinkByDiscord(discordId), ctx.repo.getOpenSessionByDiscord(discordId)]);
  const lines: string[] = [];
  lines.push(link ? `👤 Roblox: **${link.robloxUsername}** (\`${link.robloxUserId}\`)` : '⚠️ Sin cuenta de Roblox vinculada (`/vincular`).');
  if (!open) {
    lines.push('⚪ Fuera de servicio.');
  } else if (open.status === 'pending') {
    const deadline = new Date(open.requestedAt.getTime() + ctx.sessions.pendingTtlSeconds * 1000);
    lines.push(`⏳ Pendiente: entra al juego antes de <t:${unix(deadline)}:t> (<t:${unix(deadline)}:R>).`);
  } else if (open.startedAt) {
    const elapsed = (Date.now() - open.startedAt.getTime()) / 1000;
    lines.push(`🟢 En servicio desde <t:${unix(open.startedAt)}:R> (${formatDuration(elapsed)}).`);
    if (open.lastSeenAt) lines.push(`📡 Última presencia en el juego: <t:${unix(open.lastSeenAt)}:R>.`);
  }
  return lines.join('\n');
}

export async function safeReply(i: RepliableInteraction, content: string): Promise<void> {
  try {
    if (i.deferred || i.replied) await i.editReply({ content });
    else await i.reply({ content, ephemeral: true });
  } catch (err) {
    console.error('[bot] no se pudo responder a la interacción', err);
  }
}
