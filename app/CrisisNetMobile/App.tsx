/**
 * CrisisNet Mobile - Main App Entry Point
 * 
 * 8-step initialization sequence:
 * 1. SQLite init
 * 2. Zustand hydration (automatic)
 * 3. Location permissions
 * 4. GPS capture
 * 5. Connectivity check
 * 6. Gemma init (NON-BLOCKING)
 * 7. Auto-sync (if online + pending)
 * 8. Render app
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppStore } from './src/store/useAppStore';
import { initDatabase } from './src/db/schema';
import LocationService from './src/services/LocationService';
import GemmaService from './src/services/GemmaService';
import SyncService from './src/services/SyncService';
import { SYNC_AUTO_TRIGGER_DELAY_MS } from './src/constants';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initStep, setInitStep] = useState('Starting...');

  const {
    setConnectivity,
    setLastOnlineAt,
    setLocationPermissionStatus,
    setCurrentLocation,
    pendingCount,
    setPendingCount,
  } = useAppStore();

  useEffect(() => {
    async function initialize() {
      try {
        // Step 1: SQLite init (blocking, fast ~50ms)
        setInitStep('Initializing database...');
        await initDatabase();
        console.log('[App] ✓ SQLite initialized');

        // Step 2: Zustand hydration (automatic via persist middleware)
        setInitStep('Loading saved state...');
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for hydration
        console.log('[App] ✓ State hydrated');

        // Step 3: Request location permission
        setInitStep('Requesting permissions...');
        const permStatus = await LocationService.requestPermissions();
        setLocationPermissionStatus(permStatus);
        console.log(`[App] ✓ Location permission: ${permStatus}`);

        // Step 4: Start GPS capture (if granted)
        if (permStatus === 'granted') {
          setInitStep('Capturing location...');
          try {
            const location = await LocationService.getCurrentLocation();
            setCurrentLocation(location);
            console.log(`[App] ✓ Location captured: ${location.lat}, ${location.lng}`);
          } catch (error) {
            console.warn('[App] Location capture failed:', error);
          }
        }

        // Step 5: Check connectivity
        setInitStep('Checking connectivity...');
        const netInfo = await NetInfo.fetch();
        const isOnline = netInfo.isConnected === true && netInfo.isInternetReachable === true;
        const connectionType = mapConnectionType(netInfo.type);
        setConnectivity(isOnline, connectionType);
        
        if (isOnline) {
          setLastOnlineAt(Date.now());
        }
        console.log(`[App] ✓ Connectivity: ${isOnline ? 'online' : 'offline'} (${connectionType})`);

        // Step 6: Gemma init (NON-BLOCKING - runs in background)
        setInitStep('Loading AI model...');
        GemmaService.initialize()
          .then(() => {
            console.log('[App] ✓ Gemma ready');
          })
          .catch((error) => {
            console.warn('[App] Gemma fallback mode:', error);
          });

        // Step 7: Get pending count and auto-sync (if online)
        setInitStep('Checking pending reports...');
        const count = await SyncService.getPendingCount();
        setPendingCount(count);
        console.log(`[App] ✓ Pending reports: ${count}`);

        if (isOnline && count > 0) {
          console.log(`[App] Scheduling auto-sync in ${SYNC_AUTO_TRIGGER_DELAY_MS}ms...`);
          setTimeout(() => {
            SyncService.syncPendingReports()
              .then((result) => {
                console.log(`[App] ✓ Auto-sync complete: ${result.synced}/${result.total}`);
              })
              .catch((error) => {
                console.warn('[App] Auto-sync failed:', error);
              });
          }, SYNC_AUTO_TRIGGER_DELAY_MS);
        }

        // Step 8: Render app
        setInitStep('Ready!');
        setIsReady(true);
        console.log('[App] ✓ Initialization complete');
      } catch (error) {
        console.error('[App] Initialization failed:', error);
        // Still render app even if init fails (graceful degradation)
        setIsReady(true);
      }
    }

    initialize();
  }, []);

  if (!isReady) {
    return <SplashScreen step={initStep} />;
  }

  return <AppNavigator />;
}

/**
 * Splash screen shown during initialization
 */
function SplashScreen({ step }: { step: string }) {
  return (
    <View style={styles.splashContainer}>
      <Text style={styles.splashLogo}>🌐</Text>
      <Text style={styles.splashTitle}>CrisisNet</Text>
      <ActivityIndicator size="large" color="#3B82F6" style={styles.splashSpinner} />
      <Text style={styles.splashStep}>{step}</Text>
    </View>
  );
}

/**
 * Map NetInfo connection type to our ConnectionType enum
 */
function mapConnectionType(type: string): 'wifi' | 'cellular' | 'none' | 'unknown' {
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

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    fontSize: 80,
    marginBottom: 16,
  },
  splashTitle: {
    color: '#F3F4F6',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 48,
  },
  splashSpinner: {
    marginBottom: 24,
  },
  splashStep: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
