/**
 * CrisisNet Mobile - Sync Progress Component
 * 
 * Shows upload progress for pending reports
 * Animated progress bar with count
 * Collapses to dot when complete
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAppStore } from '../store/useAppStore';

export const SyncProgress: React.FC = () => {
  const { isSyncing, syncProgress } = useAppStore();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (syncProgress) {
      const percentage = syncProgress.total > 0 
        ? (syncProgress.synced / syncProgress.total) * 100 
        : 0;

      Animated.timing(progressAnim, {
        toValue: percentage,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [syncProgress]);

  if (!isSyncing || !syncProgress) {
    return null;
  }

  const percentage = syncProgress.total > 0 
    ? Math.round((syncProgress.synced / syncProgress.total) * 100) 
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <Animated.View 
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]} 
        />
      </View>
      <Text style={styles.text}>
        Uploading {syncProgress.synced}/{syncProgress.total} reports... {percentage}%
      </Text>
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
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  text: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});
