/**
 * CrisisNet Mobile - Location Service
 * 
 * GPS capture with permissions, accuracy validation, and background updates
 * Uses react-native-geolocation-service
 */

import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { GPS_ACCURACY_THRESHOLD_M, GPS_TIMEOUT_MS, GPS_MAX_AGE_MS } from '../constants';

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

export type PermissionStatus = 'granted' | 'denied' | 'blocked';

class LocationService {
  private static instance: LocationService;
  private watchId: number | null = null;
  private lastKnownLocation: LocationUpdate | null = null;

  private constructor() {}

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Request location permissions
   * iOS: Uses Geolocation.requestAuthorization('whenInUse')
   * Android: Uses PermissionsAndroid.request(ACCESS_FINE_LOCATION)
   */
  async requestPermissions(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'ios') {
        const auth = await Geolocation.requestAuthorization('whenInUse');
        
        if (auth === 'granted') {
          return 'granted';
        } else if (auth === 'denied') {
          return 'denied';
        } else {
          return 'blocked';
        }
      } else {
        // Android
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'CrisisNet Location Permission',
            message: 'CrisisNet needs your location to report crisis events accurately.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return 'granted';
        } else if (granted === PermissionsAndroid.RESULTS.DENIED) {
          return 'denied';
        } else {
          return 'blocked';
        }
      }
    } catch (error) {
      console.error('[LocationService] Permission request failed:', error);
      return 'denied';
    }
  }

  /**
   * Get current location with retries for accuracy
   * Retries up to 3x if accuracy > GPS_ACCURACY_THRESHOLD_M (50m)
   * Returns last known location as fallback - never throws to caller
   */
  async getCurrentLocation(timeout_ms: number = GPS_TIMEOUT_MS): Promise<LocationUpdate> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const location = await this.getSingleLocation(timeout_ms);

        // Check accuracy
        if (location.accuracy <= GPS_ACCURACY_THRESHOLD_M) {
          this.lastKnownLocation = location;
          console.log(`[LocationService] Got accurate location (${location.accuracy}m) on attempt ${attempt}`);
          return location;
        }

        console.warn(`[LocationService] Poor accuracy (${location.accuracy}m) on attempt ${attempt}/${maxRetries}`);

        // Last attempt - accept whatever we got
        if (attempt === maxRetries) {
          this.lastKnownLocation = location;
          return location;
        }

        // Wait 1s before retry
        await this.sleep(1000);
      } catch (error) {
        console.error(`[LocationService] Location attempt ${attempt} failed:`, error);

        // Last attempt - return last known or throw
        if (attempt === maxRetries) {
          if (this.lastKnownLocation) {
            console.warn('[LocationService] Returning last known location as fallback');
            return this.lastKnownLocation;
          }

          // No fallback available - return default location (Nashik, India)
          console.error('[LocationService] No location available - using default');
          return {
            lat: 19.9975,
            lng: 73.7898,
            accuracy: 999,
            timestamp: new Date().toISOString(),
          };
        }
      }
    }

    // Should never reach here, but TypeScript needs it
    return this.lastKnownLocation || {
      lat: 19.9975,
      lng: 73.7898,
      accuracy: 999,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get single location fix
   */
  private getSingleLocation(timeout_ms: number): Promise<LocationUpdate> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp).toISOString(),
          });
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: timeout_ms,
          maximumAge: GPS_MAX_AGE_MS,
        }
      );
    });
  }

  /**
   * Start watching location updates
   * Returns unsubscribe function
   */
  startWatching(
    onUpdate: (loc: LocationUpdate) => void,
    intervalMs: number = 5000
  ): () => void {
    if (this.watchId !== null) {
      console.warn('[LocationService] Already watching - stopping previous watch');
      this.stopWatching();
    }

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const location: LocationUpdate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString(),
        };

        this.lastKnownLocation = location;
        onUpdate(location);
      },
      (error) => {
        console.error('[LocationService] Watch position error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Update every 10m
        interval: intervalMs,
      }
    );

    console.log('[LocationService] Started watching location');

    // Return unsubscribe function
    return () => this.stopWatching();
  }

  /**
   * Stop watching location updates
   */
  stopWatching(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('[LocationService] Stopped watching location');
    }
  }

  /**
   * Get last known location (may be stale)
   */
  getLastKnownLocation(): LocationUpdate | null {
    return this.lastKnownLocation;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export default LocationService.getInstance();
