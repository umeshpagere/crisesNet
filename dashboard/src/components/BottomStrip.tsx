import { useState, useRef, useEffect } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

const TABS = [
  { id: 'chat',   label: 'COORD CHAT', icon: '💬' },
  { id: 'feed',   label: 'EVENT FEED', icon: '📡' },
  { id: 'report', label: 'OPS REPORT', icon: '📋' },
] as const;

export default function BottomStrip() {
  const bottomTab     = useDashboardStore(s => s.bottomTab);
  const setBottomTab  = useDashboardStore(s => s.setBottomTab);
  const expanded      = useDashboardStore(s => s.bottomExpanded);
  const toggle        = useDashboardStore(s => s.toggleBottomPanel);

  return (
    <div
      className="shrink-0 border-t flex flex-col"
      style={{
        height: expanded ? 220 : 40,
        transition: 'height 0.2s ease',
        background: '#111827',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', height: 40 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setBottomTab(t.id); if (!expanded) toggle(); }}
            className="flex items-center gap-1.5 px-4 h-full text-xs font-medium"
            style={{
              fontFamily: 'Rajdhani',
              letterSpacing: '0.06em',
              color: bottomTab === t.id ? '#f59e0b' : '#6b7280',
              borderBottom: bottomTab === t.id ? '2px solid #f59e0b' : '2px solid transparent',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={toggle}
          className="px-3 h-full text-xs"
          style={{ color: '#6b7280' }}
        >{expanded ? '▼' : '▲'}</button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="flex-1 overflow-hidden">
          {bottomTab === 'chat'   && <ChatPanel />}
          {bottomTab === 'feed'   && <EventFeed />}
          {bottomTab === 'report' && <QuickStats />}
        </div>
      )}
    </div>
  );
}

function ChatPanel() {
  const myNGO        = useDashboardStore(s => s.myNGO);
  const messages     = useDashboardStore(s => s.chatMessages);
  const addMessage   = useDashboardStore(s => s.addChatMessage);
  const [text, setText] = useState('');
  const bottomRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!text.trim() || !myNGO) return;
    const msg = {
      ngo_id: myNGO.ngo_id,
      ngo_name: myNGO.name,
      ngo_colour: myNGO.colour,
      message: text.trim(),
      timestamp: new Date().toISOString(),
      type: 'human' as const,
    };
    addMessage(msg);
    setText('');
    try {
      await fetch('http://localhost:8080/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      });
    } catch { /* offline */ }
  }

  return (
    <div className="flex h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1.5" style={{ fontSize: 12 }}>
        {messages.length === 0 && (
          <div className="text-xs text-center py-4" style={{ color: '#6b7280' }}>
            No messages yet. Send a coordination update to other NGOs.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: m.ngo_colour }} />
            <span className="font-bold shrink-0" style={{ fontFamily: 'Rajdhani', color: m.ngo_colour, minWidth: 90 }}>{m.ngo_name}</span>
            <span style={{ color: '#d1d5db' }}>{m.message}</span>
            <span className="ml-auto shrink-0 text-xs" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 border-l" style={{ width: 280, borderColor: 'rgba(255,255,255,0.06)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Broadcast to all NGOs…"
          className="flex-1 px-3 py-2 rounded text-xs outline-none"
          style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', color: '#f9fafb' }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || !myNGO}
          className="px-3 py-2 rounded text-xs font-bold"
          style={{ background: '#f59e0b', color: '#000', fontFamily: 'Rajdhani', opacity: (!text.trim() || !myNGO) ? 0.5 : 1 }}
        >SEND</button>
      </div>
    </div>
  );
}

function EventFeed() {
  const alerts = useDashboardStore(s => s.alerts);
  const gapZones = useDashboardStore(s => s.gapZones);

  const feedItems = [
    ...alerts.slice(0, 10).map(a => ({ ts: a.timestamp, text: `[${a.level.toUpperCase()}] ${a.title} — ${a.body}`, colour: a.level === 'critical' ? '#ef4444' : a.level === 'overlap' ? '#f59e0b' : '#10b981' })),
    ...gapZones.slice(0, 3).map(g => ({ ts: new Date().toISOString(), text: `[GAP] ${g.affected_people} people unserved at ${g.lat.toFixed(3)}, ${g.lng.toFixed(3)} — priority ${g.priority_score.toFixed(1)}`, colour: '#3b82f6' })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <div className="overflow-y-auto h-full px-4 py-2 flex flex-col gap-1" style={{ fontSize: 12 }}>
      {feedItems.length === 0 ? (
        <div className="text-xs text-center py-4" style={{ color: '#6b7280' }}>Waiting for live events…</div>
      ) : (
        feedItems.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-xs shrink-0" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono', fontSize: 10, minWidth: 60 }}>
              {new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-xs" style={{ color: item.colour }}>{item.text}</span>
          </div>
        ))
      )}
    </div>
  );
}

function QuickStats() {
  const allResources = useDashboardStore(s => s.allResources);
  const activeNGOs   = useDashboardStore(s => s.activeNGOs);
  const gapZones     = useDashboardStore(s => s.gapZones);
  const assignments  = useDashboardStore(s => s.assignments);

  const stats = [
    { label: 'Total Resources', value: allResources.length },
    { label: 'Deployed',        value: allResources.filter(r => r.status === 'deployed').length },
    { label: 'NGOs Online',     value: activeNGOs.filter(n => n.status === 'online').length },
    { label: 'Assignments',     value: assignments.length },
    { label: 'Coverage Gaps',   value: gapZones.length },
    { label: 'People at Risk',  value: gapZones.reduce((s, g) => s + g.affected_people, 0) },
  ];

  return (
    <div className="flex items-center gap-6 px-6 h-full overflow-x-auto">
      {stats.map(s => (
        <div key={s.label} className="flex flex-col items-center shrink-0">
          <span className="text-xl font-bold" style={{ fontFamily: 'JetBrains Mono', color: '#f59e0b' }}>{s.value}</span>
          <span className="text-xs" style={{ color: '#6b7280', fontFamily: 'Rajdhani', letterSpacing: '0.05em' }}>{s.label.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}
