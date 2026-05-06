import { MapContainer, TileLayer, CircleMarker, Polygon, Popup, LayersControl, useMapEvents, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDashboardStore } from '../store/useDashboardStore';
import type { Crisis } from '../store/useDashboardStore';
import HeatmapLayer from './HeatmapLayer';
import HeatmapControls from './HeatmapControls';
import RoutePlanner from './RoutePlanner';

const { BaseLayer, Overlay } = LayersControl;

const RESOURCE_ICONS: Record<string, string> = {
  boat: '🚤', medical: '➕', food: '🧃', rescue: '🪖', shelter: '🏕️',
};

function severityColour(s: number) {
  if (s >= 8) return '#ef4444';
  if (s >= 5) return '#f59e0b';
  return '#eab308';
}

function statusColour(s: string) {
  switch (s) {
    case 'available':   return '#10b981';
    case 'deployed':    return '#f59e0b';
    case 'returning':   return '#3b82f6';
    case 'maintenance': return '#ef4444';
    default:            return '#6b7280';
  }
}

function ContextMenu() {
  const map = useMapEvents({
    contextmenu(e) {
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`
          <div style="font-family:'DM Sans',sans-serif;font-size:13px;min-width:160px">
            <div style="font-family:'Rajdhani',sans-serif;font-weight:700;color:#f59e0b;margin-bottom:8px;font-size:14px">📍 ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</div>
            <button onclick="window.__claimZone && window.__claimZone(${e.latlng.lat},${e.latlng.lng})" style="display:block;width:100%;text-align:left;padding:4px 0;border:none;background:none;cursor:pointer;color:#f9fafb">🗺 Claim this zone</button>
            <button onclick="window.__reportCrisis && window.__reportCrisis(${e.latlng.lat},${e.latlng.lng})" style="display:block;width:100%;text-align:left;padding:4px 0;border:none;background:none;cursor:pointer;color:#f9fafb">🚨 Report crisis here</button>
          </div>
        `)
        .openOn(map);
    },
  });
  return null;
}

export default function LiveMap() {
  const allResources  = useDashboardStore(s => s.allResources);
  const activeCrises  = useDashboardStore(s => s.activeCrises);
  const coverageZones = useDashboardStore(s => s.coverageZones);
  const gapZones      = useDashboardStore(s => s.gapZones);
  const activeNGOs    = useDashboardStore(s => s.activeNGOs);
  const gpsTrackedIds = useDashboardStore(s => s.gpsTrackedIds);
  const setSelectedCrisis = useDashboardStore(s => s.setSelectedCrisis);
  const mapCenter     = useDashboardStore(s => s.mapCenter);
  const mapZoom       = useDashboardStore(s => s.mapZoom);

  const ngoColour = (ngoId: string) =>
    activeNGOs.find(n => n.ngo_id === ngoId)?.colour ?? '#6b7280';

  // Mock crises when none from SSE yet
  const displayCrises: Crisis[] = activeCrises.length > 0 ? activeCrises : [
    { id: 'NK-001', type: 'flood',    severity: 9, lat: 19.9975, lng: 73.7898, affected_count: 8,  description: 'Boat capsized', timestamp: new Date().toISOString(), status: 'active' },
    { id: 'NK-002', type: 'medical',  severity: 6, lat: 19.847,  lng: 73.999,  affected_count: 47, description: 'Medical emergency cluster', timestamp: new Date().toISOString(), status: 'active' },
    { id: 'NK-003', type: 'flood',    severity: 4, lat: 20.012,  lng: 73.765,  affected_count: 23, description: 'Rising water level', timestamp: new Date().toISOString(), status: 'active' },
  ];

  return (
    <div className="relative w-full h-full overflow-hidden isolate">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="w-full h-full"
        style={{ background: '#0a0c10' }}
      >
      <LayersControl position="topright">
        <BaseLayer checked name="OpenStreetMap">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </BaseLayer>

        {/* Layer 3: Resource Markers */}
        <Overlay checked name="Resources">
          <>
            {allResources.map(r => (
              <CircleMarker
                key={r.resource_id}
                center={[r.lat, r.lng]}
                radius={gpsTrackedIds.includes(r.resource_id) ? 10 : 8}
                pathOptions={{
                  color: gpsTrackedIds.includes(r.resource_id) ? '#10b981' : ngoColour(r.ngo_id),
                  fillColor: statusColour(r.status),
                  fillOpacity: 0.9,
                  weight: gpsTrackedIds.includes(r.resource_id) ? 3 : 2,
                }}
              >
                <Tooltip>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 12 }}>
                    <div style={{ fontFamily: 'Rajdhani', fontWeight: 700 }}>{RESOURCE_ICONS[r.type]} {r.name}</div>
                    <div>Status: <b>{r.status.toUpperCase()}</b></div>
                    <div>NGO: {r.ngo_id}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</div>
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ fontFamily: 'DM Sans', minWidth: 180 }}>
                    <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{RESOURCE_ICONS[r.type]} {r.name}</div>
                    <div>Status: <span style={{ color: statusColour(r.status), fontWeight: 600 }}>{r.status.toUpperCase()}</span></div>
                    <div>Capacity: {r.capacity} people</div>
                    <div>Battery: {r.battery_pct}%</div>
                    {r.assigned_crisis_id && <div>Assigned to: {r.assigned_crisis_id}</div>}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </>
        </Overlay>

        {/* Layer 4: Crisis Event Markers */}
        <Overlay checked name="Crisis Events">
          <>
            {displayCrises.map(c => (
              <CircleMarker
                key={c.id}
                center={[c.lat, c.lng]}
                radius={c.severity >= 8 ? 14 : c.severity >= 5 ? 10 : 7}
                pathOptions={{
                  color: severityColour(c.severity),
                  fillColor: severityColour(c.severity),
                  fillOpacity: 0.35,
                  weight: c.severity >= 8 ? 3 : 2,
                }}
                eventHandlers={{ click: () => setSelectedCrisis(c) }}
              >
                <Tooltip direction="top">
                  <div style={{ fontFamily: 'DM Sans', fontSize: 12 }}>
                    <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, color: severityColour(c.severity) }}>
                      SEV {c.severity} — {c.type.toUpperCase()}
                    </div>
                    <div>{c.description}</div>
                    <div>{c.affected_count} people affected</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </>
        </Overlay>

        {/* Layer 2: NGO Coverage Polygons */}
        <Overlay checked name="Coverage Zones">
          <>
            {coverageZones.map(z => (
              <Polygon
                key={z.zone_id}
                positions={z.polygon_coords}
                pathOptions={{
                  color: ngoColour(z.ngo_id),
                  fillColor: ngoColour(z.ngo_id),
                  fillOpacity: 0.12,
                  weight: 2,
                  dashArray: '4 4',
                }}
              >
                <Tooltip sticky>
                  <span style={{ fontFamily: 'Rajdhani', fontWeight: 600 }}>{z.ngo_id} — {z.zone_name || 'Coverage Zone'}</span>
                </Tooltip>
              </Polygon>
            ))}
          </>
        </Overlay>

        {/* Layer 5: Gap Zones */}
        <Overlay checked name="Coverage Gaps">
          <>
            {gapZones.map((g, i) => (
              <CircleMarker
                key={`gap_${i}`}
                center={[g.lat, g.lng]}
                radius={Math.max(12, g.affected_people / 4)}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.15,
                  weight: 2,
                  dashArray: '6 4',
                }}
              >
                <Tooltip direction="top">
                  <div style={{ fontFamily: 'DM Sans', fontSize: 12 }}>
                    <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, color: '#3b82f6' }}>⚠ COVERAGE GAP</div>
                    <div>{g.affected_people} people • No NGO within {g.distance_to_nearest_km}km</div>
                    <div>Priority: {g.priority_score.toFixed(1)}</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </>
        </Overlay>
      </LayersControl>

        <ContextMenu />
        <HeatmapLayer />
        <RoutePlanner />
      </MapContainer>

      {/* HeatmapControls floats over the map, clipped by overflow-hidden */}
      <HeatmapControls />
    </div>
  );
}
