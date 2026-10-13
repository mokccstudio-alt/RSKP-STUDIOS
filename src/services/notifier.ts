import { REST, Routes } from 'discord.js';
import { ServiceSession } from '../domain/types';
import { endReasonLabel, formatDuration } from '../utils/format';

export type NotifyEvent =
  | { type: 'started' | 'ended' | 'expired'; session: ServiceSession }
  | { type: 'linked'; discordId: string; robloxUserId: number; robloxUsername: string };

export interface Notifier {
  notify(event: NotifyEvent): void;
}

export const noopNotifier: Notifier = { notify: () => undefined };

export function formatEvent(e: NotifyEvent): { userId: string; content: string } {
  if (e.type === 'linked') {
    return {
      userId: e.discordId,
      content: `✅ Tu cuenta de Discord se ha vinculado con **${e.robloxUsername}** (\`${e.robloxUserId}\`) en Roblox.`,
    };
  }
  const s = e.session;
  if (e.type === 'started') {
    return { userId: s.discordId, content: `🟢 Has entrado en servicio en el juego como **${s.robloxUsername}**. El tiempo empieza a contar ahora.` };
  }
  if (e.type === 'expired') {
    return { userId: s.discordId, content: `⚠️ Tu solicitud de servicio ha caducado: ${endReasonLabel(s.endReason)}.` };
  }
  return {
    userId: s.discordId,
    content: `🔴 Tu servicio ha terminado (${endReasonLabel(s.endReason)}). Duración: **${formatDuration(s.durationSeconds ?? 0)}**.`,
  };
}

export function createRestNotifier(token: string): Notifier {
  const rest = new REST({ version: '10' }).setToken(token);
  const dmChannels = new Map<string, string>();

  async function send(userId: string, content: string): Promise<void> {
    let channelId = dmChannels.get(userId);
    if (!channelId) {
      const channel = (await rest.post(Routes.userChannels(), { body: { recipient_id: userId } })) as { id: string };
      channelId = channel.id;
      dmChannels.set(userId, channelId);
    }
    await rest.post(Routes.channelMessages(channelId), { body: { content, allowed_mentions: { parse: [] } } });
  }

  return {
    notify(event) {
      const { userId, content } = formatEvent(event);
      send(userId, content).catch((err: unknown) => {
        console.warn(`[notifier] no se pudo enviar MD a ${userId}: ${(err as Error).message}`);
      });
    },
  };
}
