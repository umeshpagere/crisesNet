import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NGOProfile {
  ngo_id: string;
  name: string;
  contact: string;
  zone: string;
  resource_types: string[];
  colour: string;
  status: 'online' | 'offline';
  last_seen: string;
}

export interface Resource {
  resource_id: string;
  ngo_id: string;
  type: 'boat' | 'medical' | 'food' | 'rescue' | 'shelter';
  name: string;
  capacity: number;
  lat: number;
  lng: number;
  status: 'available' | 'deployed' | 'returning' | 'maintenance';
  assigned_crisis_id: string | null;
  battery_pct: number;
  speed: number;
  heading: number;
  updated_at: string;
}

export interface Crisis {
  id: string;
  type: string;
  severity: number;
  lat: number;
  lng: number;
  affected_count: number;
  description: string;
  timestamp: string;
  status: 'active' | 'resolved';
  assignments?: CrisisAssignment[];
}

export interface CrisisAssignment {
  crisis_id: string;
  resource_id: string;
  ngo_id: string;
  assigned_at: string;
  eta_minutes: number;
  status: string;
}

export interface CoverageZone {
  zone_id: string;
  ngo_id: string;
  polygon_coords: [number, number][];
  zone_name: string;
  claimed_at: string;
}

export interface GapZone {
  lat: number;
  lng: number;
  radius_km: number;
  affected_people: number;
  nearest_ngo: string;
  distance_to_nearest_km: number;
  crisis_severity: number;
  priority_score: number;
  crisis_id: string;
  crisis_type: string;
}

export interface ChatMessage {
  ngo_id: string;
  ngo_name: string;
  ngo_colour: string;
  message: string;
  timestamp: string;
  type: 'human' | 'ai' | 'system';
}

export interface AppAlert {
  id: string;
  level: 'critical' | 'overlap' | 'resolved' | 'chat';
  title: string;
  body: string;
  crisis_id?: string;
  timestamp: string;
  read: boolean;
}

export interface OverlapWarning {
  ngo_a: string;
  ngo_b: string;
  crisis_id: string;
  distance_km: number;
  zone_name: string;
}

export interface AllocationRecommendation {
  recommendations: {
    resource_id: string;
    lat: number;
    lng: number;
    zone_name: string;
    reason: string;
    confidence: number;
    people_covered: number;
  }[];
  summary: string;
  coverage_delta: number;
}

export type HeatmapMode = 'intensity' | 'resource' | 'population' | 'response_time' | 'timelapse';

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  [key: string]: unknown;
}

export interface TemporalSlice {
  slice_index: number;
  slice_start: string;
  slice_end: string;
  label: string;
  hotspots: HeatmapPoint[];
}

export interface NGOStat {
  ngo_id: string;
  name: string;
  colour: string;
  coverage_pct: number;
  response_time_avg: number;
  people_reached: number;
  resources_deployed: number;
  resources_available: number;
}

export interface MutualAidRequest {
  request_id: string;
  from_ngo: string;
  to_ngo: string;
  resource_type: string;
  quantity: number;
  crisis_id?: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface PlannedRoute {
  resource_id: string;
  resource_name: string;
  crisis_id: string;
  crisis_type: string;
  distance_km: number;
  eta_minutes: number;
  speed_kmh: number;
  waypoints: { lat: number; lng: number; label: string; type: string }[];
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ── Store Interface ────────────────────────────────────────────────────────

interface DashboardStore {
  // Identity
  myNGO: NGOProfile | null;
  setMyNGO: (ngo: NGOProfile) => void;
  clearMyNGO: () => void;

  // Resources
  myResources: Resource[];
  allResources: Resource[];
  setAllResources: (resources: Resource[]) => void;
  updateResource: (id: string, patch: Partial<Resource>) => void;
  addResource: (r: Resource) => void;
  gpsTrackedIds: string[];
  addGPSTracked: (id: string) => void;
  removeGPSTracked: (id: string) => void;

  // NGOs
  activeNGOs: NGOProfile[];
  setActiveNGOs: (ngos: NGOProfile[]) => void;

  // Crises
  activeCrises: Crisis[];
  setActiveCrises: (crises: Crisis[]) => void;
  selectedCrisis: Crisis | null;
  setSelectedCrisis: (crisis: Crisis | null) => void;

  // Coverage
  coverageZones: CoverageZone[];
  setCoverageZones: (zones: CoverageZone[]) => void;
  gapZones: GapZone[];
  setGapZones: (gaps: GapZone[]) => void;
  overlapWarnings: OverlapWarning[];
  setOverlapWarnings: (warnings: OverlapWarning[]) => void;

  // Assignments
  assignments: CrisisAssignment[];
  setAssignments: (assignments: CrisisAssignment[]) => void;

  // Chat
  chatMessages: ChatMessage[];
  setChatMessages: (msgs: ChatMessage[]) => void;
  addChatMessage: (msg: ChatMessage) => void;

  // Alerts
  alerts: AppAlert[];
  unreadCount: number;
  addAlert: (alert: Omit<AppAlert, 'id' | 'read' | 'timestamp'>) => void;
  markAlertsRead: () => void;
  dismissAlert: (id: string) => void;

  // AI Advisor
  aiRecommendation: AllocationRecommendation | null;
  aiAdvisorStreaming: boolean;
  aiConversation: AIMessage[];
  setAIRecommendation: (rec: AllocationRecommendation | null) => void;
  setAIAdvisorStreaming: (v: boolean) => void;
  addAIMessage: (msg: AIMessage) => void;

  // Heatmap
  heatmapMode: HeatmapMode;
  setHeatmapMode: (mode: HeatmapMode) => void;
  heatmapOpacity: number;
  setHeatmapOpacity: (v: number) => void;
  heatmapVisible: boolean;
  toggleHeatmap: () => void;
  heatmapPoints: HeatmapPoint[];
  setHeatmapPoints: (pts: HeatmapPoint[]) => void;
  temporalSlices: TemporalSlice[];
  setTemporalSlices: (s: TemporalSlice[]) => void;
  temporalPosition: number;
  setTemporalPosition: (i: number) => void;
  temporalPlaying: boolean;
  setTemporalPlaying: (v: boolean) => void;
  heatmapGridKm: number;
  setHeatmapGridKm: (v: number) => void;

  // NGO Stats
  ngoStats: NGOStat[];
  setNGOStats: (stats: NGOStat[]) => void;

  // Mutual Aid
  mutualAidRequests: MutualAidRequest[];
  setMutualAidRequests: (r: MutualAidRequest[]) => void;
  addMutualAidRequest: (r: MutualAidRequest) => void;

  // Route Planner
  plannedRoute: PlannedRoute | null;
  setPlannedRoute: (r: PlannedRoute | null) => void;
  routePlannerResource: string | null;
  setRoutePlannerResource: (id: string | null) => void;

  // Map
  mapCenter: [number, number];
  mapZoom: number;
  setMapView: (center: [number, number], zoom: number) => void;
  activeLayers: string[];
  toggleLayer: (layer: string) => void;

  // SSE Connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // UI panels
  sidebarTab: 'resources' | 'ngos' | 'ai' | 'tracker' | 'stats' | 'mutual_aid';
  setSidebarTab: (tab: 'resources' | 'ngos' | 'ai' | 'tracker' | 'stats' | 'mutual_aid') => void;
  bottomTab: 'feed' | 'chat' | 'report';
  setBottomTab: (tab: 'feed' | 'chat' | 'report') => void;
  bottomExpanded: boolean;
  toggleBottomPanel: () => void;
  trackedResourceId: string | null;
  setTrackedResourceId: (id: string | null) => void;
}

// ── Store Implementation ───────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  // Identity
  myNGO: (() => {
    try {
      const stored = localStorage.getItem('ngo_profile');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })(),
  setMyNGO: (ngo) => {
    localStorage.setItem('ngo_profile', JSON.stringify(ngo));
    set({ myNGO: ngo });
  },
  clearMyNGO: () => {
    localStorage.removeItem('ngo_profile');
    set({ myNGO: null });
  },

  // Resources
  myResources: [],
  allResources: [],
  setAllResources: (resources) => {
    const myNGO = get().myNGO;
    set({
      allResources: resources,
      myResources: myNGO ? resources.filter(r => r.ngo_id === myNGO.ngo_id) : [],
    });
  },
  updateResource: (id, patch) => set(state => ({
    allResources: state.allResources.map(r => r.resource_id === id ? { ...r, ...patch } : r),
    myResources:  state.myResources.map(r => r.resource_id === id ? { ...r, ...patch } : r),
  })),
  addResource: (r) => set(state => ({
    allResources: [...state.allResources, r],
    myResources:  r.ngo_id === state.myNGO?.ngo_id ? [...state.myResources, r] : state.myResources,
  })),
  gpsTrackedIds: [],
  addGPSTracked: (id) => set(s => ({ gpsTrackedIds: [...s.gpsTrackedIds.filter(x => x !== id), id] })),
  removeGPSTracked: (id) => set(s => ({ gpsTrackedIds: s.gpsTrackedIds.filter(x => x !== id) })),

  // NGOs
  activeNGOs: [],
  setActiveNGOs: (ngos) => set({ activeNGOs: ngos }),

  // Crises
  activeCrises: [],
  setActiveCrises: (crises) => set({ activeCrises: crises }),
  selectedCrisis: null,
  setSelectedCrisis: (crisis) => set({ selectedCrisis: crisis }),

  // Coverage
  coverageZones: [],
  setCoverageZones: (zones) => set({ coverageZones: zones }),
  gapZones: [],
  setGapZones: (gaps) => set({ gapZones: gaps }),
  overlapWarnings: [],
  setOverlapWarnings: (warnings) => set({ overlapWarnings: warnings }),

  // Assignments
  assignments: [],
  setAssignments: (assignments) => set({ assignments }),

  // Chat
  chatMessages: [],
  setChatMessages: (msgs) => set({ chatMessages: msgs }),
  addChatMessage: (msg) => set(state => ({
    chatMessages: [...state.chatMessages.slice(-99), msg],
  })),

  // Alerts
  alerts: [],
  unreadCount: 0,
  addAlert: (alert) => {
    const newAlert: AppAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      read: false,
      timestamp: new Date().toISOString(),
    };
    set(state => ({
      alerts: [newAlert, ...state.alerts.slice(0, 49)],
      unreadCount: state.unreadCount + 1,
    }));
  },
  markAlertsRead: () => set(state => ({
    alerts: state.alerts.map(a => ({ ...a, read: true })),
    unreadCount: 0,
  })),
  dismissAlert: (id) => set(state => ({
    alerts: state.alerts.filter(a => a.id !== id),
    unreadCount: state.alerts.filter(a => !a.read && a.id !== id).length,
  })),

  // AI Advisor
  aiRecommendation: null,
  aiAdvisorStreaming: false,
  aiConversation: [],
  setAIRecommendation: (rec) => set({ aiRecommendation: rec }),
  setAIAdvisorStreaming: (v) => set({ aiAdvisorStreaming: v }),
  addAIMessage: (msg) => set(state => ({
    aiConversation: [...state.aiConversation.slice(-9), msg],
  })),

  // Heatmap
  heatmapMode: 'intensity',
  setHeatmapMode: (mode) => set({ heatmapMode: mode }),
  heatmapOpacity: 0.7,
  setHeatmapOpacity: (v) => set({ heatmapOpacity: v }),
  heatmapVisible: false,
  toggleHeatmap: () => set(s => ({ heatmapVisible: !s.heatmapVisible })),
  heatmapPoints: [],
  setHeatmapPoints: (pts) => set({ heatmapPoints: pts }),
  temporalSlices: [],
  setTemporalSlices: (s) => set({ temporalSlices: s }),
  temporalPosition: 0,
  setTemporalPosition: (i) => set({ temporalPosition: i }),
  temporalPlaying: false,
  setTemporalPlaying: (v) => set({ temporalPlaying: v }),
  heatmapGridKm: 2,
  setHeatmapGridKm: (v) => set({ heatmapGridKm: v }),

  // NGO Stats
  ngoStats: [],
  setNGOStats: (stats) => set({ ngoStats: stats }),

  // Mutual Aid
  mutualAidRequests: [],
  setMutualAidRequests: (r) => set({ mutualAidRequests: r }),
  addMutualAidRequest: (r) => set(s => ({ mutualAidRequests: [r, ...s.mutualAidRequests] })),

  // Route Planner
  plannedRoute: null,
  setPlannedRoute: (r) => set({ plannedRoute: r }),
  routePlannerResource: null,
  setRoutePlannerResource: (id) => set({ routePlannerResource: id }),

  // Map
  mapCenter: [19.9975, 73.7898],
  mapZoom: 12,
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),
  activeLayers: ['crises', 'resources', 'coverage', 'gaps'],
  toggleLayer: (layer) => set(state => ({
    activeLayers: state.activeLayers.includes(layer)
      ? state.activeLayers.filter(l => l !== layer)
      : [...state.activeLayers, layer],
  })),

  // SSE Connection
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // UI panels
  sidebarTab: 'resources',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  bottomTab: 'chat',
  setBottomTab: (tab) => set({ bottomTab: tab }),
  bottomExpanded: true,
  toggleBottomPanel: () => set(state => ({ bottomExpanded: !state.bottomExpanded })),
  trackedResourceId: null,
  setTrackedResourceId: (id) => set({ trackedResourceId: id }),
}));
