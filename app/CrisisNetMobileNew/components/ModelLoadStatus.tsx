/**
 * CrisisNet Mobile - Model Load Status Component
 * 
 * Shows Gemma 4 model loading progress
 * Only visible during initialization
 * Disappears when ready or in fallback mode
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppStore } from '../store/useAppStore';

export const ModelLoadStatus: React.FC = () => {
  const { gemmaStatus, gemmaLoadProgress } = useAppStore();

  // Only show during loading
  if (gemmaStatus !== 'loading') {
    return null;
  }

  const percentage = Math.round(gemmaLoadProgress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${percentage}%` }]} />
      </View>
      <Text style={styles.text}>CrisisNet AI loading... {percentage}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  text: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});
