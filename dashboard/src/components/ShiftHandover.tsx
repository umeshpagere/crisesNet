import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

interface Props { onClose: () => void; }

export default function ShiftHandover({ onClose }: Props) {
  const myNGO      = useDashboardStore(s => s.myNGO);
  const allResources = useDashboardStore(s => s.allResources);
  const gapZones   = useDashboardStore(s => s.gapZones);
  const assignments= useDashboardStore(s => s.assignments);
  const alerts     = useDashboardStore(s => s.alerts);

  const [briefing, setBriefing] = useState('');
  const [loading, setLoading]   = useState(false);
  const [incomingShift, setIncomingShift] = useState('');
  const [sent, setSent]         = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/v1/ai/handover-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngo_id: myNGO?.ngo_id }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      const match = text.match(/data: (.+)/);
      if (match) {
        const data = JSON.parse(match[1]);
        setBriefing(data.briefing ?? '');
      }
    } catch {
      const deployed = allResources.filter(r => r.status === 'deployed').length;
      const unserved = gapZones.reduce((s, g) => s + g.affected_people, 0);
      setBriefing(
        `SHIFT HANDOVER — ${new Date().toLocaleString()}\n\nNGO: ${myNGO?.name ?? 'Unknown'} | Zone: ${myNGO?.zone ?? '—'}\n\nSITREP:\n` +
        `• ${allResources.length} resources registered, ${deployed} currently deployed\n` +
        `• ${assignments.length} active crisis assignments\n` +
        `• ${gapZones.length} coverage gaps, ${unserved} people unserved\n` +
        `• ${alerts.filter(a => !a.read).length} unresolved alerts\n\n` +
        `PRIORITY ACTIONS FOR INCOMING SHIFT:\n` +
        gapZones.slice(0, 3).map((g, i) => `${i + 1}. Deploy to ${g.crisis_type} zone — ${g.affected_people} people, priority ${g.priority_score.toFixed(1)}`).join('\n')
      );
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(briefing);
  }

  function simulateSendEmail() {
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,12,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-xl border flex flex-col" style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.1)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="font-bold tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#f59e0b', fontSize: 16 }}>🔄 SHIFT HANDOVER</span>
          <button onClick={onClose} style={{ color: '#6b7280' }}>✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* Generate */}
          {!briefing && (
            <button
              onClick={generate}
              disabled={loading}
              className="w-full py-3 rounded font-bold tracking-wider"
              style={{ fontFamily: 'Rajdhani', background: loading ? '#374151' : 'linear-gradient(90deg,#f59e0b,#f97316)', color: loading ? '#9ca3af' : '#000' }}
            >
              {loading ? '⟳ GENERATING AI BRIEFING…' : '🤖 GENERATE BRIEFING'}
            </button>
          )}

          {/* Briefing output */}
          {briefing && (
            <>
              <div
                className="rounded p-4 text-xs leading-relaxed whitespace-pre-wrap border overflow-y-auto"
                style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.07)', color: '#d1d5db', fontFamily: 'JetBrains Mono', maxHeight: 280 }}
              >
                {briefing}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#9ca3af', fontFamily: 'Rajdhani', letterSpacing: '0.06em' }}>
                  INCOMING SHIFT CONTACT (EMAIL)
                </label>
                <input
                  value={incomingShift}
                  onChange={e => setIncomingShift(e.target.value)}
                  placeholder="incoming-team@ngo.org"
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', color: '#f9fafb' }}
                />
              </div>

              <div className="flex gap-2">
                <button onClick={copyToClipboard} className="flex-1 py-2 rounded text-xs font-bold" style={{ fontFamily: 'Rajdhani', background: '#1f2937', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                  📋 COPY
                </button>
                <button onClick={generate} disabled={loading} className="flex-1 py-2 rounded text-xs font-bold" style={{ fontFamily: 'Rajdhani', background: '#1f2937', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                  ↺ REGENERATE
                </button>
                <button
                  onClick={simulateSendEmail}
                  disabled={sent}
                  className="flex-1 py-2 rounded text-xs font-bold"
                  style={{ fontFamily: 'Rajdhani', background: sent ? '#10b981' : '#f59e0b', color: '#000' }}
                >
                  {sent ? '✓ SENT!' : '📧 SEND'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
