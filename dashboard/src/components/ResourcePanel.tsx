import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import type { Resource } from '../store/useDashboardStore';
import { useGPSTracker } from '../hooks/useGPSTracker';

const API_BASE = 'http://localhost:8080/api/v1';

const STATUS_COLOUR: Record<string, string> = {
  available: '#10b981', deployed: '#f59e0b', returning: '#3b82f6', maintenance: '#ef4444',
};
const TYPE_ICON: Record<string, string> = {
  boat: '🚤', medical: '➕', food: '🧃', rescue: '🪖', shelter: '🏕️',
};

export default function ResourcePanel() {
  const myNGO       = useDashboardStore(s => s.myNGO);
  const myResources = useDashboardStore(s => s.myResources);
  const addResource = useDashboardStore(s => s.addResource);
  const updateResource = useDashboardStore(s => s.updateResource);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ resource_id: '', name: '', type: 'boat', capacity: '10', lat: '', lng: '' });
  const [gpsLoading, setGPSLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function setField(k: string, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  function autoFillGPS() {
    if (!navigator.geolocation) return;
    setGPSLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setField('lat', pos.coords.latitude.toFixed(6));
        setField('lng', pos.coords.longitude.toFixed(6));
        setGPSLoading(false);
      },
      () => setGPSLoading(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  useEffect(() => {
    if (showForm && form.type === 'boat' && !form.lat && !form.lng) {
      autoFillGPS();
    }
  }, [showForm, form.type]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!myNGO || !form.resource_id || !form.lat || !form.lng) return;
    setSaving(true);

    const newRes: Resource = {
      resource_id: form.resource_id,
      ngo_id: myNGO.ngo_id,
      type: form.type as Resource['type'],
      name: form.name || form.resource_id,
      capacity: parseInt(form.capacity) || 10,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      status: 'available',
      assigned_crisis_id: null,
      battery_pct: 100,
      speed: 0,
      heading: 0,
      updated_at: new Date().toISOString(),
    };

    try {
      await fetch('http://localhost:8080/api/v1/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRes),
      });
    } catch { /* offline — still update local state */ }

    addResource(newRes);
    setForm({ resource_id: '', name: '', type: 'boat', capacity: '10', lat: '', lng: '' });
    setShowForm(false);
    setSaving(false);
  }

  async function patchStatus(id: string, status: Resource['status']) {
    updateResource(id, { status });
    try {
      await fetch(`http://localhost:8080/api/v1/resources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch { /* offline */ }
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>
          MY RESOURCES {myResources.length > 0 && <span style={{ color: '#f59e0b' }}>({myResources.length})</span>}
        </span>
        <button
          onClick={() => setShowForm(p => !p)}
          className="text-xs px-2 py-1 rounded font-medium"
          style={{ background: showForm ? '#374151' : '#1f2937', color: '#f59e0b', fontFamily: 'Rajdhani', letterSpacing: '0.05em' }}
        >
          {showForm ? '✕ CANCEL' : '+ ADD'}
        </button>
      </div>

      {/* Add resource form */}
      {showForm && (
        <form onSubmit={handleAdd} className="rounded p-3 flex flex-col gap-2 border" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex gap-2">
            <select value={form.type} onChange={e => { setField('type', e.target.value); if (e.target.value === 'boat') autoFillGPS(); }}
              className="flex-1 px-2 py-1.5 rounded text-xs"
              style={{ background: '#374151', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)' }}>
              {Object.entries(TYPE_ICON).map(([v, icon]) => <option key={v} value={v}>{icon} {v}</option>)}
            </select>
          </div>
          <input placeholder="Resource ID (e.g. BOAT_NK_01)" value={form.resource_id} onChange={e => setField('resource_id', e.target.value)}
            className="w-full px-2 py-1.5 rounded text-xs" style={{ background: '#374151', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)' }} />
          <input placeholder="Display name" value={form.name} onChange={e => setField('name', e.target.value)}
            className="w-full px-2 py-1.5 rounded text-xs" style={{ background: '#374151', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)' }} />
          <div className="flex gap-2 items-center">
            <input placeholder="Lat" value={form.lat} onChange={e => setField('lat', e.target.value)}
              className="flex-1 px-2 py-1.5 rounded text-xs" style={{ background: '#374151', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'JetBrains Mono' }} />
            <input placeholder="Lng" value={form.lng} onChange={e => setField('lng', e.target.value)}
              className="flex-1 px-2 py-1.5 rounded text-xs" style={{ background: '#374151', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'JetBrains Mono' }} />
            <button type="button" onClick={autoFillGPS} disabled={gpsLoading}
              className="px-2 py-1.5 rounded text-sm" style={{ background: '#374151', color: gpsLoading ? '#6b7280' : '#f59e0b' }}
              title="Use GPS location">
              {gpsLoading ? '⏳' : '📍'}
            </button>
          </div>
          <div className="flex gap-2">
            <input placeholder="Capacity" type="number" value={form.capacity} onChange={e => setField('capacity', e.target.value)}
              className="w-24 px-2 py-1.5 rounded text-xs" style={{ background: '#374151', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)' }} />
            <button type="submit" disabled={saving}
              className="flex-1 py-1.5 rounded text-xs font-bold tracking-wider"
              style={{ background: '#f59e0b', color: '#000', fontFamily: 'Rajdhani', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'ADDING…' : 'ADD TO OPERATIONS'}
            </button>
          </div>
        </form>
      )}

      {/* Resource list */}
      {myResources.length === 0 ? (
        <div className="text-xs text-center py-6" style={{ color: '#6b7280' }}>
          No resources added yet.<br />Click + ADD to register your first resource.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {myResources.map(r => (
            <ResourceCard key={r.resource_id} resource={r} ngoColour={myNGO?.colour ?? '#6b7280'} onPatch={patchStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceCard({ resource: r, ngoColour, onPatch }: { resource: Resource; ngoColour: string; onPatch: (id: string, s: Resource['status']) => void }) {
  const { tracking, accuracy, speed, heading, error, start, stop } = useGPSTracker(r.resource_id);
  const myNGO  = useDashboardStore(s => s.myNGO);
  const isBoat = r.type === 'boat';

  const [deviceLinked, setDeviceLinked] = useState<boolean | null>(null);
  const [deviceName, setDeviceName]   = useState<string | null>(null);
  const [deviceLastSeen, setDeviceLastSeen] = useState<string | null>(null);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [linking, setLinking] = useState(false);

  const checkDeviceLink = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/device/${r.resource_id}`);
      const data = await res.json();
      setDeviceLinked(data.linked);
      setDeviceName(data.device_name ?? null);
      setDeviceLastSeen(data.last_seen ?? null);
    } catch { setDeviceLinked(false); }
  }, [r.resource_id]);

  useEffect(() => {
    if (isBoat) checkDeviceLink();
  }, [isBoat, checkDeviceLink]);

  async function linkDevice() {
    if (!myNGO || !newDeviceName.trim()) return;
    setLinking(true);
    try {
      const res = await fetch(`${API_BASE}/device/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_id: r.resource_id,
          ngo_id: myNGO.ngo_id,
          device_name: newDeviceName.trim(),
        }),
      });
      const data = await res.json();
      setGeneratedToken(data.token);
      setDeviceLinked(true);
      setDeviceName(data.device_name);
    } catch { /* offline */ }
    setLinking(false);
  }

  function copyToken() {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  return (
    <div className="rounded p-3 border" style={{ background: '#1f2937', borderColor: tracking ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.07)', borderLeft: `3px solid ${ngoColour}` }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>
          {TYPE_ICON[r.type]} {r.resource_id}
        </span>
        <div className="flex items-center gap-1.5">
          {tracking && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded animate-pulse"
              style={{ background: '#10b98122', color: '#10b981', fontFamily: 'Rajdhani', fontSize: 9 }}>
              🛰 LIVE GPS
            </span>
          )}
          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: STATUS_COLOUR[r.status] + '22', color: STATUS_COLOUR[r.status], fontFamily: 'Rajdhani' }}>
            ● {r.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>{r.name} | Cap: {r.capacity} | Bat: {r.battery_pct}%</div>

      {/* Position row — live if tracking */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: tracking ? '#10b981' : '#6b7280', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
          {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
        </span>
        {tracking && accuracy != null && (
          <span className="text-xs" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono', fontSize: 10 }}>±{accuracy}m</span>
        )}
      </div>

      {/* Speed + heading when tracking a boat */}
      {tracking && isBoat && (speed != null || heading != null) && (
        <div className="flex gap-3 mb-1.5">
          {speed != null && (
            <span className="text-xs" style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono', fontSize: 10 }}>⚡ {speed} km/h</span>
          )}
          {heading != null && (
            <span className="text-xs" style={{ color: '#3b82f6', fontFamily: 'JetBrains Mono', fontSize: 10 }}>🧭 {heading}°</span>
          )}
        </div>
      )}

      {/* GPS error */}
      {error && (
        <div className="text-xs mb-1.5 px-2 py-1 rounded" style={{ background: '#ef444422', color: '#ef4444', fontSize: 10 }}>
          ⚠ {error}
        </div>
      )}

      {r.assigned_crisis_id && (
        <div className="text-xs mb-2" style={{ color: '#f59e0b' }}>→ Crisis: {r.assigned_crisis_id}</div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {isBoat && (
          <button
            onClick={tracking ? stop : start}
            className="px-2 py-1 rounded text-xs font-bold"
            style={{
              background: tracking ? '#10b98133' : '#1f2937',
              color: tracking ? '#10b981' : '#9ca3af',
              border: `1px solid ${tracking ? '#10b98155' : 'rgba(255,255,255,0.1)'}`,
              fontFamily: 'Rajdhani',
            }}>
            {tracking ? '🛰 STOP GPS' : '🛰 TRACK GPS'}
          </button>
        )}
        {r.status !== 'available' && (
          <button onClick={() => onPatch(r.resource_id, 'available')}
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: '#10b98122', color: '#10b981', fontFamily: 'Rajdhani' }}>
            Mark Available
          </button>
        )}
        {r.status !== 'deployed' && (
          <button onClick={() => onPatch(r.resource_id, 'deployed')}
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: '#f59e0b22', color: '#f59e0b', fontFamily: 'Rajdhani' }}>
            Deploy
          </button>
        )}
      </div>

      {/* Hardware device section — boats only */}
      {isBoat && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani', color: '#6b7280', letterSpacing: '0.06em' }}>
              HARDWARE DEVICE
            </span>
            {deviceLinked !== null && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ background: deviceLinked ? '#3b82f622' : '#37414133', color: deviceLinked ? '#3b82f6' : '#6b7280', fontFamily: 'Rajdhani', fontSize: 9 }}>
                {deviceLinked ? '🔗 LINKED' : 'NOT LINKED'}
              </span>
            )}
          </div>

          {deviceLinked && deviceName && (
            <div className="text-xs mb-1.5" style={{ color: '#9ca3af', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
              {deviceName}
              {deviceLastSeen && (
                <span style={{ color: '#6b7280' }}> · last seen {new Date(deviceLastSeen).toLocaleTimeString()}</span>
              )}
            </div>
          )}

          <button
            onClick={() => setShowLinkPanel(p => !p)}
            className="w-full py-1 rounded text-xs font-bold"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', fontFamily: 'Rajdhani' }}>
            {showLinkPanel ? '✕ CANCEL' : deviceLinked ? '🔧 REPLACE DEVICE' : '+ LINK HARDWARE DEVICE'}
          </button>

          {showLinkPanel && !generatedToken && (
            <div className="mt-2 flex flex-col gap-1.5">
              <input
                placeholder="Device name (e.g. RPi-Boat-01)"
                value={newDeviceName}
                onChange={e => setNewDeviceName(e.target.value)}
                className="w-full px-2 py-1.5 rounded text-xs"
                style={{ background: '#374151', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button
                onClick={linkDevice}
                disabled={linking || !newDeviceName.trim()}
                className="w-full py-1.5 rounded text-xs font-bold"
                style={{ background: '#3b82f6', color: '#fff', fontFamily: 'Rajdhani', opacity: linking || !newDeviceName.trim() ? 0.5 : 1 }}>
                {linking ? 'GENERATING TOKEN…' : 'GENERATE API TOKEN'}
              </button>
            </div>
          )}

          {generatedToken && (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="text-xs px-2 py-1.5 rounded select-all break-all"
                style={{ background: '#0f172a', color: '#10b981', fontFamily: 'JetBrains Mono', fontSize: 10, border: '1px solid rgba(16,185,129,0.3)' }}>
                {generatedToken}
              </div>
              <button onClick={copyToken}
                className="w-full py-1.5 rounded text-xs font-bold"
                style={{ background: tokenCopied ? '#10b98133' : '#374151', color: tokenCopied ? '#10b981' : '#f9fafb', fontFamily: 'Rajdhani' }}>
                {tokenCopied ? '✓ COPIED' : '📋 COPY TOKEN'}
              </button>
              <div className="text-xs px-1" style={{ color: '#6b7280', fontSize: 9, lineHeight: 1.4 }}>
                Flash this token onto the device. It will not be shown again.
                The device must send it as the <span style={{ color: '#9ca3af' }}>X-Device-Token</span> header.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
