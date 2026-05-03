/**
 * CrisisNet Mobile - Offline Queue Screen
 * 
 * Shows pending reports from SQLite
 * Swipe to delete
 * Pull to refresh → manual sync
 * Fab button: Sync Now
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { SyncProgress } from '../components/SyncProgress';
import { useConnectivity } from '../hooks/useConnectivity';
import SyncService from '../services/SyncService';
import { PendingReport } from '../types';
import { CRISIS_COLORS, SEVERITY_COLORS } from '../constants';

export const OfflineQueueScreen: React.FC = () => {
  const { isOnline, isSyncing } = useConnectivity();
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const pending = await SyncService.getPendingReports();
      setReports(pending);
    } catch (error) {
      console.error('[OfflineQueueScreen] Failed to load reports:', error);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline');
      return;
    }

    if (isSyncing) {
      return;
    }

    try {
      await SyncService.syncPendingReports();
      await loadReports();
    } catch (error) {
      console.error('[OfflineQueueScreen] Sync failed:', error);
      Alert.alert('Error', 'Sync failed. Please try again.');
    }
  };

  const handleDelete = (reportId: string) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await SyncService.deleteReport(reportId);
              await loadReports();
            } catch (error) {
              console.error('[OfflineQueueScreen] Delete failed:', error);
              Alert.alert('Error', 'Failed to delete report');
            }
          },
        },
      ]
    );
  };

  const renderReport = ({ item }: { item: PendingReport }) => {
    const crisisColor = CRISIS_COLORS[item.crisis_type];
    const severityColor = item.severity_local
      ? SEVERITY_COLORS[item.severity_local]
      : '#6B7280';

    const timeAgo = getTimeAgo(item.created_at);
    const statusIcon = getStatusIcon(item.sync_status);
    const statusColor = getStatusColor(item.sync_status);

    return (
      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <View style={styles.reportTypeContainer}>
            <View style={[styles.reportTypeDot, { backgroundColor: crisisColor }]} />
            <Text style={styles.reportType}>{item.crisis_type.toUpperCase()}</Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={styles.deleteButton}>🗑️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reportBody}>
          {item.severity_local && (
            <View style={[styles.severityBadge, { backgroundColor: severityColor }]}>
              <Text style={styles.severityText}>{item.severity_local}</Text>
            </View>
          )}

          <Text style={styles.reportLocation}>
            📍 {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
          </Text>

          {item.description && (
            <Text style={styles.reportDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.reportFooter}>
            <Text style={styles.reportTime}>{timeAgo}</Text>
            <View style={styles.statusContainer}>
              <Text style={[styles.statusIcon, { color: statusColor }]}>{statusIcon}</Text>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.sync_status}
              </Text>
            </View>
          </View>

          {item.sync_error && (
            <Text style={styles.errorText}>⚠️ {item.sync_error}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>✓</Text>
      <Text style={styles.emptyTitle}>All Reports Synced</Text>
      <Text style={styles.emptyText}>
        No pending reports in the queue.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ConnectivityBanner />
      <SyncProgress />

      <FlatList
        data={reports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        contentContainerStyle={reports.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
          />
        }
      />

      {/* Fab Button */}
      {reports.length > 0 && (
        <TouchableOpacity
          style={[
            styles.fab,
            (!isOnline || isSyncing) && styles.fabDisabled,
          ]}
          onPress={handleSync}
          disabled={!isOnline || isSyncing}
        >
          <Text style={styles.fabText}>
            {isSyncing ? '⟳' : '📤'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'syncing':
      return '⟳';
    case 'synced':
      return '✓';
    case 'failed':
      return '✗';
    default:
      return '?';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return '#F59E0B';
    case 'syncing':
      return '#3B82F6';
    case 'synced':
      return '#10B981';
    case 'failed':
      return '#EF4444';
    default:
      return '#6B7280';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#374151',
  },
  reportTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  reportType: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    fontSize: 20,
  },
  reportBody: {
    padding: 16,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reportLocation: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 8,
  },
  reportDescription: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportTime: {
    color: '#6B7280',
    fontSize: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabDisabled: {
    backgroundColor: '#374151',
  },
  fabText: {
    fontSize: 24,
  },
});
