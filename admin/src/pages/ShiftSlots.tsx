/** Shift slots: define the daily working windows riders can pick. */
import { useState } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { Page } from '@/components/Layout';
import { AsyncView } from '@/ui/kit';
import type { RiderSlots, ShiftSlot } from '@/api/types';

const CAN_EDIT = ['super_admin', 'operations'];

export function ShiftSlots() {
  const { me } = useAuth();
  const canEdit = CAN_EDIT.includes(me?.admin_role ?? '');
  const { data, loading, error, stale, reload } = useAsync(() => api.shiftSlots(), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShiftSlot | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); await reload(); return true; } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); return false; } finally { setBusy(false); }
  };

  const remove = (s: ShiftSlot) => {
    if (!window.confirm(`Delete slot "${s.name}"? ${s.rider_count} partner(s) lose this slot.`)) return;
    void act(() => api.deleteShiftSlot(s.id));
  };

  return (
    <Page title="Shift slots">
      <div className="card" style={{ marginBottom: 16, fontSize: 13 }}>
        Partners pick the slots they will work. During a selected slot they are switched <strong>online</strong> automatically
        and can accept deliveries; when it ends they go <strong>offline</strong> (after finishing any delivery in progress).
        Outside their slots partners cannot go online. Deactivate every slot to turn this off.
      </div>

      {canEdit && <SlotForm key={editing?.id ?? 'new'} slot={editing} busy={busy} onCancel={() => setEditing(null)}
        onSave={async (body) => {
          const ok = await act(() => (editing ? api.updateShiftSlot(editing.id, body) : api.createShiftSlot(body)));
          if (ok) setEditing(null);
        }} />}
      {err && <div className="card" style={{ background: '#fee2e2', marginBottom: 12 }}>{err}</div>}

      <AsyncView data={data} loading={loading} error={error} onRetry={reload} stale={stale} isEmpty={(d) => d.length === 0}
        emptyTitle="No slots yet. Partners can go online any time until you add one.">
        {(slots) => (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Slot</th><th>Time</th><th>Partners</th><th>Status</th><th /></tr></thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.label}</td>
                    <td>{s.rider_count}{s.max_riders != null ? ` / ${s.max_riders}` : ''}</td>
                    <td>{s.is_active
                      ? <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>Active</span>
                      : <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>Inactive</span>}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canEdit && <>
                        <button className="btn secondary sm" disabled={busy} onClick={() => setEditing(s)}>Edit</button>{' '}
                        <button className="btn secondary sm" disabled={busy} onClick={() => void act(() => api.updateShiftSlot(s.id, { is_active: !s.is_active }))}>
                          {s.is_active ? 'Deactivate' : 'Activate'}
                        </button>{' '}
                        <button className="btn danger sm" disabled={busy} onClick={() => remove(s)}>Delete</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </Page>
  );
}

function SlotForm({ slot, busy, onSave, onCancel }: {
  slot: ShiftSlot | null;
  busy: boolean;
  onSave: (body: { name: string; start_time: string; end_time: string; max_riders: number | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(slot?.name ?? '');
  const [start, setStart] = useState(slot?.start_time ?? '11:00');
  const [end, setEnd] = useState(slot?.end_time ?? '14:00');
  const [cap, setCap] = useState(slot?.max_riders != null ? String(slot.max_riders) : '');
  const capNum = cap.trim() ? Number(cap) : null;
  const valid = name.trim() && start && end && start !== end && (capNum == null || (Number.isInteger(capNum) && capNum > 0));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{slot ? `Edit “${slot.name}”` : 'Add a slot'}</h3>
      <div className="row" style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 2, minWidth: 140, marginBottom: 0 }}>
          <label htmlFor="slot-name">Name</label>
          <input id="slot-name" value={name} maxLength={64} placeholder="e.g. Lunch" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 110, marginBottom: 0 }}>
          <label htmlFor="slot-start">Starts</label>
          <input id="slot-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 110, marginBottom: 0 }}>
          <label htmlFor="slot-end">Ends</label>
          <input id="slot-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 110, marginBottom: 0 }}>
          <label htmlFor="slot-cap">Max partners</label>
          <input id="slot-cap" inputMode="numeric" value={cap} placeholder="No limit" onChange={(e) => setCap(e.target.value)} />
        </div>
        <button className="btn" style={{ flex: '0 0 auto' }} disabled={busy || !valid}
          onClick={() => onSave({ name: name.trim(), start_time: start, end_time: end, max_riders: capNum })}>
          {slot ? 'Save' : 'Add slot'}
        </button>
        {slot && <button className="btn ghost" style={{ flex: '0 0 auto' }} onClick={onCancel}>Cancel</button>}
      </div>
      {end < start && start !== end && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Ends next day (overnight slot).</p>}
    </div>
  );
}

/** Partner profile panel: which slots this partner works; ops can change them. */
export function PartnerSlotsPanel({ riderId }: { riderId: number }) {
  const { me } = useAuth();
  const canEdit = CAN_EDIT.includes(me?.admin_role ?? '');
  const { data, error, reload } = useAsync<RiderSlots>(() => api.partnerSlots(riderId), [riderId]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async (slotId: number) => {
    if (!data) return;
    const current = data.slots.filter((s) => s.selected).map((s) => s.id);
    const next = current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId];
    setBusy(true); setErr(null);
    try { await api.setPartnerSlots(riderId, next); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Working slots</h3>
      {error && <p className="muted">{error}</p>}
      {err && <div className="card" style={{ background: '#fee2e2', marginBottom: 8 }}>{err}</div>}
      {data && data.slots.length === 0 && <p className="muted" style={{ margin: 0 }}>No shift slots configured — partner can go online any time.</p>}
      {data && data.slots.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {data.slots.map((s) => (
            <button key={s.id} type="button" disabled={!canEdit || busy || (s.is_full && !s.selected)}
              className={`btn sm ${s.selected ? 'mint' : 'secondary'}`} onClick={() => void toggle(s.id)}
              title={s.is_full && !s.selected ? 'Slot is full' : undefined}>
              {s.selected ? '✓ ' : ''}{s.name} · {s.label}{s.is_running ? ' (now)' : ''}
            </button>
          ))}
        </div>
      )}
      {data && data.enforced && !data.slots.some((s) => s.selected) && (
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>No slot selected — this partner cannot go online.</p>
      )}
    </div>
  );
}
