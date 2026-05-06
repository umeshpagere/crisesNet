import { useDashboardStore } from '../store/useDashboardStore';

export default function NGODirectoryPanel() {
  const myNGO           = useDashboardStore(s => s.myNGO);
  const activeNGOs      = useDashboardStore(s => s.activeNGOs);
  const allResources    = useDashboardStore(s => s.allResources);
  const overlapWarnings = useDashboardStore(s => s.overlapWarnings);

  const others = activeNGOs.filter(n => n.ngo_id !== myNGO?.ngo_id);

  function timeAgo(ts: string) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  const resourcesFor = (ngoId: string) => allResources.filter(r => r.ngo_id === ngoId);

  return (
    <div className="p-3 flex flex-col gap-3">
      <span className="text-xs font-bold tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>
        NGOs ON GRID <span style={{ color: '#3b82f6' }}>({others.length})</span>
      </span>

      {/* Overlap warnings */}
      {overlapWarnings.length > 0 && (
        <div className="rounded p-3 border" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <div className="text-xs font-bold mb-2" style={{ color: '#f59e0b', fontFamily: 'Rajdhani' }}>
            ⚠ {overlapWarnings.length} OVERLAP WARNING{overlapWarnings.length > 1 ? 'S' : ''}
          </div>
          {overlapWarnings.map((w, i) => (
            <div key={i} className="text-xs mb-1" style={{ color: '#d1d5db' }}>
              <b style={{ color: '#f59e0b' }}>{w.ngo_a}</b> & <b style={{ color: '#f59e0b' }}>{w.ngo_b}</b> — same crisis ({w.crisis_id}), {w.distance_km}km apart
            </div>
          ))}
        </div>
      )}

      {/* NGO cards */}
      {others.length === 0 ? (
        <div className="text-xs text-center py-8" style={{ color: '#6b7280' }}>
          No other NGOs online.<br />Share your grid link to invite others.
        </div>
      ) : (
        others.map(ngo => {
          const res = resourcesFor(ngo.ngo_id);
          const deployed = res.filter(r => r.status === 'deployed').length;
          return (
            <div key={ngo.ngo_id} className="rounded p-3 border" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.07)', borderLeft: `3px solid ${ngo.colour}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>{ngo.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: ngo.status === 'online' ? '#10b98122' : '#37415122', color: ngo.status === 'online' ? '#10b981' : '#6b7280', fontFamily: 'Rajdhani' }}>
                  ● {ngo.status.toUpperCase()}
                </span>
              </div>
              <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>Zone: {ngo.zone} | Contact: {ngo.contact}</div>
              <div className="text-xs mb-1" style={{ color: '#6b7280' }}>
                Resources: <span style={{ color: '#f9fafb' }}>{res.length}</span> total, <span style={{ color: '#f59e0b' }}>{deployed}</span> deployed
              </div>
              <div className="text-xs" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono' }}>{ngo.ngo_id}</div>
              {ngo.resource_types.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ngo.resource_types.map(t => (
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#374151', color: '#9ca3af' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* My own card for reference */}
      {myNGO && (
        <div className="rounded p-3 border mt-2" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.1)', borderLeft: `3px solid ${myNGO.colour}` }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-wider" style={{ color: myNGO.colour, fontFamily: 'Rajdhani' }}>YOU — {myNGO.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#10b98122', color: '#10b981', fontFamily: 'Rajdhani' }}>● ONLINE</span>
          </div>
          <div className="text-xs" style={{ color: '#6b7280' }}>Zone: {myNGO.zone}</div>
        </div>
      )}
    </div>
  );
}
