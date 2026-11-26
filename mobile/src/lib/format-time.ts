/**
 * The API emits naive UTC timestamps ("2026-11-26T08:30:00", no offset).
 * `new Date()` would read those as *local* time (5h30m off in India), so parse
 * offset-less values as UTC.
 */
export function parseServerDate(iso: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  return new Date(hasZone || !iso.includes('T') ? iso : `${iso}Z`);
}

export function formatOrderTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseServerDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeUpdate(seconds: number | null | undefined): string {
  if (seconds == null) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ago`;
}

export function formatRelativeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - parseServerDate(iso).getTime();
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
