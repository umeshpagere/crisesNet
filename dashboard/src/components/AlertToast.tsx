import { useState, useEffect } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

const LEVEL_STYLE: Record<string, { bg: string; border: string; icon: string }> = {
  critical: { bg: 'rgba(239,68,68,0.12)',  border: '#ef4444', icon: '🚨' },
  overlap:  { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', icon: '⚠' },
  resolved: { bg: 'rgba(16,185,129,0.12)', border: '#10b981', icon: '✓' },
  chat:     { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', icon: '💬' },
};

export default function AlertToast() {
  const alerts = useDashboardStore(s => s.alerts);
  const dismiss = useDashboardStore(s => s.dismissAlert);

  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    if (alerts.length === 0) return;
    const latest = alerts[0];
    if (!visible.includes(latest.id)) {
      setVisible(prev => [latest.id, ...prev].slice(0, 4));
      const timer = setTimeout(() => {
        setVisible(prev => prev.filter(id => id !== latest.id));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [alerts]);

  const toasts = alerts.filter(a => visible.includes(a.id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 340 }}>
      {toasts.map(alert => {
        const style = LEVEL_STYLE[alert.level] ?? LEVEL_STYLE.chat;
        return (
          <div
            key={alert.id}
            className="toast-enter rounded-lg p-3 flex items-start gap-3 pointer-events-auto shadow-2xl"
            style={{ background: style.bg, border: `1px solid ${style.border}`, backdropFilter: 'blur(8px)' }}
          >
            <span className="text-lg shrink-0 mt-0.5">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold mb-0.5 truncate" style={{ fontFamily: 'Rajdhani', color: style.border }}>
                {alert.title}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: '#d1d5db' }}>{alert.body}</div>
            </div>
            <button
              onClick={() => { dismiss(alert.id); setVisible(p => p.filter(id => id !== alert.id)); }}
              className="shrink-0 text-sm leading-none mt-0.5"
              style={{ color: '#6b7280' }}
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}
