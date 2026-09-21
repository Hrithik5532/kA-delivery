import { useEffect, useState } from 'react';
import { api, documentUrl, getToken } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { Page } from '@/components/Layout';
import { AsyncView, ReasonModal, StatusBadge } from '@/ui/kit';
import type { PartnerApplicationDetail } from '@/api/types';

const STATUSES = ['pending', 'submitted', 'under_review', 'needs_correction', 'approved', 'rejected'];

export function Verification() {
  const [status, setStatus] = useState('submitted');
  const [selected, setSelected] = useState<number | null>(null);
  const { data, loading, error, stale, reload } = useAsync(
    () => api.applications(status),
    [status],
    20000
  );

  return (
    <Page title="Partner verification">
      <div className="filters">
        <label className="muted">Status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <AsyncView
        data={data}
        loading={loading}
        error={error}
        onRetry={reload}
        stale={stale}
        isEmpty={(d) => d.items.length === 0}
        emptyTitle="No applications in this status"
      >
        {(d) => (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Vehicle</th>
                  <th>Docs</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.items.map((a) => (
                  <tr key={a.rider_id} className="clickable" onClick={() => setSelected(a.rider_id)}>
                    <td>
                      <strong>{a.full_name}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{a.email ?? a.phone}</div>
                    </td>
                    <td>{a.vehicle_type} · {a.vehicle_number}</td>
                    <td>{a.document_count}</td>
                    <td><StatusBadge status={a.approval_status} /></td>
                    <td><button className="btn secondary sm">Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
      {selected !== null && (
        <ApplicationDrawer
          riderId={selected}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </Page>
  );
}

function ApplicationDrawer({
  riderId,
  onClose,
  onChanged,
}: {
  riderId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [app, setApp] = useState<PartnerApplicationDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'reject' | 'correction'>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.application(riderId).then(setApp).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  const act = async (fn: () => Promise<PartnerApplicationDetail>) => {
    setBusy(true);
    setErr(null);
    try {
      setApp(await fn());
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        {!app ? (
          <p>Loading…</p>
        ) : (
          <>
            <div className="pageheader">
              <h3 style={{ margin: 0 }}>{app.full_name}</h3>
              <StatusBadge status={app.approval_status} />
            </div>
            {err && <div className="card" style={{ background: '#fee2e2', marginBottom: 12 }}>{err}</div>}
            <p className="muted" style={{ marginTop: 0 }}>
              {app.email ?? app.phone} · {app.vehicle_type} {app.vehicle_number} · Licence {app.license_number}
            </p>
            {app.correction_reason && (
              <div className="card" style={{ background: '#fff8e6', marginBottom: 12 }}>
                <strong>Correction requested:</strong> {app.correction_reason}
              </div>
            )}

            <h4>Documents ({app.documents.length})</h4>
            {app.documents.length === 0 ? (
              <p className="muted">No documents submitted yet.</p>
            ) : (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {app.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={`${documentUrl(doc.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="card"
                    style={{ flex: '0 0 auto', width: 150, textAlign: 'center' }}
                    onClick={async (e) => {
                      // Fetch with auth header, open as blob (endpoint requires Bearer).
                      e.preventDefault();
                      const r = await fetch(documentUrl(doc.id), {
                        headers: { Authorization: `Bearer ${getToken()}` },
                      });
                      if (r.ok) window.open(URL.createObjectURL(await r.blob()), '_blank');
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{doc.doc_type}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{doc.content_type}</div>
                  </a>
                ))}
              </div>
            )}

            <h4>History</h4>
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              {app.history.length === 0 ? (
                <p className="muted">No history yet.</p>
              ) : (
                app.history.map((h) => (
                  <div key={h.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0f1f5' }}>
                    <strong>{h.event_type}</strong> {h.detail && <span className="muted">· {h.detail}</span>}
                    {h.reason && <div className="muted">“{h.reason}”</div>}
                  </div>
                ))
              )}
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn secondary" disabled={busy} onClick={() => act(() => api.review(riderId))}>
                Start review
              </button>
              <button className="btn mint" disabled={busy} onClick={() => act(() => api.approve(riderId))}>
                Approve
              </button>
              <button className="btn secondary" disabled={busy} onClick={() => setModal('correction')}>
                Request correction
              </button>
              <button className="btn danger" disabled={busy} onClick={() => setModal('reject')}>
                Reject
              </button>
            </div>
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
      {modal === 'reject' && (
        <ReasonModal
          title="Reject application"
          confirmLabel="Reject"
          onConfirm={(reason) => act(() => api.reject(riderId, reason))}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'correction' && (
        <ReasonModal
          title="Request corrections"
          confirmLabel="Send request"
          onConfirm={(reason) => act(() => api.requestCorrection(riderId, reason))}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
