/**
 * The API emits naive UTC timestamps ("2026-11-26T08:30:00", no offset).
 * `new Date()` would read those as *local* time (5h30m off in India), so parse
 * offset-less values as UTC.
 */
export function parseApiDate(iso: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  return new Date(hasZone || !iso.includes('T') ? iso : `${iso}Z`);
}
