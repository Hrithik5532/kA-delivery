/** Salary: generate monthly invoices, adjust drafts, approve, mark paid, print. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Page } from '@/components/Layout';
import { useAsync } from '@/hooks/useAsync';
import { parseApiDate } from '@/lib/time';
import { money } from '@/theme';
import { AsyncView } from '@/ui/kit';
import type { SalaryGenerateResult, SalaryInvoice, SalaryStatus } from '@/api/types';

const CAN_EDIT = ['super_admin', 'operations'];
const STATUS_STYLE: Record<SalaryStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: '#f3f4f6', fg: '#4b5563', label: 'Draft' },
  approved: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Approved' },
  paid: { bg: '#dcfce7', fg: '#15803d', label: 'Paid' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c', label: 'Cancelled' },
};

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: SalaryStatus }) {
  const s = STATUS_STYLE[status];
  return <span className="badge" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

function fmtDate(iso: string | null) {
  return iso ? parseApiDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function Salary() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const canEdit = CAN_EDIT.includes(me?.admin_role ?? '');
  const [period, setPeriod] = useState(thisMonth());
  const [status, setStatus] = useState<SalaryStatus | ''>('');
  const { data, loading, error, stale, reload } = useAsync(
    () => api.salaryInvoices({ period, status: status || undefined }), [period, status],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SalaryGenerateResult | null>(null);

  const generate = async () => {
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await api.generateSalary(period)); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const approveAllDrafts = async () => {
    const drafts = (data?.items ?? []).filter((i) => i.status === 'draft');
    if (!drafts.length || !window.confirm(`Approve ${drafts.length} draft invoice(s)? Partners will see them in the app.`)) return;
    setBusy(true); setErr(null);
    try { for (const d of drafts) await api.approveSalaryInvoice(d.id); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); await reload(); }
    finally { setBusy(false); }
  };

  const totals = data?.totals ?? {};

  return (
    <Page title="Salary">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sal-month">Month</label>
            <input id="sal-month" type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sal-status">Status</label>
            <select id="sal-status" value={status} onChange={(e) => setStatus(e.target.value as SalaryStatus | '')}>
              <option value="">All</option>
              {(Object.keys(STATUS_STYLE) as SalaryStatus[]).map((s) => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }} />
          {canEdit && (
            <>
              <button className="btn secondary" disabled={busy} onClick={approveAllDrafts}>Approve all drafts</button>
              <button className="btn" disabled={busy} onClick={generate}>{busy ? 'Working…' : 'Generate invoices for month'}</button>
            </>
          )}
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          Generating creates a <strong>draft</strong> for every approved partner with a monthly salary set. Adjust drafts if needed, then
          approve — partners see approved and paid invoices in the app.
        </p>
      </div>

      {err && <div className="card" style={{ background: '#fee2e2', marginBottom: 12 }}>{err}</div>}
      {result && (
        <div className="card" style={{ background: '#f0fdf4', marginBottom: 12, fontSize: 13 }}>
          Created {result.created.length} invoice(s).
          {result.skipped.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {result.skipped.map((s) => <li key={s.rider_id}>{s.name}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="row" style={{ gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['draft', 'approved', 'paid'] as SalaryStatus[]).map((s) => (
          <div key={s} className="card" style={{ flex: 1, minWidth: 160 }}>
            <div className="muted" style={{ fontSize: 12 }}>{STATUS_STYLE[s].label}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{money(totals[s]?.net_cents ?? 0)}</div>
            <div className="muted" style={{ fontSize: 12 }}>{totals[s]?.count ?? 0} invoice(s)</div>
          </div>
        ))}
      </div>

      <AsyncView data={data} loading={loading} error={error} onRetry={reload} stale={stale} isEmpty={(d) => d.items.length === 0}
        emptyTitle="No invoices for this month yet.">
        {(d) => (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Invoice</th><th>Partner</th><th>Deliveries</th><th style={{ textAlign: 'right' }}>Net pay</th><th>Status</th><th /></tr></thead>
              <tbody>
                {d.items.map((i) => (
                  <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/salary/${i.id}`)}>
                    <td><strong>{i.invoice_number}</strong><div className="muted" style={{ fontSize: 12 }}>{i.period_label}</div></td>
                    <td>{i.rider_name}<div className="muted" style={{ fontSize: 12 }}>{i.partner_code ?? ''}</div></td>
                    <td>{i.deliveries_count} <span className="muted">· {i.days_active} days</span></td>
                    <td style={{ textAlign: 'right' }}><strong>{money(i.net_cents)}</strong></td>
                    <td><StatusBadge status={i.status} /></td>
                    <td style={{ textAlign: 'right' }}><button className="btn secondary sm">Open</button></td>
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

export function SalaryInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const id = Number(invoiceId);
  const navigate = useNavigate();
  const { me } = useAuth();
  const canEdit = CAN_EDIT.includes(me?.admin_role ?? '');
  const { data, loading, error, reload } = useAsync(() => api.salaryInvoice(id), [id]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); await reload(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  return (
    <Page title="Salary invoice" action={<button className="btn ghost sm no-print" onClick={() => navigate('/salary')}>← Back to salary</button>}>
      {err && <div className="card no-print" style={{ background: '#fee2e2', marginBottom: 12 }}>{err}</div>}
      <AsyncView data={data} loading={loading} error={error} onRetry={reload} isEmpty={(d) => !d}>
        {(inv) => (
          <>
            {canEdit && inv.status === 'draft' && <DraftEditor key={inv.id} inv={inv} busy={busy} onSave={(body) => act(() => api.updateSalaryInvoice(inv.id, body))} />}
            <div className="row no-print" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {canEdit && inv.status === 'draft' && (
                <button className="btn" disabled={busy} onClick={() => {
                  if (window.confirm(`Approve ${money(inv.net_cents)} for ${inv.rider_name}? The partner will see this invoice.`)) void act(() => api.approveSalaryInvoice(inv.id));
                }}>Approve</button>
              )}
              {canEdit && inv.status === 'approved' && (
                <button className="btn mint" disabled={busy} onClick={() => {
                  const ref = window.prompt('Bank / UPI transaction reference (UTR)');
                  if (ref && ref.trim().length >= 2) void act(() => api.paySalaryInvoice(inv.id, ref.trim()));
                }}>Mark as paid</button>
              )}
              {canEdit && (inv.status === 'draft' || inv.status === 'approved') && (
                <button className="btn danger" disabled={busy} onClick={() => {
                  const reason = window.prompt('Reason for cancelling this invoice');
                  if (reason && reason.trim().length >= 2) void act(() => api.cancelSalaryInvoice(inv.id, reason.trim()));
                }}>Cancel invoice</button>
              )}
              {canEdit && inv.status === 'cancelled' && (
                <button className="btn secondary" disabled={busy} onClick={() => {
                  if (window.confirm('Delete this cancelled invoice so the month can be generated again?')) void act(async () => { await api.deleteSalaryInvoice(inv.id); navigate('/salary'); });
                }}>Delete</button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn secondary" onClick={() => window.print()}>Print / Save PDF</button>
            </div>
            <InvoiceDocument inv={inv} />
          </>
        )}
      </AsyncView>
    </Page>
  );
}

function DraftEditor({ inv, busy, onSave }: { inv: SalaryInvoice; busy: boolean; onSave: (b: { base_salary_cents: number; additions_cents: number; deductions_cents: number; notes: string; refresh_activity: boolean }) => void }) {
  const r = (c: number) => String(c / 100);
  const [base, setBase] = useState(r(inv.base_salary_cents));
  const [add, setAdd] = useState(r(inv.additions_cents));
  const [ded, setDed] = useState(r(inv.deductions_cents));
  const [notes, setNotes] = useState(inv.notes);
  const num = (v: string) => (/^\d+(\.\d{1,2})?$/.test(v.trim()) ? Math.round(Number(v) * 100) : NaN);
  const vals = [num(base), num(add || '0'), num(ded || '0')];
  const valid = vals.every((v) => Number.isFinite(v));
  return (
    <div className="card no-print" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Adjust draft</h3>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="field"><label htmlFor="d-base">Base salary (₹)</label><input id="d-base" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} /></div>
        <div className="field"><label htmlFor="d-add">Additions (₹)</label><input id="d-add" inputMode="decimal" value={add} onChange={(e) => setAdd(e.target.value)} /></div>
        <div className="field"><label htmlFor="d-ded">Deductions (₹)</label><input id="d-ded" inputMode="decimal" value={ded} onChange={(e) => setDed(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="d-notes">Notes shown on the invoice</label><input id="d-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Festival bonus ₹500; uniform deduction ₹200" /></div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm" disabled={busy || !valid} onClick={() => onSave({ base_salary_cents: vals[0], additions_cents: vals[1], deductions_cents: vals[2], notes, refresh_activity: false })}>Save draft</button>
        <button className="btn secondary sm" disabled={busy} onClick={() => onSave({ base_salary_cents: inv.base_salary_cents, additions_cents: inv.additions_cents, deductions_cents: inv.deductions_cents, notes: inv.notes, refresh_activity: true })}>Refresh delivery count</button>
      </div>
      {!valid && <p style={{ color: '#dc2626', fontSize: 12 }}>Amounts must be rupees, e.g. 18000 or 250.50</p>}
    </div>
  );
}

function InvoiceDocument({ inv }: { inv: SalaryInvoice }) {
  return (
    <div className="card salary-doc">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Khana Delivery</div>
          <div className="muted">Salary invoice</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>{inv.invoice_number}</strong></div>
          <div className="muted">{inv.period_label}</div>
          <div style={{ marginTop: 4 }}><StatusBadge status={inv.status} /></div>
        </div>
      </div>
      <hr />
      <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12 }}>Paid to</div>
          <div><strong>{inv.rider_name}</strong> {inv.partner_code ? `(${inv.partner_code})` : ''}</div>
          {inv.rider_phone && <div>{inv.rider_phone}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12 }}>Bank / UPI</div>
          <div>{inv.bank_name || '—'}{inv.bank_account_masked ? ` ···· ${inv.bank_account_masked}` : ''}</div>
          {inv.ifsc_code && <div>IFSC {inv.ifsc_code}</div>}
          {inv.upi_id && <div>UPI {inv.upi_id}</div>}
        </div>
      </div>
      <table style={{ marginTop: 16 }}>
        <tbody>
          <tr><td>Monthly salary</td><td style={{ textAlign: 'right' }}>{money(inv.base_salary_cents)}</td></tr>
          <tr><td>Additions</td><td style={{ textAlign: 'right' }}>+ {money(inv.additions_cents)}</td></tr>
          <tr><td>Deductions</td><td style={{ textAlign: 'right' }}>− {money(inv.deductions_cents)}</td></tr>
          <tr><td><strong>Net pay</strong></td><td style={{ textAlign: 'right' }}><strong>{money(inv.net_cents)}</strong></td></tr>
        </tbody>
      </table>
      {inv.notes && <p style={{ marginTop: 12 }}><span className="muted">Notes:</span> {inv.notes}</p>}
      <p className="muted" style={{ fontSize: 12 }}>
        Activity: {inv.deliveries_count} deliveries over {inv.days_active} working days.
        {inv.approved_at && <> Approved {fmtDate(inv.approved_at)}{inv.approved_by ? ` by ${inv.approved_by}` : ''}.</>}
        {inv.paid_at && <> Paid {fmtDate(inv.paid_at)} · Ref {inv.payment_reference}.</>}
        {inv.cancelled_reason && <> Cancelled: {inv.cancelled_reason}.</>}
      </p>
    </div>
  );
}
