/**
 * CrisisNet Mobile - Connectivity Hook
 * 
 * NetInfo subscription → updates Zustand store
 * Auto-sync on offline→online transition
 * Polls pending count every 5s
 */

import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAppStore } from '../store/useAppStore';
import SyncService from '../services/SyncService';
import { SYNC_AUTO_TRIGGER_DELAY_MS } from '../constants';
import { ConnectionType, SyncProgress } from '../types';

export interface ConnectivityState {
  isOnline: boolean;
  connectionType: ConnectionType;
  pendingCount: number;
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
}

export const useConnectivity = (): ConnectivityState => {
  const {
    isOnline,
    connectionType,
    pendingCount,
    isSyncing,
    syncProgress,
    setConnectivity,
    setLastOnlineAt,
    setPendingCount,
    setIsSyncing,
    setSyncProgress,
    setLastSyncAt,
  } = useAppStore();

  const [wasOffline, setWasOffline] = useState(!isOnline);

  // NetInfo subscription
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable === true;
      const type = mapConnectionType(state.type);

      setConnectivity(online, type);

      // Detect offline→online transition
      if (online && wasOffline) {
        console.log('[useConnectivity] Connectivity restored - triggering auto-sync');
        setLastOnlineAt(Date.now());
        setWasOffline(false);

        // Wait SYNC_AUTO_TRIGGER_DELAY_MS before syncing
        setTimeout(() => {
          triggerSync();
        }, SYNC_AUTO_TRIGGER_DELAY_MS);
      } else if (!online) {
        setWasOffline(true);
      }
    });

    return () => unsubscribe();
  }, [wasOffline]);

  // Poll pending count every 5s
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await SyncService.getPendingCount();
        setPendingCount(count);
      } catch (error) {
        console.error('[useConnectivity] Failed to get pending count:', error);
      }
    };

    // Initial fetch
    updatePendingCount();

    // Poll every 5s
    const interval = setInterval(updatePendingCount, 5000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Trigger sync manually or auto
   */
  const triggerSync = async () => {
    if (isSyncing) {
      console.log('[useConnectivity] Sync already in progress');
      return;
    }

    if (!isOnline) {
      console.log('[useConnectivity] Cannot sync - offline');
      return;
    }

    try {
      setIsSyncing(true);

      const result = await SyncService.syncPendingReports((synced, total) => {
        setSyncProgress({ synced, total });
      });

      console.log(`[useConnectivity] Sync complete: ${result.synced}/${result.total} synced`);

      if (result.errors.length > 0) {
        console.error('[useConnectivity] Sync errors:', result.errors);
      }

      setLastSyncAt(Date.now());
      setPendingCount(result.total - result.synced);
    } catch (error) {
      console.error('[useConnectivity] Sync failed:', error);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  return {
    isOnline,
    connectionType,
    pendingCount,
    isSyncing,
    syncProgress,
  };
};

/**
 * Map NetInfo connection type to our ConnectionType enum
 */
function mapConnectionType(type: string): ConnectionType {
  switch (type) {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'none':
      return 'none';
    default:
      return 'unknown';
  }
}
