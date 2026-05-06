import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import type { Resource } from '../store/useDashboardStore';
import { useGPSTracker } from '../hooks/useGPSTracker';

const STATUS_COLOUR: Record<string, string> = {
  available: '#10b981', deployed: '#f59e0b', returning: '#3b82f6', maintenance: '#ef4444',
};
const TYPE_ICON: Record<string, string> = {
  boat: '🚤', medical: '➕', food: '🧃', rescue: '🪖', shelter: '🏕️',
};

export default function ResourceTracker() {
  const allResources     = useDashboardStore(s => s.allResources);
  const activeNGOs       = useDashboardStore(s => s.activeNGOs);
  const trackedId        = useDashboardStore(s => s.trackedResourceId);
  const setTracked       = useDashboardStore(s => s.setTrackedResourceId);
  const setMapView       = useDashboardStore(s => s.setMapView);

  const [filter, setFilter] = useState<'all' | 'deployed' | 'available'>('all');

  const filtered = allResources.filter(r => {
    if (filter === 'deployed') return r.status === 'deployed';
    if (filter === 'available') return r.status === 'available';
    return true;
  });

  function ngoColour(ngoId: string) {
    return activeNGOs.find(n => n.ngo_id === ngoId)?.colour ?? '#6b7280';
  }

  function focusOnMap(lat: number, lng: number, id: string) {
    setTracked(id === trackedId ? null : id);
    setMapView([lat, lng], 14);
  }

  function timeAgo(ts: string) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  const deployed   = allResources.filter(r => r.status === 'deployed').length;
  const available  = allResources.filter(r => r.status === 'available').length;

  return (
    <div className="p-3 flex flex-col gap-3">
      <span className="text-xs font-bold tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>RESOURCE TRACKER</span>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'TOTAL', value: allResources.length, colour: '#f9fafb' },
          { label: 'DEPLOYED', value: deployed, colour: '#f59e0b' },
          { label: 'AVAIL', value: available, colour: '#10b981' },
        ].map(s => (
          <div key={s.label} className="rounded p-2 text-center border" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="text-base font-bold" style={{ fontFamily: 'JetBrains Mono', color: s.colour }}>{s.value}</div>
            <div className="text-xs" style={{ color: '#6b7280', fontSize: 10, fontFamily: 'Rajdhani' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {(['all', 'deployed', 'available'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-1 py-1 rounded text-xs font-medium"
            style={{
              fontFamily: 'Rajdhani',
              background: filter === f ? '#f59e0b' : '#1f2937',
              color: filter === f ? '#000' : '#9ca3af',
              letterSpacing: '0.04em',
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Resource rows */}
      <div className="flex flex-col gap-1.5">
        {filtered.length === 0 && (
          <div className="text-xs text-center py-4" style={{ color: '#6b7280' }}>No resources to display.</div>
        )}
        {filtered.map(r => (
          <TrackerRow
            key={r.resource_id}
            resource={r}
            ngoColour={ngoColour(r.ngo_id)}
            isMapFocused={trackedId === r.resource_id}
            onFocus={() => focusOnMap(r.lat, r.lng, r.resource_id)}
            timeAgo={timeAgo}
          />
        ))}
      </div>
    </div>
  );
}

interface TrackerRowProps {
  resource: Resource;
  ngoColour: string;
  isMapFocused: boolean;
  onFocus: () => void;
  timeAgo: (ts: string) => string;
}

function TrackerRow({ resource: r, ngoColour, isMapFocused, onFocus, timeAgo }: TrackerRowProps) {
  const { tracking, accuracy, speed, heading, start, stop } = useGPSTracker(r.resource_id);
  const isBoat = r.type === 'boat';

  return (
    <div
      className="rounded border transition-all"
      style={{
        background: isMapFocused ? 'rgba(245,158,11,0.08)' : '#1f2937',
        borderColor: tracking
          ? 'rgba(16,185,129,0.4)'
          : isMapFocused
            ? 'rgba(245,158,11,0.4)'
            : 'rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${ngoColour}`,
      }}
    >
      {/* Clickable area — focuses map */}
      <button onClick={onFocus} className="w-full p-2.5 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>
            {TYPE_ICON[r.type]} {r.resource_id}
          </span>
          <div className="flex items-center gap-1">
            {tracking && (
              <span className="text-xs font-bold px-1 py-0.5 rounded animate-pulse"
                style={{ background: '#10b98122', color: '#10b981', fontFamily: 'Rajdhani', fontSize: 9 }}>
                🛰 LIVE
              </span>
            )}
            <span className="text-xs" style={{ color: STATUS_COLOUR[r.status], fontFamily: 'Rajdhani', fontSize: 10 }}>
              ● {r.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Coords row */}
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs" style={{ color: tracking ? '#10b981' : '#6b7280', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
            {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
            {tracking && accuracy != null && <span style={{ color: '#4b5563' }}> ±{accuracy}m</span>}
          </span>
          <span className="text-xs" style={{ color: '#6b7280', fontSize: 10 }}>{timeAgo(r.updated_at)}</span>
        </div>

        {/* Speed + heading for tracked boats */}
        {tracking && isBoat && (speed != null || heading != null) && (
          <div className="flex gap-3 mt-0.5">
            {speed != null && <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono', fontSize: 10 }}>⚡ {speed} km/h</span>}
            {heading != null && <span style={{ color: '#3b82f6', fontFamily: 'JetBrains Mono', fontSize: 10 }}>🧭 {heading}°</span>}
          </div>
        )}

        {r.assigned_crisis_id && (
          <div className="text-xs mt-0.5" style={{ color: '#f59e0b', fontSize: 10 }}>→ {r.assigned_crisis_id}</div>
        )}
      </button>

      {/* GPS toggle for boats (non-clickable relative to onFocus) */}
      {isBoat && (
        <div className="px-2.5 pb-2 pt-0">
          <button
            onClick={e => { e.stopPropagation(); tracking ? stop() : start(); }}
            className="w-full py-1 rounded text-xs font-bold"
            style={{
              background: tracking ? '#10b98133' : 'rgba(255,255,255,0.05)',
              color: tracking ? '#10b981' : '#6b7280',
              border: `1px solid ${tracking ? '#10b98155' : 'rgba(255,255,255,0.08)'}`,
              fontFamily: 'Rajdhani',
            }}>
            {tracking ? '🛰 STOP GPS TRACKING' : '🛰 START GPS TRACKING'}
          </button>
        </div>
      )}
    </div>
  );
}
