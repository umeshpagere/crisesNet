/**
 * CrisisNet Mobile - Location Capture Component
 * 
 * GPS capture UI with accuracy ring
 * Color-coded accuracy status
 * Recapture button
 * Compact single-line mode for tight layouts
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocationCapture } from '../hooks/useLocationCapture';

interface LocationCaptureProps {
  compact?: boolean;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

export const LocationCapture: React.FC<LocationCaptureProps> = ({ 
  compact = false,
  onLocationUpdate,
}) => {
  const { location, accuracy, accuracyStatus, isCapturing, recapture } = useLocationCapture();

  React.useEffect(() => {
    if (location && onLocationUpdate) {
      onLocationUpdate(location.lat, location.lng);
    }
  }, [location, onLocationUpdate]);

  const accuracyColor = getAccuracyColor(accuracyStatus);
  const accuracyLabel = getAccuracyLabel(accuracyStatus);

  if (compact && location) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.accuracyDot, { backgroundColor: accuracyColor }]} />
        <Text style={styles.compactText}>
          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </Text>
        <Text style={styles.compactAccuracy}>±{Math.round(accuracy)}m</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Accuracy Ring */}
      <View style={styles.ringContainer}>
        <View style={[styles.ring, { borderColor: accuracyColor }]}>
          {isCapturing ? (
            <ActivityIndicator size="large" color={accuracyColor} />
          ) : (
            <View style={styles.ringCenter}>
              <Text style={styles.accuracyText}>{Math.round(accuracy)}m</Text>
              <Text style={[styles.accuracyLabel, { color: accuracyColor }]}>
                {accuracyLabel}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Coordinates */}
      {location && (
        <View style={styles.coordsContainer}>
          <Text style={styles.coordsLabel}>Location</Text>
          <Text style={styles.coordsText}>
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </Text>
        </View>
      )}

      {/* Recapture Button */}
      <TouchableOpacity
        style={[styles.recaptureButton, isCapturing && styles.recaptureButtonDisabled]}
        onPress={recapture}
        disabled={isCapturing}
      >
        <Text style={styles.recaptureButtonText}>
          {isCapturing ? 'Capturing...' : 'Recapture Location'}
        </Text>
      </TouchableOpacity>

      {/* Accuracy Warning */}
      {accuracyStatus === 'insufficient' && !isCapturing && (
        <Text style={styles.warningText}>
          Low accuracy - recapture recommended
        </Text>
      )}
    </View>
  );
};

function getAccuracyColor(status: string): string {
  switch (status) {
    case 'excellent':
    case 'good':
      return '#10B981'; // green
    case 'poor':
      return '#F59E0B'; // yellow
    case 'insufficient':
      return '#EF4444'; // red
    default:
      return '#6B7280'; // gray
  }
}

function getAccuracyLabel(status: string): string {
  switch (status) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'poor':
      return 'Poor';
    case 'insufficient':
      return 'Insufficient';
    default:
      return 'Unknown';
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  compactText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  compactAccuracy: {
    color: '#9CA3AF',
    fontSize: 12,
    marginLeft: 8,
  },
  accuracyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ringContainer: {
    marginBottom: 16,
  },
  ring: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  ringCenter: {
    alignItems: 'center',
  },
  accuracyText: {
    color: '#E5E7EB',
    fontSize: 24,
    fontWeight: 'bold',
  },
  accuracyLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  coordsContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  coordsLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  coordsText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  recaptureButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  recaptureButtonDisabled: {
    backgroundColor: '#374151',
  },
  recaptureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
