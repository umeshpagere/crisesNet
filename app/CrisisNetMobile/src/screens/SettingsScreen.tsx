/**
 * CrisisNet Mobile - Settings Screen
 * 
 * API configuration
 * AI model status
 * Sync preferences
 * Demo data loader
 * Reset app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { ModelLoadStatus } from '../components/ModelLoadStatus';
import { useAppStore } from '../store/useAppStore';
import APIService from '../services/APIService';
import GemmaService from '../services/GemmaService';
import SyncService from '../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants';

export const SettingsScreen: React.FC = () => {
  const { gemmaStatus, gemmaInferenceCount, gemmaLastInferenceMs, resetAll } = useAppStore();

  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [autoSync, setAutoSync] = useState(true);
  const [syncOnCellular, setSyncOnCellular] = useState(false);

  const handleTestConnection = async () => {
    setConnectionStatus('testing');

    try {
      APIService.setBaseURL(apiUrl);
      const isReachable = await APIService.ping();

      if (isReachable) {
        setConnectionStatus('success');
        await AsyncStorage.setItem('api_url', apiUrl);
        Alert.alert('Success', 'Connected to API successfully');
      } else {
        setConnectionStatus('failed');
        Alert.alert('Failed', 'Could not reach API');
      }
    } catch (error) {
      setConnectionStatus('failed');
      Alert.alert('Error', 'Connection test failed');
    }
  };

  const handleReloadModel = async () => {
    Alert.alert(
      'Reload AI Model',
      'This will reload the Gemma 4 model. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reload',
          onPress: async () => {
            try {
              await GemmaService.initialize();
              Alert.alert('Success', 'Model reloaded');
            } catch (error) {
              Alert.alert('Error', 'Failed to reload model');
            }
          },
        },
      ]
    );
  };

  const handleClearFailed = async () => {
    Alert.alert(
      'Clear Failed Reports',
      'This will delete all reports with failed sync status. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const reports = await SyncService.getPendingReports();
              const failed = reports.filter(r => r.sync_status === 'failed');
              
              for (const report of failed) {
                await SyncService.deleteReport(report.id);
              }

              Alert.alert('Success', `Cleared ${failed.length} failed reports`);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear reports');
            }
          },
        },
      ]
    );
  };

  const handleLoadDemoData = async () => {
    Alert.alert(
      'Load Demo Data',
      'This will add 5 sample reports to the queue. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          onPress: async () => {
            try {
              const demoReports = [
                {
                  id: `demo-${Date.now()}-1`,
                  created_at: Date.now() - 3600000,
                  crisis_type: 'flood' as const,
                  lat: 19.9975,
                  lng: 73.7898,
                  description: 'Water level rising rapidly',
                  reported_casualties: 0,
                  reporter_id: 'demo-user',
                  severity_local: 'high' as const,
                  sync_status: 'pending' as const,
                  sync_attempts: 0,
                },
                {
                  id: `demo-${Date.now()}-2`,
                  created_at: Date.now() - 7200000,
                  crisis_type: 'medical' as const,
                  lat: 20.0010,
                  lng: 73.7950,
                  description: 'Multiple injuries reported',
                  reported_casualties: 3,
                  reporter_id: 'demo-user',
                  severity_local: 'critical' as const,
                  sync_status: 'pending' as const,
                  sync_attempts: 0,
                },
                {
                  id: `demo-${Date.now()}-3`,
                  created_at: Date.now() - 10800000,
                  crisis_type: 'fire' as const,
                  lat: 19.9900,
                  lng: 73.7800,
                  description: 'Building fire spreading',
                  reported_casualties: 0,
                  reporter_id: 'demo-user',
                  severity_local: 'high' as const,
                  sync_status: 'pending' as const,
                  sync_attempts: 0,
                },
                {
                  id: `demo-${Date.now()}-4`,
                  created_at: Date.now() - 14400000,
                  crisis_type: 'earthquake' as const,
                  lat: 20.0050,
                  lng: 73.8000,
                  description: 'Structural damage observed',
                  reported_casualties: 1,
                  reporter_id: 'demo-user',
                  severity_local: 'moderate' as const,
                  sync_status: 'pending' as const,
                  sync_attempts: 0,
                },
                {
                  id: `demo-${Date.now()}-5`,
                  created_at: Date.now() - 18000000,
                  crisis_type: 'other' as const,
                  lat: 19.9850,
                  lng: 73.7750,
                  description: 'Power outage affecting area',
                  reported_casualties: 0,
                  reporter_id: 'demo-user',
                  severity_local: 'low' as const,
                  sync_status: 'pending' as const,
                  sync_attempts: 0,
                },
              ];

              for (const report of demoReports) {
                await SyncService.queueReport(report);
              }

              Alert.alert('Success', 'Loaded 5 demo reports');
            } catch (error) {
              Alert.alert('Error', 'Failed to load demo data');
            }
          },
        },
      ]
    );
  };

  const handleResetApp = () => {
    Alert.alert(
      'Reset App',
      'This will delete ALL data including pending reports. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear SQLite
              const reports = await SyncService.getPendingReports();
              for (const report of reports) {
                await SyncService.deleteReport(report.id);
              }

              // Clear AsyncStorage
              await AsyncStorage.clear();

              // Reset Zustand store
              resetAll();

              Alert.alert('Success', 'App reset complete');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset app');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* CONNECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONNECTION</Text>

        <Text style={styles.label}>API URL</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="https://api.crisisnet.com"
          placeholderTextColor="#6B7280"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleTestConnection}
          disabled={connectionStatus === 'testing'}
        >
          <Text style={styles.buttonText}>
            {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </Text>
        </TouchableOpacity>

        {connectionStatus === 'success' && (
          <Text style={styles.successText}>✓ Connected</Text>
        )}
        {connectionStatus === 'failed' && (
          <Text style={styles.errorText}>✗ Failed</Text>
        )}
      </View>

      {/* AI MODEL */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI MODEL</Text>

        <ModelLoadStatus />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={styles.infoValue}>{gemmaStatus}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Inferences:</Text>
          <Text style={styles.infoValue}>{gemmaInferenceCount}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last inference:</Text>
          <Text style={styles.infoValue}>
            {gemmaLastInferenceMs > 0 ? `${(gemmaLastInferenceMs / 1000).toFixed(1)}s` : 'N/A'}
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleReloadModel}>
          <Text style={styles.buttonText}>Reload Model</Text>
        </TouchableOpacity>
      </View>

      {/* SYNC */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SYNC</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Auto-sync when online</Text>
          <Switch
            value={autoSync}
            onValueChange={setAutoSync}
            trackColor={{ false: '#374151', true: '#3B82F6' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Sync on cellular</Text>
          <Switch
            value={syncOnCellular}
            onValueChange={setSyncOnCellular}
            trackColor={{ false: '#374151', true: '#3B82F6' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleClearFailed}>
          <Text style={styles.buttonText}>Clear Failed Reports</Text>
        </TouchableOpacity>
      </View>

      {/* DEMO */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DEMO</Text>

        <TouchableOpacity style={styles.button} onPress={handleLoadDemoData}>
          <Text style={styles.buttonText}>Load Demo Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={handleResetApp}>
          <Text style={styles.buttonText}>Reset App</Text>
        </TouchableOpacity>
      </View>

      {/* ABOUT */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version:</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phase:</Text>
          <Text style={styles.infoValue}>5</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Build:</Text>
          <Text style={styles.infoValue}>2026-05-02</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 16,
  },
  title: {
    color: '#F3F4F6',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  label: {
    color: '#E5E7EB',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    color: '#E5E7EB',
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  successText: {
    color: '#10B981',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  infoLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  infoValue: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLabel: {
    color: '#E5E7EB',
    fontSize: 14,
  },
});
