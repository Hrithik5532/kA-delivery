import type { RiderSlot, RiderSlots } from '@/api/types';
import { parseServerDate } from '@/lib/format-time';

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function relative(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "Running now · ends 2:00 pm" / "Starts in 3h 10m" for a single slot. */
export function slotTimingLabel(slot: RiderSlot, now = Date.now()): string {
  if (slot.is_running) return `Running now · ends ${fmtTime(parseServerDate(slot.next_end_at))}`;
  return `Starts in ${relative(parseServerDate(slot.next_start_at).getTime() - now)}`;
}

/** One-line summary for the home screen. */
export function slotSummary(data: RiderSlots, now = Date.now()): { title: string; subtitle: string } {
  const byId = new Map(data.slots.map((s) => [s.id, s]));
  const current = data.current_slot_id != null ? byId.get(data.current_slot_id) : undefined;
  if (current && data.current_slot_ends_at) {
    return {
      title: `${current.name} slot · ${current.label}`,
      subtitle: `On shift now · ends ${fmtTime(parseServerDate(data.current_slot_ends_at))}`,
    };
  }
  const next = data.next_slot_id != null ? byId.get(data.next_slot_id) : undefined;
  if (next && data.next_slot_starts_at) {
    return {
      title: `Next: ${next.name} · ${next.label}`,
      subtitle: `You'll go online automatically in ${relative(parseServerDate(data.next_slot_starts_at).getTime() - now)}`,
    };
  }
  return { title: 'No working slot selected', subtitle: 'Choose a slot to start receiving orders' };
}
