import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import ShiftHandover from './ShiftHandover';
import OpsReport from './OpsReport';

export default function CommandBar() {
  const myNGO       = useDashboardStore(s => s.myNGO);
  const connected   = useDashboardStore(s => s.connected);
  const activeNGOs  = useDashboardStore(s => s.activeNGOs);
  const allResources= useDashboardStore(s => s.allResources);
  const activeCrises= useDashboardStore(s => s.activeCrises);
  const unreadCount = useDashboardStore(s => s.unreadCount);
  const alerts      = useDashboardStore(s => s.alerts);
  const markAlertsRead = useDashboardStore(s => s.markAlertsRead);
  const clearMyNGO  = useDashboardStore(s => s.clearMyNGO);

  const [showAlerts, setShowAlerts]   = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [showReport, setShowReport]   = useState(false);

  const avgResponseTime = '4.2 min';

  function toggleAlerts() {
    setShowAlerts(p => !p);
    if (!showAlerts) markAlertsRead();
  }

  return (
    <>
      <header
        className="flex items-center gap-4 px-4 shrink-0 border-b"
        style={{ height: 56, background: '#111827', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <span className="text-xl">⚡</span>
          <span className="font-bold tracking-widest text-base" style={{ fontFamily: 'Rajdhani', color: '#f59e0b' }}>CRISISNET</span>
        </div>

        <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* Stats */}
        <div className="flex items-center gap-5 text-xs" style={{ color: '#9ca3af', fontFamily: 'Rajdhani', letterSpacing: '0.06em' }}>
          <Stat label="CRISES" value={activeCrises.length} colour="#ef4444" />
          <Stat label="NGOs ONLINE" value={activeNGOs.filter(n => n.status === 'online').length || 1} colour="#3b82f6" />
          <Stat label="RESOURCES" value={allResources.length} colour="#10b981" />
          <Stat label="AVG RESPONSE" value={avgResponseTime} colour="#f59e0b" />
        </div>

        <div className="flex-1" />

        {/* NGO badge */}
        {myNGO && (
          <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: myNGO.colour }} />
            <span className="text-xs font-medium" style={{ color: '#f9fafb', fontFamily: 'Rajdhani' }}>{myNGO.name}</span>
          </div>
        )}

        {/* Action buttons */}
        <button
          onClick={() => setShowReport(true)}
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{ background: '#1f2937', color: '#9ca3af', fontFamily: 'Rajdhani', letterSpacing: '0.06em' }}
        >
          📋 OPS REPORT
        </button>

        <button
          onClick={() => setShowHandover(true)}
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{ background: '#1f2937', color: '#9ca3af', fontFamily: 'Rajdhani', letterSpacing: '0.06em' }}
        >
          🔄 HANDOVER
        </button>

        {/* Bell */}
        <button onClick={toggleAlerts} className="relative p-2 rounded transition-colors" style={{ background: showAlerts ? '#1f2937' : 'transparent' }}>
          <span className="text-base">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold" style={{ background: '#ef4444', color: '#fff', fontSize: 10 }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Connection */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: connected ? '#10b981' : '#ef4444' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: connected ? '#10b981' : '#ef4444', boxShadow: connected ? '0 0 6px #10b981' : 'none' }} />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        {/* Leave */}
        <button
          onClick={clearMyNGO}
          className="p-1.5 rounded text-xs transition-colors"
          style={{ color: '#6b7280' }}
          title="Leave Operations"
        >✕</button>
      </header>

      {/* Notification drawer */}
      {showAlerts && (
        <div className="fixed top-14 right-0 w-80 z-40 border-l border-b rounded-bl-lg shadow-2xl overflow-hidden" style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)', maxHeight: '60vh', overflowY: 'auto' }}>
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-sm font-semibold" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>NOTIFICATIONS</span>
            <button onClick={() => setShowAlerts(false)} className="text-xs" style={{ color: '#6b7280' }}>✕</button>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs" style={{ color: '#6b7280' }}>No alerts yet.</div>
          ) : (
            alerts.map(a => (
              <div key={a.id} className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)', background: a.read ? 'transparent' : 'rgba(245,158,11,0.04)' }}>
                <div className="text-xs font-semibold mb-0.5" style={{ color: alertColour(a.level) }}>{a.title}</div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{a.body}</div>
              </div>
            ))
          )}
        </div>
      )}

      {showHandover && <ShiftHandover onClose={() => setShowHandover(false)} />}
      {showReport && <OpsReport onClose={() => setShowReport(false)} />}
    </>
  );
}

function Stat({ label, value, colour }: { label: string; value: string | number; colour: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-bold text-base leading-none" style={{ color: colour, fontFamily: 'JetBrains Mono' }}>{value}</span>
      <span className="text-xs leading-none" style={{ color: '#6b7280', fontSize: 10 }}>{label}</span>
    </div>
  );
}

function alertColour(level: string) {
  switch (level) {
    case 'critical': return '#ef4444';
    case 'overlap':  return '#f59e0b';
    case 'resolved': return '#10b981';
    default:         return '#3b82f6';
  }
}
