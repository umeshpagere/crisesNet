import { useEffect } from 'react';
import { useDashboardStore, type NGOStat } from '../store/useDashboardStore';

const API = 'http://localhost:8080/api/v1';

function RingChart({ pct, colour }: { pct: number; colour: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={52} height={52} viewBox="0 0 52 52">
      <circle cx={26} cy={26} r={r} fill="none" stroke="#ffffff0f" strokeWidth={5} />
      <circle
        cx={26} cy={26} r={r} fill="none"
        stroke={colour} strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
      />
      <text x={26} y={30} textAnchor="middle" style={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#f9fafb', fontWeight: 700 }}>
        {pct}%
      </text>
    </svg>
  );
}

function StatCard({ stat }: { stat: NGOStat }) {
  const rtColor = stat.response_time_avg <= 8 ? '#10b981' : stat.response_time_avg <= 15 ? '#f59e0b' : '#ef4444';
  return (
    <div
      className="rounded-xl p-3 mb-2"
      style={{ background: '#ffffff07', border: `1px solid ${stat.colour}22` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, color: stat.colour }}>
            {stat.name}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'JetBrains Mono' }}>
            {stat.ngo_id}
          </div>
        </div>
        <RingChart pct={stat.coverage_pct} colour={stat.colour} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div style={{ fontSize: 15, fontFamily: 'JetBrains Mono', fontWeight: 700, color: rtColor }}>
            {stat.response_time_avg}m
          </div>
          <div style={{ fontSize: 9, color: '#6b7280' }}>Avg ETA</div>
        </div>
        <div className="text-center">
          <div style={{ fontSize: 15, fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#d1d5db' }}>
            {stat.people_reached}
          </div>
          <div style={{ fontSize: 9, color: '#6b7280' }}>Reached</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span style={{ fontSize: 12, color: '#f59e0b', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{stat.resources_deployed}</span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>/</span>
            <span style={{ fontSize: 12, color: '#10b981', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{stat.resources_available}</span>
          </div>
          <div style={{ fontSize: 9, color: '#6b7280' }}>Dep/Avail</div>
        </div>
      </div>
      {/* Utilisation bar */}
      <div className="mt-2">
        <div className="flex justify-between mb-0.5">
          <span style={{ fontSize: 9, color: '#6b7280' }}>Utilisation</span>
          <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>
            {stat.resources_deployed + stat.resources_available > 0
              ? Math.round((stat.resources_deployed / (stat.resources_deployed + stat.resources_available)) * 100)
              : 0}%
          </span>
        </div>
        <div className="w-full h-1 rounded overflow-hidden" style={{ background: '#ffffff10' }}>
          <div
            className="h-full rounded transition-all"
            style={{
              width: `${stat.resources_deployed + stat.resources_available > 0
                ? Math.round((stat.resources_deployed / (stat.resources_deployed + stat.resources_available)) * 100)
                : 0}%`,
              background: stat.colour,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function NGOScoreboard() {
  const ngoStats    = useDashboardStore(s => s.ngoStats);
  const setNGOStats = useDashboardStore(s => s.setNGOStats);

  useEffect(() => {
    const load = () =>
      fetch(`${API}/ngo-stats`)
        .then(r => r.json())
        .then(json => setNGOStats(json.stats ?? []))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [setNGOStats]);

  const totalPeople  = ngoStats.reduce((s, n) => s + n.people_reached, 0);
  const avgETA       = ngoStats.length ? (ngoStats.reduce((s, n) => s + n.response_time_avg, 0) / ngoStats.length).toFixed(1) : '—';
  const totalDep     = ngoStats.reduce((s, n) => s + n.resources_deployed, 0);

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg" style={{ background: '#ffffff05' }}>
        <div className="text-center">
          <div style={{ fontSize: 18, fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#f59e0b' }}>{totalPeople}</div>
          <div style={{ fontSize: 9, color: '#6b7280' }}>PEOPLE REACHED</div>
        </div>
        <div className="text-center">
          <div style={{ fontSize: 18, fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#3b82f6' }}>{avgETA}m</div>
          <div style={{ fontSize: 9, color: '#6b7280' }}>AVG RESPONSE</div>
        </div>
        <div className="text-center">
          <div style={{ fontSize: 18, fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#10b981' }}>{totalDep}</div>
          <div style={{ fontSize: 9, color: '#6b7280' }}>DEPLOYED</div>
        </div>
      </div>

      {ngoStats.length === 0 && (
        <p className="text-center py-4" style={{ fontSize: 12, color: '#6b7280' }}>Loading NGO stats…</p>
      )}

      {ngoStats.map(stat => (
        <StatCard key={stat.ngo_id} stat={stat} />
      ))}
    </div>
  );
}
