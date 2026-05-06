import { lazy, Suspense } from 'react';
import { useSSEStream } from './hooks/useSSEStream';
import { useDashboardStore } from './store/useDashboardStore';
import NGOSetupModal from './components/NGOSetupModal';
import CommandBar from './components/CommandBar';
import Sidebar from './components/Sidebar';
import BottomStrip from './components/BottomStrip';
import AlertToast from './components/AlertToast';
import CrisisDetailPanel from './components/CrisisDetailPanel';

const LiveMap = lazy(() => import('./components/LiveMap'));

const SSE_URL = 'http://localhost:8080/api/v1/stream/live-ops';

export default function App() {
  useSSEStream(SSE_URL);

  const myNGO = useDashboardStore(s => s.myNGO);
  const selectedCrisis = useDashboardStore(s => s.selectedCrisis);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: '#0a0c10' }}>
      {/* NGO onboarding — blocks full screen until registered */}
      {!myNGO && <NGOSetupModal />}

      {/* ZONE 1 — Top Command Bar */}
      <CommandBar />

      {/* Middle area: sidebar + map + crisis panel */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ZONE 2 — Left Sidebar (320px) */}
        <Sidebar />

        {/* ZONE 3 — Main Map */}
        <div className="flex-1 relative overflow-hidden">
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0c10' }}><span style={{ color: '#f59e0b', fontFamily: 'Rajdhani' }} className="text-xl">Loading map…</span></div>}>
            <LiveMap />
          </Suspense>
        </div>

        {/* ZONE 4 — Crisis detail slide panel (right) */}
        {selectedCrisis && <CrisisDetailPanel />}
      </div>

      {/* ZONE 5 — Bottom Strip */}
      <BottomStrip />

      {/* Toast notifications overlay */}
      <AlertToast />
    </div>
  );
}

