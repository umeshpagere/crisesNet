import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

function severityLabel(s: number) {
  if (s >= 8) return { label: 'CRITICAL', colour: '#ef4444' };
  if (s >= 5) return { label: 'HIGH',     colour: '#f97316' };
  if (s >= 3) return { label: 'MODERATE', colour: '#f59e0b' };
  return           { label: 'LOW',       colour: '#10b981' };
}

export default function CrisisDetailPanel() {
  const crisis         = useDashboardStore(s => s.selectedCrisis);
  const setSelectedCrisis = useDashboardStore(s => s.setSelectedCrisis);
  const myNGO          = useDashboardStore(s => s.myNGO);
  const myResources    = useDashboardStore(s => s.myResources);
  const assignments    = useDashboardStore(s => s.assignments);
  const setAssignments = useDashboardStore(s => s.setAssignments);

  const [assigning, setAssigning] = useState(false);
  const [selectedRes, setSelectedRes] = useState('');

  if (!crisis) return null;

  const { label, colour } = severityLabel(crisis.severity);
  const crisisAssignments = assignments.filter(a => a.crisis_id === crisis.id);
  const availableResources = myResources.filter(r =>
    r.status === 'available' && !crisisAssignments.find(a => a.resource_id === r.resource_id)
  );

  async function assignResource() {
    if (!selectedRes || !myNGO) return;
    setAssigning(true);
    const newAssignment = {
      crisis_id: crisis!.id,
      resource_id: selectedRes,
      ngo_id: myNGO.ngo_id,
      assigned_at: new Date().toISOString(),
      eta_minutes: Math.floor(Math.random() * 20) + 5,
      status: 'en_route',
    };
    try {
      await fetch(`http://localhost:8080/api/v1/crises/${crisis!.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: selectedRes, ngo_id: myNGO.ngo_id }),
      });
    } catch { /* offline */ }
    setAssignments([...assignments, newAssignment]);
    setSelectedRes('');
    setAssigning(false);
  }

  async function unassignResource(resourceId: string) {
    try {
      await fetch(`http://localhost:8080/api/v1/crises/${crisis!.id}/assignments/${resourceId}`, { method: 'DELETE' });
    } catch { /* offline */ }
    setAssignments(assignments.filter(a => !(a.crisis_id === crisis!.id && a.resource_id === resourceId)));
  }

  return (
    <div
      className="flex flex-col border-l overflow-y-auto shrink-0 slide-panel"
      style={{ width: 320, background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <span className="font-bold text-sm tracking-wide" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>
          CRISIS DETAIL
        </span>
        <button onClick={() => setSelectedCrisis(null)} className="text-base" style={{ color: '#6b7280' }}>✕</button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Severity badge + type */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-bold mb-1" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>
              {crisis.type.toUpperCase()} EVENT
            </div>
            <div className="text-xs" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono' }}>{crisis.id}</div>
          </div>
          <span className="px-2 py-1 rounded font-bold text-xs" style={{ background: colour + '22', color: colour, fontFamily: 'Rajdhani' }}>
            SEV {crisis.severity} — {label}
          </span>
        </div>

        {/* Description */}
        <div className="text-sm" style={{ color: '#d1d5db' }}>{crisis.description}</div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'AFFECTED', value: crisis.affected_count },
            { label: 'RESPONDERS', value: crisisAssignments.length },
          ].map(m => (
            <div key={m.label} className="rounded p-3 border text-center" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="text-xl font-bold" style={{ fontFamily: 'JetBrains Mono', color: '#f9fafb' }}>{m.value}</div>
              <div className="text-xs" style={{ color: '#6b7280', fontFamily: 'Rajdhani', letterSpacing: '0.06em' }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Location */}
        <div className="rounded p-3 border" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-bold mb-1" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>LOCATION</div>
          <div className="text-xs" style={{ fontFamily: 'JetBrains Mono', color: '#f9fafb' }}>
            {crisis.lat.toFixed(6)}, {crisis.lng.toFixed(6)}
          </div>
          <div className="text-xs mt-1" style={{ color: '#6b7280' }}>
            {new Date(crisis.timestamp).toLocaleString()}
          </div>
        </div>

        {/* Assigned resources */}
        <div>
          <div className="text-xs font-bold mb-2 tracking-wider" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>
            ASSIGNED RESOURCES ({crisisAssignments.length})
          </div>
          {crisisAssignments.length === 0 ? (
            <div className="text-xs" style={{ color: '#6b7280' }}>No resources assigned yet.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {crisisAssignments.map(a => (
                <div key={a.resource_id} className="flex items-center justify-between rounded p-2 border" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <div>
                    <div className="text-xs font-bold" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>{a.resource_id}</div>
                    <div className="text-xs" style={{ color: '#6b7280' }}>{a.ngo_id} • ETA {a.eta_minutes}min</div>
                  </div>
                  {a.ngo_id === myNGO?.ngo_id && (
                    <button
                      onClick={() => unassignResource(a.resource_id)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: '#ef444422', color: '#ef4444', fontFamily: 'Rajdhani' }}
                    >RECALL</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assign resource */}
        {myNGO && availableResources.length > 0 && (
          <div className="border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="text-xs font-bold mb-2 tracking-wider" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>ASSIGN RESOURCE</div>
            <div className="flex gap-2">
              <select
                value={selectedRes}
                onChange={e => setSelectedRes(e.target.value)}
                className="flex-1 px-2 py-2 rounded text-xs"
                style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', color: selectedRes ? '#f9fafb' : '#6b7280' }}
              >
                <option value="">Select resource…</option>
                {availableResources.map(r => (
                  <option key={r.resource_id} value={r.resource_id}>{r.resource_id} ({r.type})</option>
                ))}
              </select>
              <button
                onClick={assignResource}
                disabled={assigning || !selectedRes}
                className="px-3 py-2 rounded text-xs font-bold"
                style={{ background: '#f59e0b', color: '#000', fontFamily: 'Rajdhani', opacity: (!selectedRes || assigning) ? 0.5 : 1 }}
              >
                {assigning ? '…' : 'ASSIGN'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
