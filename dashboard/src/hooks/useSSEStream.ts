import { useEffect, useRef } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import type { Resource, GapZone, CrisisAssignment, CoverageZone, AppAlert } from '../store/useDashboardStore';

export interface Boat {
  boat_id: string;
  last_lat: number;
  last_lng: number;
  heading_degrees: number;
  speed_knots: number;
  last_seen: string;
  status: string;
}

export interface HeatmapAlert {
  lat: number;
  lng: number;
  intensity: number;
  crisis_type: string;
  event_count: number;
}

function computeOverlaps(resources: Resource[]) {
  const warnings: { ngo_a: string; ngo_b: string; crisis_id: string; distance_km: number; zone_name: string }[] = [];
  const deployed = resources.filter(r => r.status === 'deployed' && r.assigned_crisis_id);

  for (let i = 0; i < deployed.length; i++) {
    for (let j = i + 1; j < deployed.length; j++) {
      const a = deployed[i];
      const b = deployed[j];
      if (a.ngo_id === b.ngo_id) continue;
      if (a.assigned_crisis_id !== b.assigned_crisis_id) continue;

      const R = 6371;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const sinLat = Math.sin(dLat / 2);
      const sinLng = Math.sin(dLng / 2);
      const c = 2 * Math.atan2(
        Math.sqrt(sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng),
        Math.sqrt(1 - (sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng))
      );
      const dist = R * c;

      if (dist < 2) {
        warnings.push({
          ngo_a: a.ngo_id,
          ngo_b: b.ngo_id,
          crisis_id: a.assigned_crisis_id!,
          distance_km: Math.round(dist * 100) / 100,
          zone_name: 'Active Zone',
        });
      }
    }
  }
  return warnings;
}

export function useSSEStream(url: string) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    setConnected,
    setAllResources,
    setActiveNGOs,
    setGapZones,
    setAssignments,
    setCoverageZones,
    setOverlapWarnings,
    addAlert,
  } = useDashboardStore();

  useEffect(() => {
    function connect() {
      if (eventSourceRef.current) eventSourceRef.current.close();

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);

          // resources
          if (parsed.resources) {
            setAllResources(parsed.resources as Resource[]);
            const overlaps = computeOverlaps(parsed.resources as Resource[]);
            setOverlapWarnings(overlaps);
            if (overlaps.length > 0) {
              overlaps.forEach(ov => {
                addAlert({
                  level: 'overlap',
                  title: 'Coverage Overlap Detected',
                  body: `${ov.ngo_a} and ${ov.ngo_b} are both responding to ${ov.crisis_id}`,
                  crisis_id: ov.crisis_id,
                });
              });
            }
          }

          // ngos
          if (parsed.ngos) setActiveNGOs(parsed.ngos);

          // gaps
          if (parsed.gaps) setGapZones(parsed.gaps as GapZone[]);

          // assignments
          if (parsed.assignments) setAssignments(parsed.assignments as CrisisAssignment[]);

          // coverage_zones
          if (parsed.coverage_zones) setCoverageZones(parsed.coverage_zones as CoverageZone[]);

          // alert events
          if (parsed.alert) {
            const a = parsed.alert as { level: AppAlert['level']; title: string; body: string; crisis_id?: string };
            addAlert(a);
          }

        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [url]);
}
