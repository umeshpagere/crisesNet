import { useState, useEffect } from 'react';

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  event_count: number;
  dominant_crisis_type: string;
  latest_event_id: string;
}

export interface HeatmapData {
  generated_at: string;
  grid_resolution_km: number;
  points: HeatmapPoint[];
  total_active_events: number;
  bounding_box: {
    min_lat: number;
    max_lat: number;
    min_lng: number;
    max_lng: number;
  };
}

export function useHeatmap(apiUrl: string, refreshInterval: number = 60000) {
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setHeatmap(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch heatmap');
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, refreshInterval);

    return () => clearInterval(interval);
  }, [apiUrl, refreshInterval]);

  return { heatmap, loading, error };
}
