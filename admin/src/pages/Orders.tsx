import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { Page } from '@/components/Layout';
import { AsyncView } from '@/ui/kit';
import { money } from '@/theme';
import type { OrderDetail } from '@/api/types';

const ORDER_STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'];

export function Orders() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [testFilter, setTestFilter] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const { data, loading, error, stale, reload } = useAsync(
    () => api.orders({ q: q || undefined, status: status || undefined, is_test: testFilter === '' ? undefined : testFilter === 'true' }),
    [q, status, testFilter],
    20000
  );

  return (
    <Page title="Orders & issues">
      <div className="filters">
        <input placeholder="Order # or partner" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={testFilter} onChange={(e) => setTestFilter(e.target.value)}>
          <option value="">Real + test</option>
          <option value="false">Real only</option>
          <option value="true">Test only</option>
        </select>
      </div>
      <AsyncView data={data} loading={loading} error={error} onRetry={reload} stale={stale} isEmpty={(d) => d.items.length === 0} emptyTitle="No orders match">
        {(d) => (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Order</th><th>Status</th><th>Partner</th><th>Total</th><th>Type</th></tr></thead>
              <tbody>
                {d.items.map((o) => (
                  <tr key={o.order_id} className="clickable" onClick={() => setSelected(o.order_id)}>
                    <td>#{o.order_id}<div className="muted" style={{ fontSize: 12 }}>{o.mess_name}</div></td>
                    <td>{o.status}{o.delivery_status ? ` / ${o.delivery_status}` : ''}</td>
                    <td>{o.rider_name ?? '—'}</td>
                    <td>{money(o.total_cents)}</td>
                    <td>{o.is_test ? <span className="badge test">TEST</span> : <span className="muted">Real</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
      {selected !== null && <OrderDrawer orderId={selected} onClose={() => setSelected(null)} />}
    </Page>
  );
}

function OrderDrawer({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const [o, setO] = useState<OrderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = () => api.order(orderId).then(setO).catch((e) => setErr(e.message));
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orderId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        {!o ? <p>Loading…</p> : (
          <>
            <div className="pageheader">
              <h3 style={{ margin: 0 }}>Order #{o.order_id} {o.is_test && <span className="badge test">TEST</span>}</h3>
              <span className="muted">{o.status}</span>
            </div>
            {err && <div className="card" style={{ background: '#fee2e2', marginBottom: 12 }}>{err}</div>}
            <p className="muted" style={{ marginTop: 0 }}>{o.mess_name} → {o.dropoff_text} · {o.rider_name ?? 'no partner'} · {money(o.total_cents)}</p>

            <h4>Delivery timeline</h4>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {o.timeline.map((e) => (
                <div key={e.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0f1f5' }}>
                  <strong>{e.event_type}</strong>{' '}
                  {e.from_state && <span className="muted">{e.from_state} → {e.to_state}</span>}
                  {e.detail && <span className="muted"> · {e.detail}</span>}
                  {e.reason && <div className="muted">“{e.reason}”</div>}
                  <span className="muted" style={{ float: 'right', fontSize: 11 }}>{new Date(e.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>

            <h4>Reported issues ({o.issues.length})</h4>
            {o.issues.map((i) => (
              <div key={i.id} className="card" style={{ marginBottom: 8 }}>
                <div><strong>{i.issue_type}</strong> · <span className="muted">{i.status}</span></div>
                <div className="muted" style={{ fontSize: 13 }}>{i.note}</div>
                {i.admin_note && <div style={{ fontSize: 13 }}>Note: {i.admin_note}</div>}
                <div className="row" style={{ marginTop: 8 }}>
                  <input placeholder="Add resolution note" value={note} onChange={(e) => setNote(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <button className="btn secondary sm" disabled={!note.trim()} onClick={async () => { await api.addIssueNote(i.id, note.trim()); setNote(''); void load(); }}>Add note</button>
                  <button className="btn mint sm" onClick={async () => { await api.resolveIssue(i.id); void load(); }}>Resolve</button>
                </div>
              </div>
            ))}
            {o.issues.length === 0 && <p className="muted">None.</p>}

            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
