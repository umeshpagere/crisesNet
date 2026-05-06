import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

const DISTRICTS = [
  'Nashik', 'Sinnar', 'Igatpuri', 'Trimbakeshwar', 'Nandgaon',
  'Chandwad', 'Malegaon', 'Niphad', 'Dindori', 'Peth',
  'Surgana', 'Kalwan', 'Deola', 'Baglan', 'Yevla'
];
const RESOURCE_TYPES = ['Boats', 'Medical', 'Food & Water', 'Shelter', 'Rescue Team'];

export default function NGOSetupModal() {
  const setMyNGO = useDashboardStore(s => s.setMyNGO);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [zone, setZone] = useState('');
  const [resTypes, setResTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleType(t: string) {
    setResTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !zone) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:8080/api/v1/ngos/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), zone, resource_types: resTypes }),
      });
      const data = await res.json();

      setMyNGO({
        ngo_id: data.ngo_id,
        name: name.trim(),
        contact: contact.trim(),
        zone,
        resource_types: resTypes,
        colour: data.colour,
        status: 'online',
        last_seen: new Date().toISOString(),
      });
    } catch {
      // Offline fallback — still let them in with a local ID
      const colours = ['#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899'];
      const colour = colours[Math.floor(Math.random() * colours.length)];
      const ngo_id = `NGO_${name.trim().toUpperCase().replace(/\s+/g, '_')}`;
      setMyNGO({ ngo_id, name: name.trim(), contact: contact.trim(), zone, resource_types: resTypes, colour, status: 'online', last_seen: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,12,16,0.97)' }}>
      <div className="w-full max-w-md p-8 rounded-xl border" style={{ background: '#111827', borderColor: 'rgba(245,158,11,0.3)' }}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">⚡</span>
          <div>
            <div className="text-2xl font-bold tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#f59e0b' }}>CRISISNET</div>
            <div className="text-xs" style={{ color: '#6b7280', letterSpacing: '0.1em' }}>NGO COMMAND CENTRE</div>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>Register Your NGO</h2>
        <p className="text-sm mb-6" style={{ color: '#6b7280' }}>Join the live operations grid to coordinate with other NGOs.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#9ca3af', letterSpacing: '0.08em' }}>NGO NAME *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Relief India"
              className="w-full px-3 py-2 rounded text-sm outline-none focus:ring-1"
              style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', color: '#f9fafb', '--tw-ring-color': '#f59e0b' } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#9ca3af', letterSpacing: '0.08em' }}>CONTACT PERSON *</label>
            <input
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', color: '#f9fafb' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#9ca3af', letterSpacing: '0.08em' }}>PRIMARY ZONE *</label>
            <select
              value={zone}
              onChange={e => setZone(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', color: zone ? '#f9fafb' : '#6b7280' }}
            >
              <option value="">Select district…</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#9ca3af', letterSpacing: '0.08em' }}>RESOURCE TYPES</label>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className="px-3 py-1 rounded text-xs font-medium transition-all"
                  style={{
                    background: resTypes.includes(t) ? '#f59e0b' : '#1f2937',
                    color: resTypes.includes(t) ? '#000' : '#9ca3af',
                    border: `1px solid ${resTypes.includes(t) ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded font-bold text-base tracking-wider transition-all mt-2"
            style={{
              fontFamily: 'Rajdhani',
              background: loading ? '#374151' : '#f59e0b',
              color: loading ? '#9ca3af' : '#000',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'JOINING…' : 'JOIN OPERATIONS CENTRE'}
          </button>
        </form>
      </div>
    </div>
  );
}
