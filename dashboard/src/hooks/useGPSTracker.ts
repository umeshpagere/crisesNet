import { useEffect, useRef, useCallback, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

const API_BASE = 'http://localhost:8080/api/v1';

export interface GPSState {
  tracking: boolean;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useGPSTracker(resourceId: string): GPSState {
  const updateResource   = useDashboardStore(s => s.updateResource);
  const addGPSTracked    = useDashboardStore(s => s.addGPSTracked);
  const removeGPSTracked = useDashboardStore(s => s.removeGPSTracked);
  const gpsTrackedIds    = useDashboardStore(s => s.gpsTrackedIds);

  const watchIdRef = useRef<number | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [speed, setSpeed]     = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);

  const tracking = gpsTrackedIds.includes(resourceId);

  const pushPosition = useCallback(async (pos: GeolocationPosition) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const spd = pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : 0;
    const hdg = pos.coords.heading != null ? Math.round(pos.coords.heading) : 0;

    setAccuracy(Math.round(pos.coords.accuracy));
    setSpeed(spd);
    setHeading(hdg);

    updateResource(resourceId, {
      lat,
      lng,
      speed: spd,
      heading: hdg,
      updated_at: new Date().toISOString(),
    });

    try {
      await fetch(`${API_BASE}/resources/${resourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, speed: spd, heading: hdg }),
      });
    } catch { /* offline — local store already updated */ }
  }, [resourceId, updateResource]);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device');
      return;
    }
    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { setError(null); pushPosition(pos); },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 },
    );
    addGPSTracked(resourceId);
  }, [resourceId, pushPosition, addGPSTracked]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    removeGPSTracked(resourceId);
    setAccuracy(null);
    setSpeed(null);
    setHeading(null);
    setError(null);
  }, [resourceId, removeGPSTracked]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { tracking, accuracy, speed, heading, error, start, stop };
}
