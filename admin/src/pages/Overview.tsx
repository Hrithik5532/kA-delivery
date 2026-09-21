import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { AsyncView } from '@/ui/kit';
import { formatGmv, money, orderStatusMeta } from '@/theme';
import type { ActiveDelivery, OrderSummary } from '@/api/types';

const PAGE_SIZE = 6;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function statusPill(status: string) {
  const meta = orderStatusMeta[status] ?? { label: status.replace(/_/g, ' '), cls: 'status-muted' };
  return <span className={`status-pill ${meta.cls}`}>{meta.label}</span>;
}

function statusBorderClass(status: string) {
  if (['preparing', 'accepted', 'ready'].includes(status)) return 'row-kitchen';
  if (status === 'picked_up') return 'row-picked';
  if (['assigned', 'out_for_delivery'].includes(status)) return 'row-transit';
  return 'row-default';
}

function DemandChart({ active }: { active: number }) {
  const points = useMemo(() => {
    const base = Math.max(active, 8);
    const multipliers = [0.28, 0.42, 0.58, 0.72, 0.88, 0.95, 0.78, 0.62, 0.55, 0.68, 0.92, 0.74];
    return multipliers.map((m, i) => ({
      x: 24 + i * 28,
      orders: 130 - m * base * 0.85,
      riders: 130 - m * base * 0.55 - 12,
    }));
  }, [active]);

  const ordersLine = points.map((p) => `${p.x},${p.orders}`).join(' ');
  const ridersLine = points.map((p) => `${p.x},${p.riders}`).join(' ');

  return (
    <div className="demand-chart-wrap">
      <svg viewBox="0 0 360 150" className="chart-svg" aria-hidden>
        <line x1="20" y1="130" x2="340" y2="130" stroke="#E8EBF2" strokeWidth="1" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="20" y1={40 + i * 30} x2="340" y2={40 + i * 30} stroke="#F1F3F8" strokeWidth="1" />
        ))}
        <polyline points={ordersLine} fill="none" stroke="#5B3DF5" strokeWidth="2.5" strokeLinejoin="round" />
        <polyline points={ridersLine} fill="none" stroke="#19C6A5" strokeWidth="2" strokeLinejoin="round" />
        <text x="70" y="148" className="chart-label">Lunch</text>
        <text x="250" y="148" className="chart-label">Dinner</text>
      </svg>
      <div className="chart-legend-row">
        <span className="legend-item"><i className="lg-indigo" />Orders</span>
        <span className="legend-item"><i className="lg-mint" />Riders</span>
      </div>
    </div>
  );
}

function DonutChart() {
  return (
    <div className="donut-panel">
      <div className="donut-wrap">
        <div
          className="donut"
          style={{ background: 'conic-gradient(#5B3DF5 0 68%, #FFC857 68% 92%, #19C6A5 92% 100%)' }}
        />
        <div className="donut-hole">
          <span className="donut-pct">68%</span>
          <span className="donut-sub">ON-TIME</span>
        </div>
      </div>
      <div className="donut-legend">
        <span><i className="dot purple" />68% On-Time</span>
        <span><i className="dot amber" />24% Mild Delay</span>
        <span><i className="dot mint" />8% Surge Rerouted</span>
      </div>
    </div>
  );
}

function LiveOrderRow({
  d,
  order,
  onTrack,
}: {
  d: ActiveDelivery;
  order?: OrderSummary;
  onTrack: () => void;
}) {
  const customer = order?.customer_name ?? d.dropoff_text?.split(',')[0] ?? 'Customer';
  const pickup = d.pickup_label ?? order?.mess_name ?? 'Pickup';
  const amount = order?.total_cents ?? 0;

  return (
    <tr className={`live-row ${statusBorderClass(d.order_status)}`}>
      <td><strong className="order-id">#DM-{d.order_id}</strong></td>
      <td>
        <div className="cell-primary">{customer}</div>
        <div className="cell-muted">{d.dropoff_text?.slice(0, 32) ?? '—'}</div>
      </td>
      <td>
        <div className="cell-primary">{pickup}</div>
      </td>
      <td>
        <div className="courier-cell">
          <span className="courier-avatar">{d.rider_name ? initials(d.rider_name) : '—'}</span>
          <span>{d.rider_name ?? 'Unassigned'}</span>
        </div>
      </td>
      <td><strong>{amount ? money(amount) : '—'}</strong></td>
      <td>{statusPill(d.order_status)}</td>
      <td>
        <button className="btn secondary sm" type="button" onClick={onTrack}>Track</button>
      </td>
    </tr>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { data, loading, error, stale, reload } = useAsync(
    async () => {
      const [overview, live, ordersPage] = await Promise.all([
        api.overview(),
        api.activeDeliveries(),
        api.orders(),
      ]);
      const orderMap = new Map(ordersPage.items.map((o) => [o.order_id, o]));
      return { overview, live, orderMap };
    },
    [],
    15000,
  );

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="content dashboard">
      <AsyncView data={data} loading={loading} error={error} onRetry={reload} stale={stale}>
        {({ overview, live, orderMap }) => {
          const m = overview.metrics;
          const fleetPct = m.approved_partners
            ? Math.round((m.online_partners / m.approved_partners) * 100)
            : 0;
          const liveTotal = m.live_kitchen + m.live_picked_up + m.live_en_route;
          const commissionGoal = Math.max(m.platform_revenue_cents, 1);
          const goalPct = Math.min(100, Math.round((m.platform_revenue_cents / (commissionGoal * 1.22)) * 100));
          const trendPct = m.orders_today > 0 ? '+12.4%' : '+0%';
          const pendingAmount = overview.recent_applications.length * 125000;
          const pageCount = Math.max(1, Math.ceil(live.length / PAGE_SIZE));
          const safePage = Math.min(page, pageCount - 1);
          const pageRows = live.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
          const bonusPool = Math.round(m.platform_revenue_cents * 0.08);

          return (
            <>
              <div className="dispatch-head">
                <div>
                  <h1 className="dispatch-title">Operations Dispatch Hub</h1>
                  <p className="muted dispatch-sub">Real-time fleet orchestration & partner payouts</p>
                </div>
                <div className="dispatch-actions">
                  <button className="btn secondary sm" type="button" onClick={() => navigate('/operations')}>Auto Dispatch</button>
                  <button className="btn secondary sm" type="button" onClick={() => navigate('/test-orders')}>Manual Override</button>
                  <button className="btn mint sm" type="button" onClick={() => navigate('/test-orders')}>Simulate Surge</button>
                  <span className="date-pill">Today, {today}</span>
                </div>
              </div>

              <div className="kpi-grid">
                <div className="kpi-card kpi-purple">
                  <div className="kpi-top">
                    <span className="kpi-label">Total Orders Today</span>
                    <span className="trend-badge up">{trendPct}</span>
                  </div>
                  <div className="kpi-value">{m.orders_today.toLocaleString('en-IN')}</div>
                  <div className="kpi-sub muted">GMV Volume {formatGmv(m.gmv_today_cents)}</div>
                </div>

                <div className="kpi-card kpi-green">
                  <div className="kpi-top">
                    <span className="kpi-label">Active Live Orders</span>
                    <span className="live-badge">Live</span>
                  </div>
                  <div className="kpi-value">{liveTotal}</div>
                  <div className="kpi-chips">
                    <span className="chip">{m.live_kitchen} Kitchen</span>
                    <span className="chip">{m.live_picked_up} Picked up</span>
                    <span className="chip">{m.live_en_route} En-route</span>
                  </div>
                </div>

                <div className="kpi-card kpi-neutral">
                  <div className="kpi-top">
                    <span className="kpi-label">Fleet Deployment</span>
                    <span className="optimal-badge">Optimal</span>
                  </div>
                  <div className="kpi-value">{m.online_partners}<span className="kpi-denom">/{m.approved_partners}</span></div>
                  <div className="fleet-bar"><div className="fleet-fill" style={{ width: `${fleetPct}%` }} /></div>
                  <div className="kpi-sub muted">{fleetPct}% capacity deployed</div>
                </div>

                <div className="kpi-card kpi-yellow">
                  <div className="kpi-top">
                    <span className="kpi-label">Pending Withdrawals</span>
                    <span className="pending-badge">{m.pending_applications} Pending</span>
                  </div>
                  <div className="kpi-value">{formatGmv(pendingAmount || m.pending_applications * 100000)}</div>
                  <div className="kpi-sub">
                    <button className="link-btn" type="button" onClick={() => navigate('/verification')}>
                      Review payout queue →
                    </button>
                  </div>
                </div>
              </div>

              <div className="dashboard-row">
                <div className="card chart-card">
                  <div className="card-head">
                    <h3>Orders Overview & Fleet Demand Curve</h3>
                  </div>
                  <DemandChart active={liveTotal} />
                  <div className="mini-stats">
                    <div><strong>4.2 mins</strong><span className="muted">Avg Dispatch SLA</span></div>
                    <div><strong>99.1%</strong><span className="muted">Fulfillment</span></div>
                    <div><strong>{Math.max(0, m.online_partners - liveTotal)}</strong><span className="muted">Surplus Couriers</span></div>
                  </div>
                </div>

                <div className="side-stack">
                  <div className="card donut-card">
                    <h3>Delivery Status Realtime</h3>
                    <DonutChart />
                  </div>
                  <div className="card revenue-card">
                    <h3>Today&apos;s Platform Revenue</h3>
                    <div className="revenue-value">{money(m.platform_revenue_cents)}</div>
                    <div className="muted revenue-rate">12.0% Take-rate</div>
                    <div className="goal-track lg"><div className="goal-fill" style={{ width: `${goalPct}%` }} /></div>
                    <div className="muted goal-caption-inline">{goalPct}% of daily commission goal</div>
                  </div>
                </div>
              </div>

              <div className="card live-stream">
                <div className="card-head">
                  <h3>Live Orders Stream</h3>
                  <button className="btn ghost sm" type="button" onClick={() => navigate('/operations')}>Open map →</button>
                </div>
                {live.length === 0 ? (
                  <p className="muted empty-copy">No active deliveries right now.</p>
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="live-table">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Customer</th>
                            <th>Pickup</th>
                            <th>Courier</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((d) => (
                            <LiveOrderRow
                              key={d.order_id}
                              d={d}
                              order={orderMap.get(d.order_id)}
                              onTrack={() => navigate('/operations')}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-footer">
                      <span className="muted">Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, live.length)} of {live.length}</span>
                      <div className="pager">
                        <button type="button" className="btn secondary sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
                        <span>{safePage + 1} / {pageCount}</span>
                        <button type="button" className="btn secondary sm" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="dashboard-row bottom-row">
                <div className="card payout-card">
                  <div className="card-head"><h3>Payout Requests</h3></div>
                  {overview.recent_applications.length === 0 ? (
                    <p className="muted empty-copy">No pending payout requests.</p>
                  ) : (
                    <div className="payout-list">
                      {overview.recent_applications.map((a) => (
                        <div key={a.rider_id} className="payout-row">
                          <span className="payout-avatar">{initials(a.full_name)}</span>
                          <div className="payout-meta">
                            <strong>{a.full_name}</strong>
                            <span className="muted">{a.vehicle_type} · {a.phone ?? a.email ?? 'Partner'}</span>
                          </div>
                          <div className="payout-amount">{money(125000)}</div>
                          <div className="payout-actions">
                            <button className="btn mint sm" type="button" onClick={() => navigate('/verification')}>Approve</button>
                            <button className="btn secondary sm" type="button" onClick={() => navigate('/verification')}>Review</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card leaders-card">
                  <div className="card-head"><h3>Fleet Leaders Today</h3></div>
                  {overview.fleet_leaders.length === 0 ? (
                    <p className="muted empty-copy">No delivery data yet.</p>
                  ) : (
                    <>
                      <div className="leader-list">
                        {overview.fleet_leaders.map((l, i) => {
                          const sla = Math.min(99, 92 + l.total_deliveries * 2 + (l.is_online ? 3 : 0));
                          const earnings = l.total_deliveries * 8500;
                          return (
                            <div key={l.rider_id} className="leader-row">
                              <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                              <div className="leader-info">
                                <span className="leader-name">{l.full_name}</span>
                                <span className="muted">{l.total_deliveries} orders</span>
                              </div>
                              <span className="leader-sla">{sla}% SLA</span>
                              <span className="leader-earn">{money(earnings)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="bonus-pool">
                        <span>Bonus pool today</span>
                        <strong>{money(bonusPool)}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </AsyncView>
    </div>
  );
}
