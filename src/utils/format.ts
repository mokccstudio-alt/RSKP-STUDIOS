export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (h || m) parts.push(`${m} min`);
  parts.push(`${sec} s`);
  return parts.join(' ');
}

export function unix(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export const END_REASON_LABELS: Record<string, string> = {
  manual: 'finalizado manualmente',
  timeout: 'sin presencia en el juego (periodo de gracia agotado)',
  cancelled: 'solicitud cancelada',
  pending_timeout: 'no entraste al juego a tiempo',
  admin_forced: 'finalizado por un administrador',
};

export function endReasonLabel(reason: string | null): string {
  return reason ? END_REASON_LABELS[reason] ?? reason : 'desconocido';
}
