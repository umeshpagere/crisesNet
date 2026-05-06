import { useEffect } from 'react';
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import { useDashboardStore } from '../store/useDashboardStore';

const API = 'http://localhost:8080/api/v1';

const WAYPOINT_COLORS: Record<string, string> = {
  start:        '#10b981',
  intermediate: '#6b7280',
  destination:  '#ef4444',
};

export default function RoutePlanner() {
  const plannedRoute          = useDashboardStore(s => s.plannedRoute);
  const setPlannedRoute       = useDashboardStore(s => s.setPlannedRoute);
  const routePlannerResource  = useDashboardStore(s => s.routePlannerResource);
  const selectedCrisis        = useDashboardStore(s => s.selectedCrisis);

  // Auto-fetch when both resource and crisis are selected
  useEffect(() => {
    if (!routePlannerResource || !selectedCrisis) return;
    fetch(`${API}/routes/plan?resource_id=${routePlannerResource}&crisis_id=${selectedCrisis.id}`)
      .then(r => r.json())
      .then(json => {
        if (json.waypoints) setPlannedRoute(json);
      })
      .catch(() => {});
  }, [routePlannerResource, selectedCrisis, setPlannedRoute]);

  if (!plannedRoute || plannedRoute.waypoints.length < 2) return null;

  const positions = plannedRoute.waypoints.map(w => [w.lat, w.lng] as [number, number]);

  return (
    <>
      {/* Dashed route line */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#f59e0b',
          weight: 3,
          dashArray: '8 5',
          opacity: 0.85,
        }}
      />

      {/* Waypoint markers */}
      {plannedRoute.waypoints.map((w, i) => (
        <CircleMarker
          key={`wp_${i}`}
          center={[w.lat, w.lng]}
          radius={w.type === 'start' || w.type === 'destination' ? 8 : 5}
          pathOptions={{
            color: WAYPOINT_COLORS[w.type] ?? '#6b7280',
            fillColor: WAYPOINT_COLORS[w.type] ?? '#6b7280',
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <Tooltip direction="top" permanent={w.type !== 'intermediate'}>
            <div style={{ fontFamily: 'DM Sans', fontSize: 11 }}>
              <div style={{ fontFamily: 'Rajdhani', fontWeight: 700 }}>{w.label}</div>
              {w.type === 'destination' && (
                <div style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                  ETA {plannedRoute.eta_minutes}m • {plannedRoute.distance_km}km
                </div>
              )}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Floating ETA badge at midpoint */}
      {(() => {
        const mid = plannedRoute.waypoints[Math.floor(plannedRoute.waypoints.length / 2)];
        return (
          <CircleMarker
            center={[mid.lat, mid.lng]}
            radius={0}
            pathOptions={{ opacity: 0, fillOpacity: 0 }}
          >
            <Tooltip direction="top" permanent>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                ⏱ {plannedRoute.eta_minutes}min
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })()}
    </>
  );
}

export function RoutePlannerControls() {
  const allResources         = useDashboardStore(s => s.allResources);
  const plannedRoute         = useDashboardStore(s => s.plannedRoute);
  const setPlannedRoute      = useDashboardStore(s => s.setPlannedRoute);
  const routePlannerResource = useDashboardStore(s => s.routePlannerResource);
  const setRoutePlannerResource = useDashboardStore(s => s.setRoutePlannerResource);
  const selectedCrisis       = useDashboardStore(s => s.selectedCrisis);
  const myNGO                = useDashboardStore(s => s.myNGO);

  const myResources = myNGO
    ? allResources.filter(r => r.ngo_id === myNGO.ngo_id)
    : allResources.slice(0, 5);

  if (!selectedCrisis) return null;

  return (
    <div className="mt-3 p-2 rounded-xl" style={{ background: '#f59e0b0d', border: '1px solid #f59e0b33' }}>
      <p style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, color: '#f59e0b', marginBottom: 6 }}>
        🗺 ROUTE PLANNER — {selectedCrisis.id}
      </p>
      <select
        value={routePlannerResource ?? ''}
        onChange={e => setRoutePlannerResource(e.target.value || null)}
        className="w-full px-2 py-1.5 rounded text-xs mb-2"
        style={{ background: '#0d1117', border: '1px solid #ffffff20', color: '#f9fafb' }}
      >
        <option value="">— Select a resource to route —</option>
        {myResources.map(r => (
          <option key={r.resource_id} value={r.resource_id}>
            {r.name} ({r.status})
          </option>
        ))}
      </select>

      {plannedRoute && (
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 11, color: '#d1d5db' }}>
            <span style={{ fontFamily: 'JetBrains Mono', color: '#f59e0b' }}>{plannedRoute.eta_minutes}m</span>
            {' '}ETA • {plannedRoute.distance_km}km
          </div>
          <button
            onClick={() => { setPlannedRoute(null); setRoutePlannerResource(null); }}
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: '#ef444422', color: '#ef4444' }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
