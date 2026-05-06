/**
 * CrisisNet Mobile - Connectivity Banner Component
 * 
 * Shows online/offline/syncing states
 * Pending count badge
 * Tap to view queue
 * 4 states: online, offline, syncing, error
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useConnectivity } from '../hooks/useConnectivity';

interface ConnectivityBannerProps {
  onTapQueue?: () => void;
}

export const ConnectivityBanner: React.FC<ConnectivityBannerProps> = ({ onTapQueue }) => {
  const { isOnline, connectionType, pendingCount, isSyncing, syncProgress } = useConnectivity();

  // Determine banner state and styling
  const getBannerState = () => {
    if (isSyncing) {
      return {
        backgroundColor: '#1F2937',
        icon: <ActivityIndicator size="small" color="#3B82F6" />,
        text: syncProgress 
          ? `Syncing ${syncProgress.synced}/${syncProgress.total}...`
          : 'Syncing...',
        textColor: '#3B82F6',
      };
    }

    if (!isOnline) {
      return {
        backgroundColor: '#78350F',
        icon: '📴',
        text: 'Offline — AI Mode Active',
        textColor: '#FCD34D',
      };
    }

    if (pendingCount > 0) {
      return {
        backgroundColor: '#1F2937',
        icon: '📤',
        text: `${pendingCount} report${pendingCount > 1 ? 's' : ''} pending`,
        textColor: '#F59E0B',
      };
    }

    return {
      backgroundColor: '#065F46',
      icon: '✓',
      text: connectionType === 'wifi' ? 'Online (WiFi)' : 'Online',
      textColor: '#10B981',
    };
  };

  const state = getBannerState();
  const showBadge = pendingCount > 0 && !isSyncing;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: state.backgroundColor }]}
      onPress={onTapQueue}
      disabled={!onTapQueue || pendingCount === 0}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {typeof state.icon === 'string' ? (
          <Text style={styles.iconText}>{state.icon}</Text>
        ) : (
          state.icon
        )}
        <Text style={[styles.text, { color: state.textColor }]}>
          {state.text}
        </Text>
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
