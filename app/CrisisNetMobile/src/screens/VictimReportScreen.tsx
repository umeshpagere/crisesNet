/**
 * CrisisNet Mobile - Victim Report Screen
 * 
 * CRITICAL: ≤4 taps to submit
 * Tap 1: Crisis type
 * Tap 2: Casualties (stepper)
 * Tap 3: GPS auto-captured (or manual if needed)
 * Tap 4: SUBMIT
 * 
 * Post-submit:
 * - Offline: Amber screen + AI triage
 * - Online: Green screen + allocation result
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { LocationCapture } from '../components/LocationCapture';
import { AIAssistant } from '../components/AIAssistant';
import { useConnectivity } from '../hooks/useConnectivity';
import { useAppStore } from '../store/useAppStore';
import SyncService from '../services/SyncService';
import APIService from '../services/APIService';
import { buildTriagePrompt } from '../prompts';
import { CrisisType } from '../types';
import { CRISIS_COLORS } from '../constants';

const CRISIS_TYPES: Array<{ type: CrisisType; icon: string; label: string }> = [
  { type: 'flood', icon: '🌊', label: 'Flood' },
  { type: 'earthquake', icon: '🏚️', label: 'Earthquake' },
  { type: 'fire', icon: '🔥', label: 'Fire' },
  { type: 'medical', icon: '🏥', label: 'Medical' },
  { type: 'other', icon: '⚠️', label: 'Other' },
];

export const VictimReportScreen: React.FC = () => {
  const { isOnline } = useConnectivity();
  const { currentLocation, setLastReportId, addToHistory } = useAppStore();

  // Form state
  const [selectedType, setSelectedType] = useState<CrisisType | null>(null);
  const [casualties, setCasualties] = useState(0);
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedOffline, setSubmittedOffline] = useState(false);
  const [triagePrompt, setTriagePrompt] = useState('');

  // Auto-populate location
  useEffect(() => {
    if (currentLocation) {
      setLat(currentLocation.lat);
      setLng(currentLocation.lng);
    }
  }, [currentLocation]);

  const handleLocationUpdate = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedType) {
      Alert.alert('Error', 'Please select a crisis type');
      return;
    }

    if (lat === null || lng === null) {
      Alert.alert('Error', 'Location not available. Please wait or recapture.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate report ID
      const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const reporterId = 'victim-mobile'; // TODO: Use actual user ID

      // Build report
      const report = {
        id: reportId,
        created_at: Date.now(),
        crisis_type: selectedType,
        lat,
        lng,
        description: description || undefined,
        reported_casualties: casualties,
        reporter_id: reporterId,
        sync_status: 'pending' as const,
        sync_attempts: 0,
      };

      // Try online submission first
      if (isOnline) {
        try {
          const response = await APIService.submitCrisisReport(report);

          if (response.statusCode === 200) {
            // Success - online submission
            setLastReportId(reportId);
            addToHistory({
              id: reportId,
              crisis_type: selectedType,
              severity: response.data?.severity || 'unknown',
              created_at: Date.now(),
              sync_status: 'synced',
            });

            setSubmitted(true);
            setSubmittedOffline(false);

            // Build triage prompt for AI guidance
            const prompt = buildTriagePrompt({
              crisisType: selectedType,
              description: description || 'No description provided',
              reportedCasualties: casualties,
              location: `${lat}, ${lng}`,
              reporterObservation: description || 'Emergency situation',
            });
            setTriagePrompt(prompt);

            return;
          }
        } catch (error) {
          console.error('[VictimReportScreen] Online submission failed:', error);
          // Fall through to offline mode
        }
      }

      // Offline mode or online failed - queue for sync
      await SyncService.queueReport(report);

      setLastReportId(reportId);
      addToHistory({
        id: reportId,
        crisis_type: selectedType,
        severity: 'unknown',
        created_at: Date.now(),
        sync_status: 'pending',
      });

      setSubmitted(true);
      setSubmittedOffline(true);

      // Build triage prompt for AI guidance
      const prompt = buildTriagePrompt({
        crisisType: selectedType,
        description: description || 'No description provided',
        reportedCasualties: casualties,
        location: `${lat}, ${lng}`,
        reporterObservation: description || 'Emergency situation',
      });
      setTriagePrompt(prompt);
    } catch (error) {
      console.error('[VictimReportScreen] Submit failed:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedType(null);
    setCasualties(0);
    setDescription('');
    setSubmitted(false);
    setSubmittedOffline(false);
    setTriagePrompt('');
  };

  // Post-submit screen
  if (submitted) {
    return (
      <View style={styles.container}>
        <ConnectivityBanner />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Success message */}
          <View
            style={[
              styles.successContainer,
              { backgroundColor: submittedOffline ? '#78350F' : '#065F46' },
            ]}
          >
            <Text style={styles.successIcon}>{submittedOffline ? '📴' : '✅'}</Text>
            <Text style={styles.successTitle}>
              {submittedOffline ? 'Saved Locally' : 'Report Sent'}
            </Text>
            <Text style={styles.successText}>
              {submittedOffline
                ? 'Your report is saved and will upload when connected.'
                : 'Help is on the way. Stay safe.'}
            </Text>
          </View>

          {/* AI Guidance */}
          {triagePrompt && (
            <AIAssistant
              prompt={triagePrompt}
              promptType="triage"
              streaming={false}
            />
          )}

          {/* Submit another button */}
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Submit Another Report</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Report form
  return (
    <View style={styles.container}>
      <ConnectivityBanner />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Report Crisis</Text>

        {/* Step 1: Crisis Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Crisis Type *</Text>
          <View style={styles.crisisTypeGrid}>
            {CRISIS_TYPES.map((crisis) => {
              const isSelected = selectedType === crisis.type;
              const color = CRISIS_COLORS[crisis.type];

              return (
                <TouchableOpacity
                  key={crisis.type}
                  style={[
                    styles.crisisTypeButton,
                    { borderColor: color },
                    isSelected && styles.crisisTypeButtonSelected,
                    isSelected && { borderWidth: 3 },
                  ]}
                  onPress={() => setSelectedType(crisis.type)}
                >
                  <Text style={styles.crisisTypeIcon}>{crisis.icon}</Text>
                  <Text style={[styles.crisisTypeLabel, { color }]}>
                    {crisis.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Step 2: Casualties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Reported Casualties</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setCasualties(Math.max(0, casualties - 1))}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <View style={styles.stepperValue}>
              <Text style={styles.stepperValueText}>{casualties}</Text>
            </View>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setCasualties(casualties + 1)}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step 3: Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Location</Text>
          <LocationCapture onLocationUpdate={handleLocationUpdate} />
        </View>

        {/* Optional: Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description (Optional)</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="What's happening? (optional)"
            placeholderTextColor="#6B7280"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
          <Text style={styles.charCount}>{description.length}/200</Text>
        </View>

        {/* Step 4: Submit */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedType || lat === null) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedType || lat === null || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Submitting...' : '🚨 SUBMIT REPORT'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    color: '#F3F4F6',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  crisisTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  crisisTypeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
    minHeight: 100,
  },
  crisisTypeButtonSelected: {
    backgroundColor: '#374151',
  },
  crisisTypeIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  crisisTypeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stepperButton: {
    backgroundColor: '#374151',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    color: '#E5E7EB',
    fontSize: 32,
    fontWeight: 'bold',
  },
  stepperValue: {
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  stepperValueText: {
    color: '#F3F4F6',
    fontSize: 32,
    fontWeight: 'bold',
  },
  descriptionInput: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    color: '#E5E7EB',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#374151',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  successContainer: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
  resetButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  resetButtonText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
});
