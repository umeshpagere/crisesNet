/**
 * CrisisNet Mobile - Location Capture Hook
 * 
 * Wraps LocationService with React state management
 * Auto-requests permissions on mount
 * Accuracy status: excellent(<10m) good(<30m) poor(<50m) insufficient(>50m)
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import LocationService, { PermissionStatus } from '../services/LocationService';
import { LocationUpdate } from '../types';

export type AccuracyStatus = 'excellent' | 'good' | 'poor' | 'insufficient';

export interface LocationCaptureState {
  location: LocationUpdate | null;
  accuracy: number;
  accuracyStatus: AccuracyStatus;
  permissionStatus: PermissionStatus;
  isCapturing: boolean;
  error: string | null;
}

export interface LocationCaptureActions {
  recapture: () => Promise<void>;
  startWatching: () => void;
  stopWatching: () => void;
}

export const useLocationCapture = (): LocationCaptureState & LocationCaptureActions => {
  const {
    currentLocation,
    locationPermissionStatus,
    isCapturingLocation,
    setCurrentLocation,
    setLocationPermissionStatus,
    setIsCapturingLocation,
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);
  const [watchUnsubscribe, setWatchUnsubscribe] = useState<(() => void) | null>(null);

  // Auto-request permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const status = await LocationService.requestPermissions();
        setLocationPermissionStatus(status);

        if (status === 'granted') {
          // Auto-capture initial location
          await captureLocation();
        } else {
          console.warn('[useLocationCapture] Location permission not granted:', status);
          setError(`Location permission ${status}`);
        }
      } catch (err) {
        console.error('[useLocationCapture] Permission request failed:', err);
        setError(err instanceof Error ? err.message : 'Permission request failed');
      }
    };

    requestPermissions();
  }, []);

  /**
   * Capture location once
   */
  const captureLocation = async () => {
    setIsCapturingLocation(true);
    setError(null);

    try {
      const location = await LocationService.getCurrentLocation();
      setCurrentLocation(location);
      console.log(`[useLocationCapture] Location captured: ${location.lat}, ${location.lng} (±${location.accuracy}m)`);
    } catch (err) {
      console.error('[useLocationCapture] Location capture failed:', err);
      setError(err instanceof Error ? err.message : 'Location capture failed');

      // Try to use last known location
      const lastKnown = LocationService.getLastKnownLocation();
      if (lastKnown) {
        setCurrentLocation(lastKnown);
        console.warn('[useLocationCapture] Using last known location');
      }
    } finally {
      setIsCapturingLocation(false);
    }
  };

  /**
   * Recapture location (manual trigger)
   */
  const recapture = useCallback(async () => {
    await captureLocation();
  }, []);

  /**
   * Start watching location updates
   */
  const startWatching = useCallback(() => {
    if (watchUnsubscribe) {
      console.warn('[useLocationCapture] Already watching location');
      return;
    }

    if (locationPermissionStatus !== 'granted') {
      console.error('[useLocationCapture] Cannot watch - permission not granted');
      return;
    }

    const unsubscribe = LocationService.startWatching((location) => {
      setCurrentLocation(location);
      console.log(`[useLocationCapture] Location updated: ${location.lat}, ${location.lng} (±${location.accuracy}m)`);
    });

    setWatchUnsubscribe(() => unsubscribe);
    console.log('[useLocationCapture] Started watching location');
  }, [watchUnsubscribe, locationPermissionStatus]);

  /**
   * Stop watching location updates
   */
  const stopWatching = useCallback(() => {
    if (watchUnsubscribe) {
      watchUnsubscribe();
      setWatchUnsubscribe(null);
      console.log('[useLocationCapture] Stopped watching location');
    }
  }, [watchUnsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchUnsubscribe) {
        watchUnsubscribe();
      }
    };
  }, [watchUnsubscribe]);

  // Calculate accuracy status
  const accuracy = currentLocation?.accuracy || 999;
  const accuracyStatus = getAccuracyStatus(accuracy);

  return {
    location: currentLocation,
    accuracy,
    accuracyStatus,
    permissionStatus: locationPermissionStatus,
    isCapturing: isCapturingLocation,
    error,
    recapture,
    startWatching,
    stopWatching,
  };
};

/**
 * Get accuracy status from accuracy value
 */
function getAccuracyStatus(accuracy: number): AccuracyStatus {
  if (accuracy < 10) {
    return 'excellent';
  } else if (accuracy < 30) {
    return 'good';
  } else if (accuracy < 50) {
    return 'poor';
  } else {
    return 'insufficient';
  }
}
