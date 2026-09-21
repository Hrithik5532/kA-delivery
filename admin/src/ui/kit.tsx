import type { ReactNode } from 'react';
import { useState } from 'react';
import { approvalMeta } from '@/theme';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state">
      <div className="spinner" />
      {label}
    </div>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <div className="err">⚠ {message}</div>
      {onRetry && (
        <button className="btn secondary sm" style={{ marginTop: 12 }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyView({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="state">
      <div style={{ fontWeight: 700, color: '#374151' }}>{title}</div>
      {subtitle && <div style={{ marginTop: 6 }}>{subtitle}</div>}
    </div>
  );
}

/** Wraps async view state: loading / error / empty / content. `stale` shows a banner. */
export function AsyncView<T>({
  data,
  loading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  stale,
  children,
}: {
  data: T | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  isEmpty?: (d: T) => boolean;
  emptyTitle?: string;
  stale?: boolean;
  children: (d: T) => ReactNode;
}) {
  if (loading && data === null) return <Loading />;
  if (error && data === null) return <ErrorView message={error} onRetry={onRetry} />;
  if (data === null) return <Loading />;
  if (isEmpty && isEmpty(data)) return <EmptyView title={emptyTitle} />;
  return (
    <>
      {stale && (
        <div className="card" style={{ background: '#fef3c7', borderColor: '#fde68a', marginBottom: 12 }}>
          Showing last known data — reconnecting…
        </div>
      )}
      {error && (
        <div className="card" style={{ background: '#fee2e2', borderColor: '#fecaca', marginBottom: 12 }}>
          {error}
        </div>
      )}
      {children(data)}
    </>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta = approvalMeta[status];
  const color = meta?.color ?? '#6b7280';
  const soft = meta?.soft ?? '#e5e7eb';
  return (
    <span className="badge" style={{ background: soft, color }}>
      {meta?.label ?? status}
    </span>
  );
}

export function TestBadge() {
  return <span className="badge test">TEST</span>;
}

/** Simple confirm/prompt modal with an optional required reason. */
export function ReasonModal({
  title,
  confirmLabel,
  requireReason,
  onConfirm,
  onClose,
}: {
  title: string;
  confirmLabel: string;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed');
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {err && <div className="card" style={{ background: '#fee2e2', marginBottom: 12 }}>{err}</div>}
        {(requireReason ?? true) && (
          <div className="field">
            <label>Reason (recorded in the audit log)</label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={submit}
            disabled={busy || ((requireReason ?? true) && !reason.trim())}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
