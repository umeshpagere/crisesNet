import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { Deck } from '@deck.gl/core';
import { HeatmapLayer as DeckHeatmapLayer } from '@deck.gl/aggregation-layers';
import { useDashboardStore, type HeatmapPoint, type HeatmapMode } from '../store/useDashboardStore';

const API = 'http://localhost:8080/api/v1';

const COLOR_RANGES: Record<HeatmapMode, [number,number,number,number][]> = {
  intensity:     [[254,243,199,0],[245,158,11,180],[239,68,68,220],[127,29,29,255]],
  resource:      [[209,250,229,0],[16,185,129,180],[6,78,59,255],[6,78,59,255]],
  population:    [[219,234,254,0],[59,130,246,180],[30,27,75,220],[30,27,75,255]],
  response_time: [[209,250,229,0],[245,158,11,180],[239,68,68,220],[127,29,29,255]],
  timelapse:     [[254,243,199,0],[245,158,11,180],[239,68,68,220],[127,29,29,255]],
};

async function fetchPoints(mode: HeatmapMode, gridKm: number): Promise<HeatmapPoint[]> {
  const endpointMap: Record<HeatmapMode, string> = {
    intensity:     `/heatmap?grid_resolution_km=${gridKm}`,
    resource:      `/heatmap/resource-density?grid_resolution_km=${gridKm}`,
    population:    `/heatmap/population-risk?grid_resolution_km=${gridKm}`,
    response_time: `/heatmap/response-time?grid_resolution_km=${gridKm}`,
    timelapse:     `/heatmap/temporal?hours=72&slices=24`,
  };
  const res = await fetch(`${API}${endpointMap[mode]}`);
  if (!res.ok) return [];
  const json = await res.json();
  if (mode === 'timelapse') {
    return (json.slices?.[0]?.hotspots ?? []) as HeatmapPoint[];
  }
  return (json.points ?? json.hotspots ?? []) as HeatmapPoint[];
}

export default function HeatmapLayer() {
  const map = useMap();
  const deckRef = useRef<Deck | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const heatmapVisible    = useDashboardStore(s => s.heatmapVisible);
  const heatmapMode       = useDashboardStore(s => s.heatmapMode);
  const heatmapOpacity    = useDashboardStore(s => s.heatmapOpacity);
  const heatmapGridKm     = useDashboardStore(s => s.heatmapGridKm);
  const heatmapPoints     = useDashboardStore(s => s.heatmapPoints);
  const setHeatmapPoints  = useDashboardStore(s => s.setHeatmapPoints);
  const temporalSlices    = useDashboardStore(s => s.temporalSlices);
  const setTemporalSlices = useDashboardStore(s => s.setTemporalSlices);
  const temporalPosition  = useDashboardStore(s => s.temporalPosition);
  const temporalPlaying   = useDashboardStore(s => s.temporalPlaying);
  const setTemporalPosition = useDashboardStore(s => s.setTemporalPosition);

  // ── Fetch data whenever mode/grid changes ──────────────────────────────
  useEffect(() => {
    if (!heatmapVisible) return;
    if (heatmapMode === 'timelapse') {
      fetch(`${API}/heatmap/temporal?hours=72&slices=24`)
        .then(r => r.json())
        .then(json => {
          setTemporalSlices(json.slices ?? []);
          setHeatmapPoints(json.slices?.[0]?.hotspots ?? []);
        })
        .catch(() => {});
    } else {
      fetchPoints(heatmapMode, heatmapGridKm)
        .then(pts => setHeatmapPoints(pts))
        .catch(() => {});
    }
  }, [heatmapVisible, heatmapMode, heatmapGridKm, setHeatmapPoints, setTemporalSlices]);

  // ── Timelapse auto-advance ─────────────────────────────────────────────
  useEffect(() => {
    if (!temporalPlaying || temporalSlices.length === 0) return;
    const id = setInterval(() => {
      setTemporalPosition((temporalPosition + 1) % temporalSlices.length);
    }, 800);
    return () => clearInterval(id);
  }, [temporalPlaying, temporalPosition, temporalSlices.length, setTemporalPosition]);

  // ── Update points from temporal slice ─────────────────────────────────
  useEffect(() => {
    if (heatmapMode !== 'timelapse' || temporalSlices.length === 0) return;
    setHeatmapPoints(temporalSlices[temporalPosition]?.hotspots ?? []);
  }, [temporalPosition, temporalSlices, heatmapMode, setHeatmapPoints]);

  // ── Build / update deck.gl overlay ────────────────────────────────────
  const syncDeck = useCallback(() => {
    if (!deckRef.current || !heatmapVisible || heatmapPoints.length === 0) return;

    const layer = new DeckHeatmapLayer({
      id: 'heatmap',
      data: heatmapPoints,
      getPosition: (d: HeatmapPoint) => [d.lng, d.lat] as [number, number],
      getWeight:   (d: HeatmapPoint) => d.intensity,
      colorRange:  COLOR_RANGES[heatmapMode] as [number,number,number,number][],
      opacity:     heatmapOpacity,
      radiusPixels: 60,
      intensity:   1,
      threshold:   0.03,
    });

    const { x, y } = map.getPixelOrigin();
    const mapSize   = map.getSize();
    deckRef.current.setProps({
      layers: [layer],
      viewState: {
        longitude: map.getCenter().lng,
        latitude:  map.getCenter().lat,
        zoom:      map.getZoom() - 1,
        bearing: 0, pitch: 0,
      },
      width:  mapSize.x,
      height: mapSize.y,
    });
    void x; void y;
  }, [map, heatmapVisible, heatmapPoints, heatmapMode, heatmapOpacity]);

  // ── Mount / unmount deck.gl canvas ────────────────────────────────────
  useEffect(() => {
    if (!heatmapVisible) {
      if (deckRef.current) { deckRef.current.finalize(); deckRef.current = null; }
      if (canvasRef.current) { canvasRef.current.remove(); canvasRef.current = null; }
      return;
    }
    const mapContainer = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:400';
    const ms = map.getSize();
    canvas.width  = ms.x;
    canvas.height = ms.y;
    mapContainer.appendChild(canvas);
    canvasRef.current = canvas;

    deckRef.current = new Deck({
      canvas,
      width:  ms.x,
      height: ms.y,
      controller: false,
      layers: [],
      viewState: {
        longitude: map.getCenter().lng,
        latitude:  map.getCenter().lat,
        zoom:      map.getZoom() - 1,
        bearing: 0, pitch: 0,
      },
    });

    const onMove = () => {
      if (!canvasRef.current) return;
      const s = map.getSize();
      canvasRef.current.width  = s.x;
      canvasRef.current.height = s.y;
      syncDeck();
    };
    map.on('move', onMove);
    map.on('zoom', onMove);
    map.on('resize', onMove);
    syncDeck();

    return () => {
      map.off('move', onMove);
      map.off('zoom', onMove);
      map.off('resize', onMove);
      if (deckRef.current) { deckRef.current.finalize(); deckRef.current = null; }
      canvas.remove();
      canvasRef.current = null;
    };
  }, [heatmapVisible, map, syncDeck]);

  useEffect(() => { syncDeck(); }, [syncDeck]);

  return null;
}

