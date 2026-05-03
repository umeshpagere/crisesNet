/**
 * CrisisNet Mobile - Responder Dashboard Screen
 * 
 * Field assessment for first responders
 * AI-powered assessment analysis
 * Submit to coordination hub
 */

import React, { useState } from 'react';
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
import APIService from '../services/APIService';
import { buildAssessmentPrompt } from '../prompts';

export const ResponderDashboardScreen: React.FC = () => {
  const { isOnline } = useConnectivity();
  const { currentLocation } = useAppStore();

  // Form state
  const [observations, setObservations] = useState('');
  const [infrastructureDamage, setInfrastructureDamage] = useState('');
  const [medicalNeeds, setMedicalNeeds] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Assessment state
  const [assessmentPrompt, setAssessmentPrompt] = useState('');
  const [showAssessment, setShowAssessment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  React.useEffect(() => {
    if (currentLocation) {
      setLat(currentLocation.lat);
      setLng(currentLocation.lng);
    }
  }, [currentLocation]);

  const handleLocationUpdate = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  };

  const handleRunAssessment = () => {
    if (!observations.trim()) {
      Alert.alert('Error', 'Please enter observations before running assessment');
      return;
    }

    const prompt = buildAssessmentPrompt({
      observations: observations.split('\n').filter(o => o.trim()),
      location: lat && lng ? `${lat}, ${lng}` : 'Unknown location',
      infrastructure_damage: infrastructureDamage || 'Not assessed',
      medical_needs: medicalNeeds || 'Not assessed',
    });

    setAssessmentPrompt(prompt);
    setShowAssessment(true);
  };

  const handleSubmit = async () => {
    if (!observations.trim()) {
      Alert.alert('Error', 'Please enter observations before submitting');
      return;
    }

    if (!isOnline) {
      Alert.alert('Offline', 'Assessment submission requires internet connection');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build assessment report
      const report = {
        event_id: `assessment-${Date.now()}`,
        location: { lat: lat || 0, lng: lng || 0 },
        crisis_type: 'other',
        description: observations,
        reported_casualties: 0,
        reporter_id: 'responder-mobile',
        timestamp: new Date().toISOString(),
        assessment: {
          observations: observations.split('\n').filter(o => o.trim()),
          infrastructure_damage: infrastructureDamage,
          medical_needs: medicalNeeds,
        },
      };

      const response = await APIService.submitCrisisReport(report);

      if (response.statusCode === 200) {
        setSubmitted(true);
        Alert.alert('Success', 'Assessment submitted to coordination hub');
      } else {
        Alert.alert('Error', response.error || 'Failed to submit assessment');
      }
    } catch (error) {
      console.error('[ResponderDashboardScreen] Submit failed:', error);
      Alert.alert('Error', 'Failed to submit assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setObservations('');
    setInfrastructureDamage('');
    setMedicalNeeds('');
    setAssessmentPrompt('');
    setShowAssessment(false);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <ConnectivityBanner />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Assessment Submitted</Text>
            <Text style={styles.successText}>
              Your field assessment has been sent to the coordination hub.
            </Text>
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>New Assessment</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ConnectivityBanner />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Field Assessment</Text>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <LocationCapture compact onLocationUpdate={handleLocationUpdate} />
        </View>

        {/* Observations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observations *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="What do you observe? (one per line)"
            placeholderTextColor="#6B7280"
            value={observations}
            onChangeText={setObservations}
            multiline
            numberOfLines={5}
            maxLength={500}
          />
          <Text style={styles.charCount}>{observations.length}/500</Text>
        </View>

        {/* Infrastructure Damage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Infrastructure Damage</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Roads, buildings, utilities..."
            placeholderTextColor="#6B7280"
            value={infrastructureDamage}
            onChangeText={setInfrastructureDamage}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
          <Text style={styles.charCount}>{infrastructureDamage.length}/300</Text>
        </View>

        {/* Medical Needs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Needs</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Injuries, medical supplies needed..."
            placeholderTextColor="#6B7280"
            value={medicalNeeds}
            onChangeText={setMedicalNeeds}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
          <Text style={styles.charCount}>{medicalNeeds.length}/300</Text>
        </View>

        {/* AI Assessment Button */}
        <TouchableOpacity
          style={[styles.assessButton, !observations.trim() && styles.assessButtonDisabled]}
          onPress={handleRunAssessment}
          disabled={!observations.trim()}
        >
          <Text style={styles.assessButtonText}>🤖 Run AI Assessment</Text>
        </TouchableOpacity>

        {/* AI Assessment Result */}
        {showAssessment && assessmentPrompt && (
          <AIAssistant
            prompt={assessmentPrompt}
            promptType="assessment"
            streaming={false}
          />
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!observations.trim() || !isOnline) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!observations.trim() || !isOnline || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Submitting...' : '📤 Submit to Hub'}
          </Text>
        </TouchableOpacity>

        {!isOnline && (
          <Text style={styles.offlineWarning}>
            ⚠️ Internet connection required to submit assessment
          </Text>
        )}
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
  textArea: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    color: '#E5E7EB',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  assessButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  assessButtonDisabled: {
    backgroundColor: '#374151',
  },
  assessButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#374151',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineWarning: {
    color: '#F59E0B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  successContainer: {
    backgroundColor: '#065F46',
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
    marginBottom: 32,
  },
  resetButtonText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
});
