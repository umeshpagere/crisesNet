import { useDashboardStore } from '../store/useDashboardStore';
import ResourcePanel from './ResourcePanel';
import NGODirectoryPanel from './NGODirectoryPanel';
import AIAllocationAdvisor from './AIAllocationAdvisor';
import ResourceTracker from './ResourceTracker';
import NGOScoreboard from './NGOScoreboard';
import MutualAidPanel from './MutualAidPanel';

const TABS = [
  { id: 'resources',  label: 'MY RESOURCES', icon: '🚤' },
  { id: 'ngos',       label: 'OTHER NGOs',   icon: '🗺' },
  { id: 'stats',      label: 'SCOREBOARD',   icon: '📊' },
  { id: 'mutual_aid', label: 'MUTUAL AID',   icon: '🤝' },
  { id: 'ai',         label: 'AI ADVISOR',   icon: '🤖' },
  { id: 'tracker',    label: 'TRACKER',      icon: '📡' },
] as const;

export default function Sidebar() {
  const tab    = useDashboardStore(s => s.sidebarTab);
  const setTab = useDashboardStore(s => s.setSidebarTab);

  return (
    <aside
      className="flex flex-col shrink-0 border-r overflow-hidden"
      style={{ width: 320, background: '#111827', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Tab strip */}
      <div className="flex border-b shrink-0 overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 text-xs font-medium transition-colors shrink-0"
            style={{
              fontFamily: 'Rajdhani',
              letterSpacing: '0.05em',
              color: tab === t.id ? '#f59e0b' : '#6b7280',
              borderBottom: tab === t.id ? '2px solid #f59e0b' : '2px solid transparent',
              background: 'transparent',
              minWidth: 42,
            }}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'resources'  && <ResourcePanel />}
        {tab === 'ngos'       && <NGODirectoryPanel />}
        {tab === 'stats'      && <div className="p-3"><NGOScoreboard /></div>}
        {tab === 'mutual_aid' && <div className="p-3"><MutualAidPanel /></div>}
        {tab === 'ai'         && <AIAllocationAdvisor />}
        {tab === 'tracker'    && <ResourceTracker />}
      </div>
    </aside>
  );
}
