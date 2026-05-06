import { useEffect, useState } from 'react';
import { useDashboardStore, type MutualAidRequest } from '../store/useDashboardStore';

const API = 'http://localhost:8080/api/v1';

const RESOURCE_TYPES = ['boat', 'medical', 'food', 'rescue', 'shelter'];
const STATUS_COLOR: Record<string, string> = {
  pending:  '#f59e0b',
  accepted: '#10b981',
  declined: '#ef4444',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function MutualAidPanel() {
  const myNGO              = useDashboardStore(s => s.myNGO);
  const activeNGOs         = useDashboardStore(s => s.activeNGOs);
  const mutualAidRequests  = useDashboardStore(s => s.mutualAidRequests);
  const setMutualAidRequests = useDashboardStore(s => s.setMutualAidRequests);
  const addMutualAidRequest  = useDashboardStore(s => s.addMutualAidRequest);

  const [showForm, setShowForm]           = useState(false);
  const [toNGO, setToNGO]                 = useState('');
  const [resType, setResType]             = useState(RESOURCE_TYPES[0]);
  const [quantity, setQuantity]           = useState(1);
  const [message, setMessage]             = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [filterTab, setFilterTab]         = useState<'all' | 'incoming' | 'outgoing'>('all');

  useEffect(() => {
    const load = () =>
      fetch(`${API}/mutual-aid/requests`)
        .then(r => r.json())
        .then(json => setMutualAidRequests(json.requests ?? []))
        .catch(() => {});
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [setMutualAidRequests]);

  const filtered = mutualAidRequests.filter(r => {
    if (filterTab === 'incoming') return r.to_ngo === myNGO?.ngo_id;
    if (filterTab === 'outgoing') return r.from_ngo === myNGO?.ngo_id;
    return true;
  });

  const handleSubmit = async () => {
    if (!myNGO || !toNGO) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/mutual-aid/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_ngo: myNGO.ngo_id, to_ngo: toNGO, resource_type: resType, quantity, message }),
      });
      const json = await res.json();
      addMutualAidRequest({
        request_id: json.request_id, from_ngo: myNGO.ngo_id, to_ngo: toNGO,
        resource_type: resType, quantity, message, status: 'pending', created_at: new Date().toISOString(),
      });
      setShowForm(false);
      setToNGO(''); setMessage(''); setQuantity(1);
    } catch {
      // swallow
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (req: MutualAidRequest, status: 'accepted' | 'declined') => {
    await fetch(`${API}/mutual-aid/requests/${req.request_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setMutualAidRequests(mutualAidRequests.map(r => r.request_id === req.request_id ? { ...r, status } : r));
  };

  const otherNGOs = activeNGOs.filter(n => n.ngo_id !== myNGO?.ngo_id);

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Filter tabs + request button */}
      <div className="flex items-center gap-1 mb-3">
        {(['all', 'incoming', 'outgoing'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterTab(t)}
            className="flex-1 py-1 rounded text-xs capitalize transition-colors"
            style={{
              background: filterTab === t ? '#f59e0b22' : '#ffffff0a',
              color: filterTab === t ? '#f59e0b' : '#6b7280',
              border: `1px solid ${filterTab === t ? '#f59e0b44' : 'transparent'}`,
              fontFamily: 'Rajdhani', fontWeight: 600, letterSpacing: '0.04em',
            }}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-1 px-2 py-1 rounded text-xs font-bold"
          style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
        >
          + Request
        </button>
      </div>

      {/* Request form */}
      {showForm && (
        <div className="mb-3 p-3 rounded-xl" style={{ background: '#ffffff08', border: '1px solid #ffffff15' }}>
          <p style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, color: '#f59e0b', marginBottom: 8 }}>🤝 REQUEST MUTUAL AID</p>

          <select
            value={toNGO} onChange={e => setToNGO(e.target.value)}
            className="w-full mb-2 px-2 py-1.5 rounded text-sm"
            style={{ background: '#0d1117', border: '1px solid #ffffff20', color: '#f9fafb' }}
          >
            <option value="">— Select recipient NGO —</option>
            {otherNGOs.map(n => <option key={n.ngo_id} value={n.ngo_id}>{n.name}</option>)}
          </select>

          <div className="flex gap-2 mb-2">
            <select
              value={resType} onChange={e => setResType(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded text-sm"
              style={{ background: '#0d1117', border: '1px solid #ffffff20', color: '#f9fafb' }}
            >
              {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="number" min={1} max={20} value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value))}
              className="w-16 px-2 py-1.5 rounded text-sm text-center"
              style={{ background: '#0d1117', border: '1px solid #ffffff20', color: '#f9fafb', fontFamily: 'JetBrains Mono' }}
            />
          </div>

          <textarea
            rows={2} placeholder="Optional message…" value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full px-2 py-1.5 rounded text-sm resize-none mb-2"
            style={{ background: '#0d1117', border: '1px solid #ffffff20', color: '#f9fafb' }}
          />

          <div className="flex gap-2">
            <button
              onClick={handleSubmit} disabled={!toNGO || submitting}
              className="flex-1 py-1.5 rounded text-sm font-bold disabled:opacity-40"
              style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
            >
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded text-xs" style={{ background: '#ffffff0a', color: '#6b7280' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Request list */}
      {filtered.length === 0 && (
        <p className="text-center py-4" style={{ fontSize: 12, color: '#6b7280' }}>
          {filterTab === 'incoming' ? 'No incoming requests' : filterTab === 'outgoing' ? 'No outgoing requests' : 'No mutual aid requests yet'}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map(req => {
          const isIncoming = req.to_ngo === myNGO?.ngo_id;
          return (
            <div key={req.request_id} className="rounded-xl p-3" style={{ background: '#ffffff07', border: `1px solid ${STATUS_COLOR[req.status]}22` }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#6b7280' }}>{req.request_id}</span>
                <span style={{ fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 600, color: STATUS_COLOR[req.status], letterSpacing: '0.05em' }}>
                  {req.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 4 }}>
                <span style={{ color: '#9ca3af' }}>{isIncoming ? 'From' : 'To'}:</span>{' '}
                <span style={{ fontWeight: 600 }}>{isIncoming ? req.from_ngo : req.to_ngo}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: '#ffffff10', color: '#d1d5db', fontFamily: 'Rajdhani', fontWeight: 600 }}>
                  {req.quantity}× {req.resource_type}
                </span>
                <span style={{ fontSize: 10, color: '#6b7280' }}>{timeAgo(req.created_at)}</span>
              </div>
              {req.message && <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>"{req.message}"</p>}
              {isIncoming && req.status === 'pending' && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleRespond(req, 'accepted')} className="flex-1 py-1 rounded text-xs font-bold" style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' }}>
                    ✓ Accept
                  </button>
                  <button onClick={() => handleRespond(req, 'declined')} className="flex-1 py-1 rounded text-xs font-bold" style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444' }}>
                    ✕ Decline
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
