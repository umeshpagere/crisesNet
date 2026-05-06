import { useDashboardStore, type HeatmapMode } from '../store/useDashboardStore';

const MODES: { id: HeatmapMode; label: string; icon: string; desc: string }[] = [
  { id: 'intensity',     label: 'Crisis',    icon: '🔥', desc: 'Crisis event intensity + time decay' },
  { id: 'resource',      label: 'Resources', icon: '🚤', desc: 'Resource availability density' },
  { id: 'population',    label: 'People',    icon: '👥', desc: 'Population at risk (affected count × severity)' },
  { id: 'response_time', label: 'ETA',       icon: '⏱', desc: 'Estimated response time to nearest resource' },
  { id: 'timelapse',     label: 'Timeline',  icon: '⏩', desc: '72-hour animated time-lapse' },
];

const GRID_OPTIONS = [1, 2, 5];

export default function HeatmapControls() {
  const heatmapVisible    = useDashboardStore(s => s.heatmapVisible);
  const toggleHeatmap     = useDashboardStore(s => s.toggleHeatmap);
  const heatmapMode       = useDashboardStore(s => s.heatmapMode);
  const setHeatmapMode    = useDashboardStore(s => s.setHeatmapMode);
  const heatmapOpacity    = useDashboardStore(s => s.heatmapOpacity);
  const setHeatmapOpacity = useDashboardStore(s => s.setHeatmapOpacity);
  const heatmapGridKm     = useDashboardStore(s => s.heatmapGridKm);
  const setHeatmapGridKm  = useDashboardStore(s => s.setHeatmapGridKm);
  const temporalSlices    = useDashboardStore(s => s.temporalSlices);
  const temporalPosition  = useDashboardStore(s => s.temporalPosition);
  const setTemporalPosition = useDashboardStore(s => s.setTemporalPosition);
  const temporalPlaying   = useDashboardStore(s => s.temporalPlaying);
  const setTemporalPlaying = useDashboardStore(s => s.setTemporalPlaying);

  const currentSlice = temporalSlices[temporalPosition];

  return (
    <div
      className="absolute top-20 left-4 z-[500] bg-[#0d1117]/95 border border-white/10 rounded-xl p-3 w-64 shadow-2xl select-none"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, color: '#f59e0b', letterSpacing: '0.05em' }}>
          🗺 HEATMAP LAYERS
        </span>
        <button
          onClick={toggleHeatmap}
          className="text-xs px-2 py-0.5 rounded"
          style={{
            background: heatmapVisible ? '#f59e0b22' : '#ffffff11',
            color: heatmapVisible ? '#f59e0b' : '#6b7280',
            border: `1px solid ${heatmapVisible ? '#f59e0b44' : '#ffffff22'}`,
          }}
        >
          {heatmapVisible ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Mode tabs */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {MODES.map(m => (
          <button
            key={m.id}
            title={m.desc}
            onClick={() => { setHeatmapMode(m.id); if (!heatmapVisible) toggleHeatmap(); }}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-center transition-all"
            style={{
              background: heatmapMode === m.id && heatmapVisible ? '#f59e0b22' : '#ffffff08',
              border: `1px solid ${heatmapMode === m.id && heatmapVisible ? '#f59e0b66' : 'transparent'}`,
              color: heatmapMode === m.id && heatmapVisible ? '#f9fafb' : '#6b7280',
            }}
          >
            <span style={{ fontSize: 16 }}>{m.icon}</span>
            <span style={{ fontSize: 9, fontFamily: 'Rajdhani', letterSpacing: '0.05em' }}>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Opacity */}
      {heatmapVisible && (
        <div className="mb-2">
          <div className="flex justify-between mb-1">
            <span style={{ fontSize: 11, color: '#9ca3af' }}>Opacity</span>
            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: '#d1d5db' }}>{Math.round(heatmapOpacity * 100)}%</span>
          </div>
          <input
            type="range" min={0.1} max={1} step={0.05}
            value={heatmapOpacity}
            onChange={e => setHeatmapOpacity(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded appearance-none cursor-pointer"
            style={{ accentColor: '#f59e0b' }}
          />
        </div>
      )}

      {/* Grid resolution */}
      {heatmapVisible && heatmapMode !== 'timelapse' && (
        <div className="mb-2">
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Grid resolution</span>
          <div className="flex gap-1 mt-1">
            {GRID_OPTIONS.map(km => (
              <button
                key={km}
                onClick={() => setHeatmapGridKm(km)}
                className="flex-1 py-0.5 rounded text-xs transition-colors"
                style={{
                  background: heatmapGridKm === km ? '#f59e0b22' : '#ffffff0a',
                  border: `1px solid ${heatmapGridKm === km ? '#f59e0b44' : 'transparent'}`,
                  color: heatmapGridKm === km ? '#f59e0b' : '#6b7280',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {km}km
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timelapse controls */}
      {heatmapVisible && heatmapMode === 'timelapse' && temporalSlices.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-1.5">
            <button
              onClick={() => setTemporalPosition(Math.max(0, temporalPosition - 1))}
              className="w-7 h-7 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-gray-300"
            >◀</button>
            <button
              onClick={() => setTemporalPlaying(!temporalPlaying)}
              className="flex-1 h-7 flex items-center justify-center rounded text-sm font-bold"
              style={{ background: temporalPlaying ? '#ef444422' : '#f59e0b22', color: temporalPlaying ? '#ef4444' : '#f59e0b', border: `1px solid ${temporalPlaying ? '#ef444444' : '#f59e0b44'}` }}
            >
              {temporalPlaying ? '⏸ PAUSE' : '▶ PLAY'}
            </button>
            <button
              onClick={() => setTemporalPosition(Math.min(temporalSlices.length - 1, temporalPosition + 1))}
              className="w-7 h-7 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-gray-300"
            >▶</button>
          </div>
          <input
            type="range" min={0} max={temporalSlices.length - 1} step={1}
            value={temporalPosition}
            onChange={e => setTemporalPosition(parseInt(e.target.value))}
            className="w-full h-1.5 rounded appearance-none cursor-pointer"
            style={{ accentColor: '#f59e0b' }}
          />
          {currentSlice && (
            <p className="text-center mt-1" style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>
              {currentSlice.label} • {currentSlice.hotspots.length} events
            </p>
          )}
        </div>
      )}

      {/* Colour legend */}
      {heatmapVisible && heatmapMode !== 'timelapse' && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1">
            {heatmapMode === 'resource' ? (
              <>
                <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right,#d1fae5,#10b981,#064e3b)' }} />
                <span style={{ fontSize: 9, color: '#6b7280' }}>sparse → dense</span>
              </>
            ) : heatmapMode === 'population' ? (
              <>
                <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right,#dbeafe,#3b82f6,#1e1b4b)' }} />
                <span style={{ fontSize: 9, color: '#6b7280' }}>low → high</span>
              </>
            ) : (
              <>
                <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right,#fef3c7,#f59e0b,#ef4444,#7f1d1d)' }} />
                <span style={{ fontSize: 9, color: '#6b7280' }}>low → critical</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
