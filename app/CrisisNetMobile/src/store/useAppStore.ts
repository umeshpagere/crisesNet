/**
 * CrisisNet Mobile - Zustand Global State Store
 * 
 * Central state management for connectivity, Gemma AI, sync, and location
 * Persisted to AsyncStorage for offline resilience
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GemmaStatus, ConnectionType, SyncProgress, LocationUpdate } from '../types';
import { AllocationResult } from '../services/APIService';

export interface ReportSummary {
  id: string;
  crisis_type: string;
  severity: string;
  created_at: number;
  sync_status: string;
}

interface AppState {
  // Connectivity
  isOnline: boolean;
  connectionType: ConnectionType;
  lastOnlineAt: number | null;

  // Gemma AI
  gemmaStatus: GemmaStatus;
  gemmaLoadProgress: number;
  gemmaInferenceCount: number;
  gemmaLastInferenceMs: number;
  gemmaErrorMessage: string | null;

  // Sync
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  pendingCount: number;
  lastSyncAt: number | null;
  syncErrorCount: number;

  // Location
  currentLocation: LocationUpdate | null;
  locationPermissionStatus: 'granted' | 'denied' | 'blocked' | 'unknown';
  isCapturingLocation: boolean;

  // Phase 5 additions
  allocationResult: AllocationResult | null;
  lastReportId: string | null;
  reportHistory: ReportSummary[];

  // Actions - Connectivity
  setConnectivity: (isOnline: boolean, connectionType: ConnectionType) => void;
  setLastOnlineAt: (timestamp: number) => void;

  // Actions - Gemma
  setGemmaStatus: (status: GemmaStatus) => void;
  setGemmaLoadProgress: (progress: number) => void;
  incrementGemmaInferenceCount: () => void;
  setGemmaLastInferenceMs: (ms: number) => void;
  setGemmaErrorMessage: (message: string | null) => void;

  // Actions - Sync
  setIsSyncing: (syncing: boolean) => void;
  setSyncProgress: (progress: SyncProgress | null) => void;
  setPendingCount: (count: number) => void;
  setLastSyncAt: (timestamp: number) => void;
  incrementSyncErrorCount: () => void;
  resetSyncErrorCount: () => void;

  // Actions - Location
  setCurrentLocation: (location: LocationUpdate | null) => void;
  setLocationPermissionStatus: (status: 'granted' | 'denied' | 'blocked' | 'unknown') => void;
  setIsCapturingLocation: (capturing: boolean) => void;

  // Actions - Phase 5
  setAllocationResult: (result: AllocationResult | null) => void;
  setLastReportId: (id: string | null) => void;
  addToHistory: (report: ReportSummary) => void;
  clearHistory: () => void;

  // Actions - Reset
  resetAll: () => void;
}

const initialState = {
  // Connectivity
  isOnline: false,
  connectionType: 'unknown' as ConnectionType,
  lastOnlineAt: null,

  // Gemma AI
  gemmaStatus: 'unloaded' as GemmaStatus,
  gemmaLoadProgress: 0,
  gemmaInferenceCount: 0,
  gemmaLastInferenceMs: 0,
  gemmaErrorMessage: null,

  // Sync
  isSyncing: false,
  syncProgress: null,
  pendingCount: 0,
  lastSyncAt: null,
  syncErrorCount: 0,

  // Location
  currentLocation: null,
  locationPermissionStatus: 'unknown' as const,
  isCapturingLocation: false,

  // Phase 5
  allocationResult: null,
  lastReportId: null,
  reportHistory: [] as ReportSummary[],
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      // Connectivity Actions
      setConnectivity: (isOnline, connectionType) =>
        set({ isOnline, connectionType }),

      setLastOnlineAt: (timestamp) =>
        set({ lastOnlineAt: timestamp }),

      // Gemma Actions
      setGemmaStatus: (status) =>
        set({ gemmaStatus: status }),

      setGemmaLoadProgress: (progress) =>
        set({ gemmaLoadProgress: progress }),

      incrementGemmaInferenceCount: () =>
        set((state) => ({ gemmaInferenceCount: state.gemmaInferenceCount + 1 })),

      setGemmaLastInferenceMs: (ms) =>
        set({ gemmaLastInferenceMs: ms }),

      setGemmaErrorMessage: (message) =>
        set({ gemmaErrorMessage: message }),

      // Sync Actions
      setIsSyncing: (syncing) =>
        set({ isSyncing: syncing }),

      setSyncProgress: (progress) =>
        set({ syncProgress: progress }),

      setPendingCount: (count) =>
        set({ pendingCount: count }),

      setLastSyncAt: (timestamp) =>
        set({ lastSyncAt: timestamp }),

      incrementSyncErrorCount: () =>
        set((state) => ({ syncErrorCount: state.syncErrorCount + 1 })),

      resetSyncErrorCount: () =>
        set({ syncErrorCount: 0 }),

      // Location Actions
      setCurrentLocation: (location) =>
        set({ currentLocation: location }),

      setLocationPermissionStatus: (status) =>
        set({ locationPermissionStatus: status }),

      setIsCapturingLocation: (capturing) =>
        set({ isCapturingLocation: capturing }),

      // Phase 5 Actions
      setAllocationResult: (result) =>
        set({ allocationResult: result }),

      setLastReportId: (id) =>
        set({ lastReportId: id }),

      addToHistory: (report) =>
        set((state) => ({
          reportHistory: [report, ...state.reportHistory].slice(0, 10), // Keep last 10
        })),

      clearHistory: () =>
        set({ reportHistory: [] }),

      // Reset
      resetAll: () =>
        set(initialState),
    }),
    {
      name: 'crisisnet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields (not transient state like isSyncing)
      partialize: (state) => ({
        lastOnlineAt: state.lastOnlineAt,
        gemmaInferenceCount: state.gemmaInferenceCount,
        lastSyncAt: state.lastSyncAt,
        syncErrorCount: state.syncErrorCount,
        locationPermissionStatus: state.locationPermissionStatus,
        reportHistory: state.reportHistory,
      }),
    }
  )
);
