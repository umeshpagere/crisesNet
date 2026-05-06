import { useDashboardStore } from '../store/useDashboardStore';

interface Props { onClose: () => void; }

export default function OpsReport({ onClose }: Props) {
  const myNGO        = useDashboardStore(s => s.myNGO);
  const allResources = useDashboardStore(s => s.allResources);
  const activeNGOs   = useDashboardStore(s => s.activeNGOs);
  const gapZones     = useDashboardStore(s => s.gapZones);
  const assignments  = useDashboardStore(s => s.assignments);
  const alerts       = useDashboardStore(s => s.alerts);
  const chatMessages = useDashboardStore(s => s.chatMessages);

  const deployed    = allResources.filter(r => r.status === 'deployed');
  const available   = allResources.filter(r => r.status === 'available');
  const unserved    = gapZones.reduce((s, g) => s + g.affected_people, 0);
  const now         = new Date().toLocaleString();

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center no-print" style={{ background: 'rgba(10,12,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl rounded-xl border flex flex-col" style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.1)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="font-bold tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#f59e0b', fontSize: 16 }}>📋 OPERATIONS REPORT</span>
          <div className="flex gap-2 items-center">
            <button onClick={handlePrint} className="px-3 py-1.5 rounded text-xs font-bold" style={{ fontFamily: 'Rajdhani', background: '#1f2937', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
              🖨 PRINT / PDF
            </button>
            <button onClick={onClose} style={{ color: '#6b7280' }}>✕</button>
          </div>
        </div>

        {/* Report body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* Report metadata */}
          <div className="text-xs" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono' }}>
            Generated: {now} | NGO: {myNGO?.name ?? '—'} | Zone: {myNGO?.zone ?? '—'}
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Resources',   value: allResources.length,  colour: '#f9fafb' },
              { label: 'Deployed Now',      value: deployed.length,      colour: '#f59e0b' },
              { label: 'Available',         value: available.length,     colour: '#10b981' },
              { label: 'NGOs Online',       value: activeNGOs.filter(n => n.status === 'online').length, colour: '#3b82f6' },
              { label: 'Assignments',       value: assignments.length,   colour: '#8b5cf6' },
              { label: 'People at Risk',    value: unserved,             colour: '#ef4444' },
            ].map(s => (
              <div key={s.label} className="rounded p-3 border text-center" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-2xl font-bold" style={{ fontFamily: 'JetBrains Mono', color: s.colour }}>{s.value}</div>
                <div className="text-xs mt-1" style={{ color: '#6b7280', fontFamily: 'Rajdhani', letterSpacing: '0.05em' }}>{s.label.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Coverage gaps */}
          {gapZones.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-2 tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>COVERAGE GAPS</div>
              <div className="flex flex-col gap-1.5">
                {gapZones.map((g, i) => (
                  <div key={i} className="rounded p-3 border flex items-center justify-between" style={{ background: '#1f2937', borderColor: 'rgba(59,130,246,0.2)' }}>
                    <div>
                      <div className="text-xs font-bold" style={{ fontFamily: 'Rajdhani', color: '#3b82f6' }}>Gap #{i + 1} — {g.crisis_type.toUpperCase()}</div>
                      <div className="text-xs" style={{ color: '#9ca3af' }}>{g.affected_people} people • {g.distance_to_nearest_km}km to nearest NGO</div>
                    </div>
                    <div className="text-xs font-bold" style={{ fontFamily: 'JetBrains Mono', color: '#f59e0b' }}>P{g.priority_score.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deployed resources table */}
          {deployed.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-2 tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>DEPLOYED RESOURCES</div>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#6b7280', fontFamily: 'Rajdhani', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th className="py-1.5 text-left font-medium">ID</th>
                    <th className="py-1.5 text-left font-medium">TYPE</th>
                    <th className="py-1.5 text-left font-medium">NGO</th>
                    <th className="py-1.5 text-left font-medium">CRISIS</th>
                    <th className="py-1.5 text-right font-medium">BAT</th>
                  </tr>
                </thead>
                <tbody>
                  {deployed.map(r => (
                    <tr key={r.resource_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#d1d5db' }}>
                      <td className="py-1.5" style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>{r.resource_id}</td>
                      <td className="py-1.5">{r.type}</td>
                      <td className="py-1.5">{r.ngo_id}</td>
                      <td className="py-1.5">{r.assigned_crisis_id ?? '—'}</td>
                      <td className="py-1.5 text-right">{r.battery_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent alerts */}
          {alerts.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-2 tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>RECENT ALERTS ({alerts.slice(0, 5).length})</div>
              {alerts.slice(0, 5).map(a => (
                <div key={a.id} className="text-xs py-1 border-b" style={{ color: '#9ca3af', borderColor: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#6b7280', fontFamily: 'JetBrains Mono' }}>{new Date(a.timestamp).toLocaleTimeString()} </span>
                  [{a.level.toUpperCase()}] {a.title} — {a.body}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
