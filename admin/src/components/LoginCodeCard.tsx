/** Ops generate a one-time app login code for a partner (no SMS gateway). */
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { parseApiDate } from '@/lib/time';
import type { PartnerLoginCode } from '@/api/types';

const CAN_ISSUE = ['super_admin', 'operations', 'partner_verification'];

export function LoginCodeCard({ riderId, name, suspended }: { riderId: number; name: string; suspended: boolean }) {
  const { me } = useAuth();
  const [issued, setIssued] = useState<PartnerLoginCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!issued) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [issued]);

  if (!CAN_ISSUE.includes(me?.admin_role ?? '')) return null;

  const generate = async () => {
    setBusy(true); setErr(null); setCopied(false);
    try { setIssued(await api.partnerLoginCode(riderId)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not generate a code'); }
    finally { setBusy(false); }
  };

  const expiresAt = issued ? parseApiDate(issued.expires_at).getTime() : 0;
  const left = Math.max(0, Math.round((expiresAt - now) / 1000));
  const expired = issued != null && left === 0;
  const message = issued
    ? `Your KA Delivery login code is ${issued.code}. Open the app, enter your phone number ${issued.phone} and this code. Valid for ${issued.valid_minutes} minutes. Do not share it with anyone.`
    : '';
  const waNumber = issued ? issued.phone.replace(/[^0-9]/g, '') : '';

  const copy = async () => {
    try { await navigator.clipboard.writeText(issued?.code ?? ''); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>App login code</h3>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Generate a one-time code for {name} to sign in on the partner app with their phone number.
        Share it only with the partner (call or WhatsApp).
      </p>
      {err && <div className="card" style={{ background: '#fee2e2', marginBottom: 8, fontSize: 13 }}>{err}</div>}
      {issued && !expired && (
        <div style={{ textAlign: 'center', margin: '8px 0 12px' }}>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 10, fontFamily: 'monospace' }}>{issued.code}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            For {issued.phone} · expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} · works once
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <button className="btn secondary sm" onClick={copy}>{copied ? 'Copied' : 'Copy code'}</button>
            {waNumber && (
              <a className="btn mint sm" target="_blank" rel="noreferrer"
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}>
                Send on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
      {expired && <p className="muted" style={{ fontSize: 12 }}>That code has expired. Generate a new one.</p>}
      <button className="btn sm" style={{ width: '100%' }} disabled={busy || suspended} onClick={generate}
        title={suspended ? 'Reactivate the partner first' : undefined}>
        {busy ? 'Generating…' : issued ? 'Generate new code' : 'Generate login code'}
      </button>
    </div>
  );
}
