import { parseApiDate } from '@/lib/time';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import type { AdminDeliveryRow, PartnerDeliveryRow, PartnerDetail } from '@/api/types';
import { formatGmv, money } from '@/theme';
import { PartnerSlotsPanel } from '@/pages/ShiftSlots';
import { LoginCodeCard } from '@/components/LoginCodeCard';
import { AsyncView, ReasonModal } from '@/ui/kit';

type Tab = 'overview' | 'active' | 'history' | 'bank';
type ActionModal = 'suspend' | 'reactivate' | null;

function tabList(partner: PartnerDetail) {
  const activeCount = partner.active_order ? 1 : 0;
  return [
    { id: 'overview' as Tab, label: 'Overview & KYC' },
    { id: 'active' as Tab, label: `Active Orders (${activeCount})` },
    { id: 'history' as Tab, label: `Delivery History (${partner.total_deliveries})` },
    { id: 'bank' as Tab, label: 'Salary & Bank' },
  ];
}

const ORDER_STEPS = ['Order Accepted', 'Picked Up', 'In Transit', 'Drop'];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function partnerId(p: PartnerDetail) {
  return p.partner_code ?? `DM-${String(p.rider_id).padStart(4, '0')}`;
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return parseApiDate(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type DeliveryRow = PartnerDeliveryRow | AdminDeliveryRow;

function isFullDeliveryRow(d: DeliveryRow): d is PartnerDeliveryRow {
  return 'mess_name' in d;
}

function deliveryStatusPill(status: string) {
  if (status === 'delivered') return <span className="pp-status-delivered">Delivered</span>;
  return <span className="pp-status-warn">{status.replace(/_/g, ' ')}</span>;
}

function DeliveryTable({ rows, showAll, compact, showViewAll }: { rows: DeliveryRow[]; showAll?: boolean; compact?: boolean; showViewAll?: number }) {
  const data = showAll ? rows : rows.slice(0, 5);
  const cols = compact ? 4 : 5;
  return (
    <>
      <table className="partners-table compact pp-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Merchant / Kitchen</th>
            {!compact && <th>Drop Landmark</th>}
            <th>Time &amp; Dist</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={cols} className="muted">No deliveries yet.</td></tr>
          ) : data.map((d) => (
            <tr key={d.delivery_id}>
              <td><span className="order-link">#DM-{d.order_id}</span>{d.is_test ? ' (TEST)' : ''}</td>
              <td>{isFullDeliveryRow(d) ? (d.mess_name ?? '—') : '—'}</td>
              {!compact && <td className="muted">{isFullDeliveryRow(d) ? d.dropoff_text : '—'}</td>}
              <td className="muted">
                {fmt(d.delivered_at ?? d.created_at)}
                {isFullDeliveryRow(d) && d.distance_km != null ? <div>{d.distance_km.toFixed(1)} km</div> : null}
              </td>
              <td>{deliveryStatusPill(d.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showViewAll != null && rows.length > 5 && (
        <div style={{ textAlign: 'right', marginTop: 10 }}>
          <button type="button" className="link-btn">View All {showViewAll} Orders</button>
        </div>
      )}
    </>
  );
}

function OrderProgress({ step }: { step: number }) {
  return (
    <div className="pp-progress">
      {ORDER_STEPS.map((label, i) => (
        <div key={label} className={`pp-progress-step ${i < step ? 'done' : ''} ${i === step ? 'current' : ''}`}>
          {label}
        </div>
      ))}
    </div>
  );
}

function ActiveOrderCard({ order, full }: { order: NonNullable<PartnerDetail['active_order']>; full?: boolean }) {
  const statusLabel = order.status === 'picked_up' ? 'PICKED UP' : order.status.replace(/_/g, ' ').toUpperCase();
  return (
    <div className="pp-section-card pp-order-card">
      <div className="pp-section-head">
        <h3>{full ? 'Live Active Order' : 'Live Active Order'}</h3>
        <span className="pp-order-badge">{statusLabel}</span>
      </div>
      <div className="partner-name">Order #DM-{order.order_id}</div>
      <div className="pp-field-grid" style={{ marginTop: 14 }}>
        <div className="pp-field"><span className="pp-field-label">Pickup Restaurant</span><span className="pp-field-value">{order.pickup_label}</span></div>
        <div className="pp-field"><span className="pp-field-label">Drop Customer</span><span className="pp-field-value">{order.dropoff_text}</span></div>
        <div className="pp-field"><span className="pp-field-label">Order Value / Fare</span><span className="pp-field-value purple">{formatGmv(order.total_cents)}</span></div>
        <div className="pp-field"><span className="pp-field-label">ETA</span><span className="pp-field-value">{order.eta_minutes != null ? `${Math.round(order.eta_minutes)} mins` : '—'}</span></div>
      </div>
      <OrderProgress step={order.progress_step} />
    </div>
  );
}

export function PartnerProfile() {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const id = Number(riderId);
  const [p, setP] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [noteText, setNoteText] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.partner(id).then(setP).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { if (Number.isFinite(id)) load(); }, [id]);

  const act = async (fn: () => Promise<PartnerDetail>) => {
    setError(null);
    try { setP(await fn()); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); throw e; }
  };

  const saveNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteBusy(true);
    try {
      await act(() => api.addPartnerNote(id, text));
      setNoteText('');
    } finally {
      setNoteBusy(false);
    }
  };


  return (
    <div className="content pp-page">
      <AsyncView data={p} loading={loading} error={error} onRetry={load} isEmpty={(d) => !d}>
        {(partner) => {
          return (
          <>
            <div className="pp-breadcrumb">
              <Link to="/">Console</Link> <span>›</span> Operations / <Link to="/partners">Delivery Partners</Link> / <strong>{partnerId(partner)}</strong>
            </div>

            <div className="pp-title-row">
              <div>
                <h1 className="pp-page-title">{partner.full_name}</h1>
                <div className="pp-status-row">
                  <span className="pp-badge pp-badge-green">Status: Active {partner.is_online ? '(Online)' : '(Offline)'}</span>
                  {partner.active_order && <span className="pp-badge pp-badge-green">Active — In Delivery</span>}
                  {partner.fleet_tier && <span className="pp-badge pp-badge-gold">{partner.fleet_tier}</span>}
                  {!partner.account_active && <span className="pp-badge pp-badge-red">Suspended</span>}
                </div>
              </div>
              <div className="pp-title-actions">
                <button type="button" className="btn secondary sm" onClick={() => navigate(`/partners/${id}/edit`)}>Edit Partner</button>
                <button type="button" className="btn primary sm" onClick={() => navigate('/salary')}>Salary invoices</button>
                {partner.account_active ? (
                  <button type="button" className="btn outline-danger sm" onClick={() => setActionModal('suspend')}>Suspend</button>
                ) : (
                  <button type="button" className="btn mint sm" onClick={() => setActionModal('reactivate')}>Reactivate</button>
                )}
              </div>
            </div>

            {partner.suspended_reason && <div className="card profile-alert">Suspended: {partner.suspended_reason}</div>}

            <div className="pp-summary-card">
              <div className="pp-summary-left">
                <div className="lt-avatar xl">{initials(partner.full_name)}</div>
                <div className="pp-summary-contact">
                  <div className="pp-summary-name">{partner.full_name}</div>
                  <div className="pp-summary-id">{partnerId(partner)}</div>
                  <div className="pp-verified">
                    {partner.phone_verified && <span>✓ Phone verified</span>}
                    {(partner.email || partner.contact_email) && <span>· ✓ Email verified</span>}
                  </div>
                  <div className="pp-summary-meta">{partner.operating_hub || 'Unassigned hub'} · {partner.tenure_months} months tenure</div>
                </div>
              </div>
              <div className="pp-summary-metrics">
                <div className="pp-metric"><div className="pp-metric-label">Lifetime Trips</div><div className="pp-metric-value">{partner.total_deliveries}</div></div>
                <div className="pp-metric"><div className="pp-metric-label">Cancel Rate</div><div className="pp-metric-value">{partner.cancel_rate_pct}%</div></div>
                <div className="pp-metric"><div className="pp-metric-label">Monthly Salary</div><div className="pp-metric-value purple">{partner.monthly_salary_cents != null ? money(partner.monthly_salary_cents) : 'Not set'}</div></div>
                <div className="pp-metric"><div className="pp-metric-label">Current Order</div><div className="pp-metric-value sm">{partner.active_order_id ? `#DM-${partner.active_order_id}` : '—'}</div></div>
              </div>
            </div>

            <div className="pp-tabs-bar" role="tablist" aria-label="Partner sections">
              {tabList(partner).map((tb) => (
                <button key={tb.id} type="button" role="tab" aria-selected={tab === tb.id} className={`pp-tab ${tab === tb.id ? 'active' : ''}`} onClick={() => setTab(tb.id)} disabled={tb.id === 'active' && !partner.active_order}>
                  {tb.label}
                </button>
              ))}
            </div>

            <div className="pp-layout">
              <div className="pp-main">
                {tab === 'overview' && (
                  <>
                    {partner.active_order && <ActiveOrderCard order={partner.active_order} />}
                    <div className="pp-section-card">
                      <div className="pp-section-head">
                        <h3>Personal &amp; Fleet Information</h3>
                        <button type="button" className="btn secondary sm" onClick={() => navigate(`/partners/${id}/edit`)}>Quick Edit</button>
                      </div>
                      <div className="pp-field-grid">
                        <div className="pp-field"><span className="pp-field-label">Full Legal Name</span><span className="pp-field-value">{partner.full_name}</span></div>
                        <div className="pp-field"><span className="pp-field-label">Primary Mobile</span><span className="pp-field-value">{partner.phone ?? '—'}</span></div>
                        <div className="pp-field"><span className="pp-field-label">Emergency Contact</span><span className="pp-field-value">{partner.emergency_contact || '—'}</span></div>
                        <div className="pp-field"><span className="pp-field-label">Email</span><span className="pp-field-value">{partner.email ?? partner.contact_email ?? '—'}</span></div>
                        <div className="pp-field"><span className="pp-field-label">Assigned Delivery Cluster</span><span className="pp-field-value">{partner.operating_hub || 'Unassigned'}</span></div>
                        <div className="pp-field"><span className="pp-field-label">Fleet Tier</span><span className="pp-field-value">{partner.fleet_tier || '—'}</span></div>
                        <div className="pp-field"><span className="pp-field-label">Vehicle</span><span className="pp-field-value">{partner.vehicle_model || partner.vehicle_type} · {partner.vehicle_number}</span></div>
                        <div className="pp-field"><span className="pp-field-label">Working Slots</span><span className="pp-field-value">{partner.shift_preference ?? 'None assigned'}</span></div>
                        <div className="pp-field"><span className="pp-field-label">Driving Licence</span><span className="pp-field-value">{partner.license_number || '—'}{partner.rc_status ? ` · RC ${partner.rc_status}` : ''}</span></div>
                      </div>
                    </div>
                    <SalaryBankCard partner={partner} onEdit={() => navigate(`/partners/${id}/edit`)} />
                    <div className="pp-section-card">
                      <div className="pp-section-head"><h3>Recent Delivery Assignments</h3><button type="button" className="link-btn" onClick={() => setTab('history')}>View All {partner.total_deliveries} Orders</button></div>
                      <DeliveryTable rows={partner.delivery_history.length ? partner.delivery_history : partner.recent_deliveries} showViewAll={partner.total_deliveries} />
                    </div>
                  </>
                )}

                {tab === 'active' && (
                  partner.active_order ? (
                    <ActiveOrderCard order={partner.active_order} full />
                  ) : (
                    <div className="pp-section-card"><p className="muted">No active delivery right now.</p></div>
                  )
                )}

                {tab === 'history' && (
                  <div className="pp-section-card">
                    <h3>Delivery History</h3>
                    <DeliveryTable rows={partner.delivery_history} showAll />
                  </div>
                )}

                {tab === 'bank' && <SalaryBankCard partner={partner} onEdit={() => navigate(`/partners/${id}/edit`)} />}
              </div>

              <aside className="pp-sidebar">
                <LoginCodeCard riderId={partner.rider_id} name={partner.full_name} suspended={!partner.account_active} />
                <PartnerSlotsPanel riderId={partner.rider_id} />
                <div className="pp-section-card">
                  <div className="pp-section-head"><h3>Compliance &amp; KYC</h3>{partner.kyc_items.every((k) => k.ok) && <span className="pp-kyc-ok">Verified</span>}</div>
                  <div className="pp-kyc-list">
                    {partner.kyc_items.map((k) => (
                      <div key={k.label} className="pp-kyc-row">
                        <span>{k.label}</span>
                        <span className={k.ok ? 'pp-kyc-ok' : 'pp-status-warn'}>{k.ok ? 'Verified' : k.status}</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn secondary sm" style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('/verification')}>Review documents</button>
                </div>

                <div className="pp-section-card">
                  <h3>Internal Admin Notes</h3>
                  <div className="pp-note-feed">
                    {partner.admin_notes.length === 0 ? (
                      <div className="muted">No admin notes yet.</div>
                    ) : partner.admin_notes.map((n) => (
                      <div key={n.id} className="pp-note-item">
                        <div>{n.text}</div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{fmt(n.created_at)}</div>
                      </div>
                    ))}
                  </div>
                  <textarea className="wd-note" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add an internal note…" />
                  <button type="button" className="btn primary sm" style={{ width: '100%' }} disabled={noteBusy || !noteText.trim()} onClick={saveNote}>
                    {noteBusy ? 'Saving…' : 'Save Note to Partner File'}
                  </button>
                </div>

                {partner.open_issues.length > 0 && (
                  <div className="card wd-detail-card">
                    <h3>Open Issues</h3>
                    {partner.open_issues.map((i) => (
                      <div key={i.id} className="profile-issue">#{i.order_id} · {i.issue_type}: {i.note}</div>
                    ))}
                  </div>
                )}
              </aside>
            </div>

            {partner.active_order_id && tab === 'overview' && (
              <button type="button" className="btn secondary sm" onClick={() => navigate('/operations')}>View on Live Tracking</button>
            )}
          </>
          );
        }}
      </AsyncView>

      {actionModal === 'suspend' && (
        <ReasonModal title="Suspend partner" confirmLabel="Suspend" onConfirm={(r) => act(() => api.suspend(id, r))} onClose={() => setActionModal(null)} />
      )}
      {actionModal === 'reactivate' && (
        <ReasonModal title="Reactivate partner" confirmLabel="Reactivate" onConfirm={(r) => act(() => api.reactivate(id, r))} onClose={() => setActionModal(null)} />
      )}
    </div>
  );
}

function SalaryBankCard({ partner, onEdit }: { partner: PartnerDetail; onEdit: () => void }) {
  return (
    <div className="pp-section-card">
      <div className="pp-section-head">
        <h3>Salary &amp; Bank</h3>
        <button type="button" className="btn secondary sm" onClick={onEdit}>Edit</button>
      </div>
      <div className="pp-field-grid">
        <div className="pp-field"><span className="pp-field-label">Monthly Salary</span><span className="pp-field-value purple">{partner.monthly_salary_cents != null ? money(partner.monthly_salary_cents) : 'Not set'}</span></div>
        <div className="pp-field"><span className="pp-field-label">Bank</span><span className="pp-field-value">{partner.bank_name || '—'}{partner.bank_account_masked ? ` ···· ${partner.bank_account_masked}` : ''}</span></div>
        <div className="pp-field"><span className="pp-field-label">IFSC</span><span className="pp-field-value">{partner.ifsc_code || '—'}</span></div>
        <div className="pp-field"><span className="pp-field-label">UPI</span><span className="pp-field-value">{partner.upi_id || '—'}</span></div>
      </div>
    </div>
  );
}
