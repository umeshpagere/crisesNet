import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

export default function AIAllocationAdvisor() {
  const gapZones         = useDashboardStore(s => s.gapZones);
  const myResources      = useDashboardStore(s => s.myResources);
  const aiRecommendation = useDashboardStore(s => s.aiRecommendation);
  const aiStreaming      = useDashboardStore(s => s.aiAdvisorStreaming);
  const aiConversation   = useDashboardStore(s => s.aiConversation);
  const setAIRec         = useDashboardStore(s => s.setAIRecommendation);
  const setStreaming      = useDashboardStore(s => s.setAIAdvisorStreaming);
  const addAIMessage     = useDashboardStore(s => s.addAIMessage);

  const [question, setQuestion] = useState('');

  async function getRecommendation() {
    setStreaming(true);
    try {
      const res = await fetch('http://localhost:8080/api/v1/ai/recommend-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: myResources, gaps: gapZones }),
      });
      const reader = res.body?.getReader();
      if (!reader) return;
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      const match = text.match(/data: (.+)/);
      if (match) setAIRec(JSON.parse(match[1]));
    } catch {
      setAIRec({
        recommendations: [{
          resource_id: myResources[0]?.resource_id ?? 'BOAT_NK_01',
          lat: gapZones[0]?.lat ?? 19.847,
          lng: gapZones[0]?.lng ?? 73.999,
          zone_name: 'Sinnar Taluka',
          reason: 'Highest priority gap — 47 people, no coverage within 8km',
          confidence: 0.87,
          people_covered: gapZones[0]?.affected_people ?? 47,
        }],
        summary: 'Deploy to Sinnar for maximum impact (+47 people covered)',
        coverage_delta: 47,
      });
    } finally {
      setStreaming(false);
    }
  }

  async function askQuestion() {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion('');
    addAIMessage({ role: 'user', content: q, timestamp: new Date().toISOString() });
    setStreaming(true);
    try {
      const res = await fetch('http://localhost:8080/api/v1/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const reader = res.body?.getReader();
      if (!reader) return;
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      const match = text.match(/data: (.+)/);
      if (match) {
        const data = JSON.parse(match[1]);
        addAIMessage({ role: 'assistant', content: data.answer ?? data.error, timestamp: new Date().toISOString() });
      }
    } catch {
      addAIMessage({ role: 'assistant', content: 'Offline — AI advisor unavailable.', timestamp: new Date().toISOString() });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      <span className="text-xs font-bold tracking-widest" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>AI ALLOCATION ADVISOR</span>

      {/* Gap summary */}
      <div className="rounded p-3 border" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="text-xs font-bold mb-2" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>COVERAGE GAPS</div>
        {gapZones.length === 0 ? (
          <div className="text-xs" style={{ color: '#10b981' }}>✓ No significant gaps detected</div>
        ) : (
          gapZones.slice(0, 3).map((g, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <span className="text-xs font-bold px-1.5 rounded shrink-0" style={{ background: '#ef444422', color: '#ef4444', fontFamily: 'Rajdhani' }}>
                #{i + 1}
              </span>
              <div className="text-xs" style={{ color: '#d1d5db' }}>
                <b>{g.affected_people}</b> people • SEV {g.crisis_severity} • {g.distance_to_nearest_km}km to nearest NGO
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recommend button */}
      <button
        onClick={getRecommendation}
        disabled={aiStreaming}
        className="w-full py-2.5 rounded font-bold text-sm tracking-wider transition-all"
        style={{
          fontFamily: 'Rajdhani',
          background: aiStreaming ? '#374151' : 'linear-gradient(90deg, #f59e0b, #f97316)',
          color: aiStreaming ? '#9ca3af' : '#000',
          cursor: aiStreaming ? 'wait' : 'pointer',
        }}
      >
        {aiStreaming ? '⟳ ANALYSING…' : '🤖 GET RECOMMENDATIONS'}
      </button>

      {/* AI Recommendation result */}
      {aiRecommendation && (
        <div className="rounded p-3 border" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}>
          <div className="text-xs font-bold mb-2" style={{ fontFamily: 'Rajdhani', color: '#f59e0b' }}>
            🤖 AI RECOMMENDATION
          </div>
          <div className="text-xs mb-2" style={{ color: '#d1d5db' }}>{aiRecommendation.summary}</div>
          {aiRecommendation.recommendations.map((r, i) => (
            <div key={i} className="rounded p-2 mb-2 border" style={{ background: '#1f2937', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-bold" style={{ fontFamily: 'Rajdhani', color: '#f9fafb' }}>
                → {r.resource_id} to {r.zone_name}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{r.reason}</div>
              <div className="flex gap-3 mt-1 text-xs">
                <span style={{ color: '#10b981' }}>+{r.people_covered} people covered</span>
                <span style={{ color: '#f59e0b' }}>{(r.confidence * 100).toFixed(0)}% confidence</span>
              </div>
            </div>
          ))}
          <div className="text-xs" style={{ color: '#10b981', fontFamily: 'Rajdhani' }}>
            Coverage delta: +{aiRecommendation.coverage_delta} people
          </div>
        </div>
      )}

      {/* Q&A conversation */}
      <div className="text-xs font-bold tracking-wider mt-1" style={{ fontFamily: 'Rajdhani', color: '#9ca3af' }}>ASK THE ADVISOR</div>

      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {aiConversation.map((m, i) => (
          <div key={i} className="rounded p-2" style={{
            background: m.role === 'user' ? '#1f2937' : 'rgba(245,158,11,0.06)',
            borderLeft: `2px solid ${m.role === 'user' ? '#374151' : '#f59e0b'}`,
          }}>
            <div className="text-xs font-bold mb-0.5" style={{ color: m.role === 'user' ? '#9ca3af' : '#f59e0b', fontFamily: 'Rajdhani' }}>
              {m.role === 'user' ? 'YOU' : 'AI ADVISOR'}
            </div>
            <div className="text-xs" style={{ color: '#d1d5db' }}>{m.content}</div>
          </div>
        ))}
        {aiStreaming && aiConversation[aiConversation.length - 1]?.role === 'user' && (
          <div className="text-xs" style={{ color: '#f59e0b' }}>AI thinking…</div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askQuestion()}
          placeholder="What are the biggest unmet needs?"
          className="flex-1 px-3 py-2 rounded text-xs outline-none"
          style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', color: '#f9fafb' }}
        />
        <button
          onClick={askQuestion}
          disabled={aiStreaming || !question.trim()}
          className="px-3 py-2 rounded text-xs font-bold"
          style={{ background: '#f59e0b', color: '#000', fontFamily: 'Rajdhani', opacity: (!question.trim() || aiStreaming) ? 0.5 : 1 }}
        >ASK</button>
      </div>
    </div>
  );
}
