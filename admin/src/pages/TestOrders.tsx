import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { Page } from '@/components/Layout';
import { AsyncView } from '@/ui/kit';
import { GooglePlaceSearch } from '@/components/GooglePlaceSearch';
import { MapView, type MapMarker } from '@/components/MapView';
import { fetchRoadRoute } from '@/lib/directions';
import { config } from '@/config';
import type { TestDelivery } from '@/api/types';

type Pt = { lat: number; lng: number };

function isValidCoord(n: number) {
  return Number.isFinite(n);
}

function kmBetween(a: Pt, b: Pt) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function TestOrders() {
  return (
    <Page title="Create Test Delivery">
      <div className="card" style={{ background: '#fff8e6', borderColor: '#fde68a', marginBottom: 16 }}>
        <strong>Test tool.</strong> This creates <b>clearly-marked TEST deliveries</b> for exercising delivery
        operations. It is <b>not</b> a customer checkout — no real customer account, payment, or notifications are involved.
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}><CreateForm /></div>
        <div style={{ flex: 1 }}><TestList /></div>
      </div>
    </Page>
  );
}

function CreateForm() {
  const [picking, setPicking] = useState<'pickup' | 'dropoff'>('pickup');
  const [pickup, setPickup] = useState<Pt>({ lat: config.mapCenter[0], lng: config.mapCenter[1] });
  const [dropoff, setDropoff] = useState<Pt>({ lat: config.mapCenter[0] + 0.01, lng: config.mapCenter[1] + 0.01 });
  const [form, setForm] = useState({
    pickup_label: 'Test Kitchen',
    dropoff_label: 'Test Drop-off',
    customer_name: '',
    customer_contact: '',
    pickup_instructions: '',
    delivery_instructions: '',
  });
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const activePt = picking === 'pickup' ? pickup : dropoff;
  const setActivePt = picking === 'pickup' ? setPickup : setDropoff;
  const activeLabelKey = picking === 'pickup' ? 'pickup_label' : 'dropoff_label';

  const onPick = (lat: number, lng: number) => setActivePt({ lat, lng });

  const onPlaceSelect = (place: { lat: number; lng: number; label: string; address: string }) => {
    setActivePt({ lat: place.lat, lng: place.lng });
    set(activeLabelKey, place.label);
    if (picking === 'pickup' && !form.pickup_instructions && place.address) {
      set('pickup_instructions', place.address);
    }
    if (picking === 'dropoff' && !form.delivery_instructions && place.address) {
      set('delivery_instructions', place.address);
    }
    setSearchKey((k) => k + 1);
  };

  const mapCenter = useMemo<[number, number]>(() => [activePt.lat, activePt.lng], [activePt.lat, activePt.lng]);
  const fitPoints = useMemo<[number, number][]>(
    () => [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]],
    [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng],
  );
  const fitKey = `${pickup.lat},${pickup.lng}|${dropoff.lat},${dropoff.lng}|${picking}`;

  // Straight line shown immediately; upgraded to the shortest road route once OSRM responds.
  const straightLine = useMemo<[number, number][]>(
    () => [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]],
    [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng],
  );
  const [roadRoute, setRoadRoute] = useState<[number, number][] | null>(null);

  useEffect(() => {
    if (!isValidCoord(pickup.lat) || !isValidCoord(dropoff.lat)) {
      setRoadRoute(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetchRoadRoute(pickup, dropoff, controller.signal).then((res) => {
        setRoadRoute(res && res.points.length > 1 ? res.points : null);
      });
    }, 350); // debounce rapid map clicks / edits
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  const markers: MapMarker[] = [
    { ...pickup, kind: 'pickup', label: form.pickup_label, selected: picking === 'pickup' },
    { ...dropoff, kind: 'dropoff', label: form.dropoff_label, selected: picking === 'dropoff' },
  ];

  const submit = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const created = await api.createTestOrder({
        ...form,
        pickup_lat: pickup.lat, pickup_lng: pickup.lng,
        dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      });
      setMsg(`Created TEST order #${created.order_id} (OTP ${created.otp_code}).`);
      setReview(false);
      window.dispatchEvent(new CustomEvent('testorders:refresh'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const defaultDrop = useMemo(
    () => ({ lat: config.mapCenter[0] + 0.01, lng: config.mapCenter[1] + 0.01 }),
    [],
  );
  const dropoffLooksUnset = kmBetween(dropoff, defaultDrop) < 0.05 && kmBetween(pickup, dropoff) > 50;

  const pickingLabel = picking === 'pickup' ? 'pickup (restaurant / kitchen)' : 'drop-off (customer)';

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>New test delivery</h3>
      {msg && <div className="card" style={{ background: '#dcfce7', marginBottom: 12 }}>{msg}</div>}
      {err && <div className="card" style={{ background: '#fee2e2', marginBottom: 12 }}>{err}</div>}
      {dropoffLooksUnset && (
        <div className="card" style={{ background: '#fff8e6', borderColor: '#fde68a', marginBottom: 12 }}>
          Drop-off coordinates still look like the default map center. Switch to <b>Set drop-off</b>, search the customer address, and confirm lat/lng before creating.
        </div>
      )}

      <div className="row" style={{ marginBottom: 8 }}>
        <button className={`btn sm ${picking === 'pickup' ? '' : 'secondary'}`} onClick={() => setPicking('pickup')}>
          ● Set pickup
        </button>
        <button className={`btn sm ${picking === 'dropoff' ? 'mint' : 'secondary'}`} onClick={() => setPicking('dropoff')}>
          ● Set drop-off
        </button>
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Search Google Maps — {pickingLabel}</label>
        <GooglePlaceSearch
          key={`${picking}-${searchKey}`}
          placeholder={`Search restaurant, cafe, or address for ${picking}…`}
          onSelect={onPlaceSelect}
        />
        <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
          Pick a result to set coordinates and label. You can also click the map or edit lat/lng below — everything stays in sync.
        </p>
      </div>

      <div style={{ marginBottom: 12 }}>
        <MapView
          markers={markers}
          height={300}
          onPick={onPick}
          center={mapCenter}
          fitPoints={fitPoints}
          fitKey={fitKey}
          route={roadRoute ?? straightLine}
        />
      </div>

      <PointFields
        label="Pickup"
        pt={pickup}
        onChange={setPickup}
        labelValue={form.pickup_label}
        onLabel={(v) => set('pickup_label', v)}
        active={picking === 'pickup'}
        onFocus={() => setPicking('pickup')}
      />
      <div className="field"><label>Pickup instructions</label><input value={form.pickup_instructions} onChange={(e) => set('pickup_instructions', e.target.value)} /></div>
      <PointFields
        label="Drop-off"
        pt={dropoff}
        onChange={setDropoff}
        labelValue={form.dropoff_label}
        onLabel={(v) => set('dropoff_label', v)}
        active={picking === 'dropoff'}
        onFocus={() => setPicking('dropoff')}
      />
      <div className="field"><label>Delivery instructions</label><input value={form.delivery_instructions} onChange={(e) => set('delivery_instructions', e.target.value)} /></div>
      <div className="row">
        <div className="field"><label>Test customer name (optional)</label><input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} /></div>
        <div className="field"><label>Contact placeholder (optional)</label><input value={form.customer_contact} onChange={(e) => set('customer_contact', e.target.value)} /></div>
      </div>

      {!review ? (
        <button className="btn" onClick={() => setReview(true)} disabled={!isValidCoord(pickup.lat) || !isValidCoord(dropoff.lat) || dropoffLooksUnset}>Review & create</button>
      ) : (
        <div className="card" style={{ background: '#eeeafe' }}>
          <strong>Review</strong>
          <ul style={{ fontSize: 13 }}>
            <li>Pickup: {form.pickup_label} ({pickup.lat.toFixed(5)}, {pickup.lng.toFixed(5)})</li>
            <li>Drop-off: {form.dropoff_label} ({dropoff.lat.toFixed(5)}, {dropoff.lng.toFixed(5)})</li>
            {form.customer_name && <li>Customer: {form.customer_name} {form.customer_contact}</li>}
          </ul>
          <div className="row">
            <button className="btn secondary" onClick={() => setReview(false)} disabled={busy}>Back</button>
            <button className="btn mint" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create TEST delivery'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PointFields({
  label,
  pt,
  onChange,
  labelValue,
  onLabel,
  active,
  onFocus,
}: {
  label: string;
  pt: Pt;
  onChange: (p: Pt) => void;
  labelValue: string;
  onLabel: (v: string) => void;
  active?: boolean;
  onFocus?: () => void;
}) {
  return (
    <div className={`dm-point-fields${active ? ' dm-point-fields-active' : ''}`} onFocus={onFocus}>
      <div className="field"><label>{label} label</label><input value={labelValue} onChange={(e) => onLabel(e.target.value)} onFocus={onFocus} /></div>
      <div className="row">
        <div className="field">
          <label>{label} latitude</label>
          <input
            type="number"
            step="0.00001"
            value={pt.lat}
            onFocus={onFocus}
            onChange={(e) => {
              const lat = Number(e.target.value);
              if (Number.isFinite(lat)) onChange({ ...pt, lat });
            }}
          />
        </div>
        <div className="field">
          <label>{label} longitude</label>
          <input
            type="number"
            step="0.00001"
            value={pt.lng}
            onFocus={onFocus}
            onChange={(e) => {
              const lng = Number(e.target.value);
              if (Number.isFinite(lng)) onChange({ ...pt, lng });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TestList() {
  const { data, loading, error, stale, reload } = useAsync(() => api.testOrders(), [], config.liveTrackingPollMs);
  useEffect(() => {
    const h = () => reload();
    window.addEventListener('testorders:refresh', h);
    return () => window.removeEventListener('testorders:refresh', h);
  }, [reload]);
  const { data: partners } = useAsync(() => api.partners({ status: 'approved' }), []);

  return (
    <div className="card">
      <div className="pageheader"><h3 style={{ margin: 0 }}>Test deliveries</h3><button className="btn secondary sm" onClick={reload}>Refresh</button></div>
      <AsyncView data={data} loading={loading} error={error} onRetry={reload} stale={stale} isEmpty={(d) => d.items.length === 0} emptyTitle="No test deliveries yet">
        {(d) => (
          <div>
            {d.items.map((t) => (
              <TestRow key={t.order_id} t={t} partnerIds={(partners?.items ?? []).map((p) => ({ id: p.rider_id, name: p.full_name }))} onChanged={reload} />
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  );
}

function TestRow({ t, partnerIds, onChanged }: { t: TestDelivery; partnerIds: { id: number; name: string }[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rider, setRider] = useState<number | ''>('');
  const [err, setErr] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); onChanged(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  const terminal = t.status === 'delivered' || t.status === 'cancelled';
  const next = { placed: 'accept', accepted: 'prepare', preparing: 'ready' }[t.status];

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>#{t.order_id} <span className="badge test">TEST</span></strong>
        <span className="muted">{t.status}{t.delivery_status ? ` / ${t.delivery_status}` : ''}</span>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{t.pickup_label} → {t.dropoff_label} · OTP {t.otp_code ?? '—'} · {t.rider_name ?? 'unassigned'}</div>
      {err && <div style={{ color: '#b91c1c', fontSize: 12 }}>{err}</div>}
      {!terminal && (
        <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
          {next && <button className="btn sm" disabled={busy} onClick={() => act(() => api.advanceTestOrder(t.order_id, next))}>Advance → {next}</button>}
          <select value={rider} onChange={(e) => setRider(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Assign to…</option>
            {partnerIds.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn secondary sm" disabled={busy || rider === ''} onClick={() => act(() => api.assignTestOrder(t.order_id, rider as number))}>Assign</button>
          <button className="btn danger sm" disabled={busy} onClick={() => act(() => api.cancelTestOrder(t.order_id))}>Cancel</button>
        </div>
      )}
    </div>
  );
}
