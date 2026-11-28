/** Edit a partner: only fields the backend stores (nothing decorative). */
import { parseApiDate } from '@/lib/time';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import type { PartnerDetail, PartnerUpdatePayload } from '@/api/types';
import { AsyncView } from '@/ui/kit';
import { PartnerSlotsPanel } from '@/pages/ShiftSlots';

const VEHICLE_OPTIONS = [
  { id: 'bike', label: 'Motorcycle' },
  { id: 'scooter', label: 'Scooter / EV' },
  { id: 'bicycle', label: 'Bicycle' },
  { id: 'three_wheeler', label: 'Three-wheeler' },
];

function fmt(iso: string | null) {
  if (!iso) return '—';
  return parseApiDate(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildForm(p: PartnerDetail): PartnerUpdatePayload {
  return {
    full_name: p.full_name,
    phone: p.phone ?? '',
    email: p.email ?? p.contact_email ?? '',
    emergency_contact: p.emergency_contact,
    operating_hub: p.operating_hub,
    fleet_tier: p.fleet_tier ?? '',
    monthly_salary_cents: p.monthly_salary_cents ?? null,
    bank_name: p.bank_name,
    bank_account_masked: p.bank_account_masked,
    ifsc_code: p.ifsc_code,
    upi_id: p.upi_id ?? '',
    upi_linked: p.upi_linked,
    vehicle_model: p.vehicle_model,
    vehicle_number: p.vehicle_number,
    license_number: p.license_number,
    vehicle_type: p.vehicle_type,
  };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="pe-field-row">
      <label>{label}</label>
      {children}
      {hint && <span className="pe-hint muted">{hint}</span>}
    </div>
  );
}

export function PartnerEdit() {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const id = Number(riderId);
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerUpdatePayload>({});
  const [salaryRupees, setSalaryRupees] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState('');

  const load = () => {
    setLoading(true);
    api.partner(id).then((p) => {
      setPartner(p);
      setForm(buildForm(p));
      setSalaryRupees(p.monthly_salary_cents != null ? String(p.monthly_salary_cents / 100) : '');
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { if (Number.isFinite(id)) load(); /* eslint-disable-next-line */ }, [id]);

  const set = <K extends keyof PartnerUpdatePayload>(key: K, value: PartnerUpdatePayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const salaryValid = salaryRupees.trim() === '' || (/^\d+(\.\d{1,2})?$/.test(salaryRupees.trim()) && Number(salaryRupees) <= 1_000_000);

  const dirty = useMemo(() => {
    if (!partner) return false;
    const salary = salaryRupees.trim() ? Math.round(Number(salaryRupees) * 100) : null;
    return JSON.stringify({ ...form, monthly_salary_cents: salary }) !== JSON.stringify(buildForm(partner));
  }, [partner, form, salaryRupees]);

  const discard = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    navigate(`/partners/${id}`);
  };

  const submit = async () => {
    if (!partner) return;
    if (!salaryValid) { setSaveErr('Enter the monthly salary as a rupee amount, e.g. 18000'); return; }
    if (!changeReason.trim()) { setSaveErr('Please give a reason for these changes.'); return; }
    setBusy(true);
    setSaveErr(null);
    try {
      const salary = salaryRupees.trim() ? Math.round(Number(salaryRupees) * 100) : 0;
      await api.updatePartner(id, { ...form, monthly_salary_cents: salary });
      await api.addPartnerNote(id, `Profile edit: ${changeReason.trim()}`);
      navigate(`/partners/${id}`);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  };

  return (
    <div className="content pe-page">
      <AsyncView data={partner} loading={loading} error={error} onRetry={load} isEmpty={(d) => !d}>
        {(p) => (
          <>
            <div className="pe-breadcrumb">
              <Link to="/partners">DELIVERY PARTNERS</Link>
              <span>›</span>
              <Link to={`/partners/${id}`}>{p.full_name.toUpperCase()}</Link>
              <span>›</span>
              <strong>EDIT</strong>
            </div>

            <div className="pe-head">
              <div>
                <h1 className="pe-title">Edit partner — {p.full_name}</h1>
                <div className="pe-badges">
                  {p.account_active
                    ? <span className="pp-badge pp-badge-green">Active</span>
                    : <span className="pp-badge pp-badge-red">Suspended</span>}
                  <span className="pp-badge">{p.approval_status.replace(/_/g, ' ')}</span>
                </div>
              </div>
              <div className="pe-head-actions">
                <button type="button" className="btn secondary sm" onClick={discard}>Cancel</button>
                <button type="button" className="btn primary sm" onClick={submit} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
              </div>
            </div>

            {saveErr && <div className="card profile-alert">{saveErr}</div>}

            <div className="pe-form-stack">
              <section className="pe-section">
                <div className="pe-section-label"><span className="pe-section-num">1</span> Contact</div>
                <div className="pe-section-body">
                  <div className="pe-fields pe-fields-grid">
                    <Field label="Full name"><input value={form.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} /></Field>
                    <Field label="Mobile (used for app login)" hint="Login codes are generated for this number">
                      <input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
                    </Field>
                    <Field label="Emergency contact"><input value={form.emergency_contact ?? ''} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="Name & number" /></Field>
                    <Field label="Email"><input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <div className="pe-section-label"><span className="pe-section-num">2</span> Vehicle &amp; hub</div>
                <div className="pe-section-body">
                  <div className="pe-fields pe-fields-grid">
                    <Field label="Vehicle type">
                      <select value={form.vehicle_type ?? ''} onChange={(e) => set('vehicle_type', e.target.value)}>
                        {VEHICLE_OPTIONS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        {form.vehicle_type && !VEHICLE_OPTIONS.some((v) => v.id === form.vehicle_type) && <option value={form.vehicle_type}>{form.vehicle_type}</option>}
                      </select>
                    </Field>
                    <Field label="Make / model"><input value={form.vehicle_model ?? ''} onChange={(e) => set('vehicle_model', e.target.value)} /></Field>
                    <Field label="Registration number"><input value={form.vehicle_number ?? ''} onChange={(e) => set('vehicle_number', e.target.value.toUpperCase())} /></Field>
                    <Field label="Driving licence no."><input value={form.license_number ?? ''} onChange={(e) => set('license_number', e.target.value)} /></Field>
                    <Field label="Operating hub"><input value={form.operating_hub ?? ''} onChange={(e) => set('operating_hub', e.target.value)} /></Field>
                    <Field label="Fleet tier"><input value={form.fleet_tier ?? ''} onChange={(e) => set('fleet_tier', e.target.value)} /></Field>
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <div className="pe-section-label"><span className="pe-section-num">3</span> Salary &amp; bank</div>
                <div className="pe-section-body">
                  <div className="pe-fields pe-fields-grid">
                    <Field label="Monthly salary (₹)" hint="Used when generating monthly salary invoices">
                      <input inputMode="decimal" value={salaryRupees} onChange={(e) => setSalaryRupees(e.target.value)} placeholder="e.g. 18000" />
                    </Field>
                    <Field label="Bank"><input value={form.bank_name ?? ''} onChange={(e) => set('bank_name', e.target.value)} /></Field>
                    <Field label="IFSC"><input value={form.ifsc_code ?? ''} onChange={(e) => set('ifsc_code', e.target.value.toUpperCase())} maxLength={11} /></Field>
                    <Field label="Account number (last 4 digits)">
                      <input inputMode="numeric" value={form.bank_account_masked ?? ''} maxLength={4}
                        onChange={(e) => set('bank_account_masked', e.target.value.replace(/\D/g, '').slice(0, 4))} />
                    </Field>
                    <Field label="UPI ID"><input value={form.upi_id ?? ''} onChange={(e) => set('upi_id', e.target.value)} placeholder="name@bank" /></Field>
                  </div>
                  {!salaryValid && <p style={{ color: '#dc2626', fontSize: 12 }}>Enter a rupee amount, e.g. 18000</p>}
                </div>
              </section>

              <section className="pe-section">
                <div className="pe-section-label"><span className="pe-section-num">4</span> Working slots</div>
                <div className="pe-section-body"><PartnerSlotsPanel riderId={p.rider_id} /></div>
              </section>

              <section className="pe-section">
                <div className="pe-section-label"><span className="pe-section-num">5</span> Reason &amp; audit trail</div>
                <div className="pe-section-body">
                  <div className="pe-field-row pe-field-full">
                    <label>Reason for changes <span className="pe-required">*</span></label>
                    <textarea rows={3} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} maxLength={500}
                      placeholder="Why are these details changing? (saved to the partner's file)" />
                  </div>
                  <div className="pe-audit-log">
                    <div className="pe-sub-label">Recent changes</div>
                    {p.history.length === 0 ? (
                      <p className="muted">No changes recorded.</p>
                    ) : p.history.slice(0, 5).map((ev) => (
                      <div key={ev.id} className="pe-audit-item">
                        <div><strong>{ev.event_type.replace(/_/g, ' ')}</strong> — {ev.detail || ev.reason || '—'}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{fmt(ev.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </AsyncView>
    </div>
  );
}
