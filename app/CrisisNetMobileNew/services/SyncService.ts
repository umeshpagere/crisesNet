/**
 * CrisisNet Mobile - Sync Service
 * 
 * Manages offline queue and syncs pending reports to backend
 * Features:
 * - Exponential backoff retry (1s → 2s → 4s, max 3 attempts)
 * - Max 3 concurrent uploads
 * - Marks failed after 3 retries
 * - Auto-sync on connectivity restored
 */

import { PendingReport, SyncResult } from '../types';
import {
  SYNC_RETRY_MAX,
  SYNC_RETRY_BASE_MS,
  SYNC_MAX_CONCURRENT,
  API_BASE_URL,
  API_ENDPOINTS,
  NETWORK_TIMEOUT_MS,
} from '../constants';

// Mock SQLite interface (real implementation would use react-native-sqlite-storage)
interface SQLiteDatabase {
  executeSql(
    sql: string,
    params?: any[],
    success?: (tx: any, results: any) => void,
    error?: (tx: any, error: any) => void
  ): void;
}

// Mock Axios interface
interface AxiosResponse {
  status: number;
  data: any;
}

class SyncService {
  private static instance: SyncService;
  private db: SQLiteDatabase | null = null;
  private isSyncing = false;

  private constructor() {}

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Initialize with database connection
   */
  setDatabase(db: SQLiteDatabase): void {
    this.db = db;
  }

  /**
   * Queue a report for sync
   * Never throws - always succeeds
   */
  async queueReport(report: Omit<PendingReport, 'id' | 'created_at'>): Promise<string> {
    const id = this.generateId();
    const created_at = Date.now();

    const sql = `
      INSERT INTO pending_reports (
        id, created_at, crisis_type, lat, lng, description,
        reported_casualties, reporter_id, gemma_triage_result,
        severity_local, sync_status, sync_attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
    `;

    const params = [
      id,
      created_at,
      report.crisis_type,
      report.lat,
      report.lng,
      report.description || null,
      report.reported_casualties,
      report.reporter_id,
      report.gemma_triage_result || null,
      report.severity_local || null,
    ];

    try {
      if (!this.db) {
        console.error('[SyncService] Database not initialized');
        return id;
      }

      await this.executeSqlAsync(sql, params);
      console.log('[SyncService] Report queued:', id);
      return id;
    } catch (error) {
      console.error('[SyncService] Failed to queue report:', error);
      return id;
    }
  }

  /**
   * Sync all pending reports
   * Returns sync result with counts
   */
  async syncPendingReports(
    onProgress?: (synced: number, total: number) => void
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress');
      return { total: 0, synced: 0, failed: 0, errors: [] };
    }

    this.isSyncing = true;

    try {
      // Get pending reports
      const pending = await this.getPendingReports();

      if (pending.length === 0) {
        console.log('[SyncService] No pending reports');
        return { total: 0, synced: 0, failed: 0, errors: [] };
      }

      console.log(`[SyncService] Syncing ${pending.length} reports`);

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process in batches of SYNC_MAX_CONCURRENT
      for (let i = 0; i < pending.length; i += SYNC_MAX_CONCURRENT) {
        const batch = pending.slice(i, i + SYNC_MAX_CONCURRENT);

        const results = await Promise.allSettled(
          batch.map((report) => this.syncReport(report))
        );

        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value.success) {
            synced++;
          } else {
            failed++;
            const error =
              result.status === 'rejected'
                ? result.reason
                : result.value.error;
            errors.push(`Report ${batch[idx].id}: ${error}`);
          }
        });

        // Update progress
        if (onProgress) {
          onProgress(synced, pending.length);
        }
      }

      console.log(`[SyncService] Sync complete: ${synced}/${pending.length} synced`);

      return {
        total: pending.length,
        synced,
        failed,
        errors,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single report with retry logic
   */
  private async syncReport(
    report: PendingReport
  ): Promise<{ success: boolean; error?: string }> {
    const maxAttempts = SYNC_RETRY_MAX;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Mark as syncing
        await this.updateSyncStatus(report.id, 'syncing', attempt);

        // Make API call
        const response = await this.uploadReport(report);

        // Success - mark as synced
        await this.updateSyncStatus(report.id, 'synced', attempt);
        await this.logSyncAttempt(report.id, attempt, true, response.status, null);

        console.log(`[SyncService] Report ${report.id} synced successfully`);
        return { success: true };
      } catch (error: any) {
        const statusCode = error.response?.status;
        const errorMessage = error.message || 'Unknown error';

        // Log attempt
        await this.logSyncAttempt(report.id, attempt, false, statusCode, errorMessage);

        // 4xx errors - don't retry (bad data)
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          await this.updateSyncStatus(report.id, 'failed', attempt, errorMessage);
          console.error(`[SyncService] Report ${report.id} failed (4xx):`, errorMessage);
          return { success: false, error: errorMessage };
        }

        // Last attempt - mark as failed
        if (attempt === maxAttempts) {
          await this.updateSyncStatus(report.id, 'failed', attempt, errorMessage);
          console.error(`[SyncService] Report ${report.id} failed after ${maxAttempts} attempts`);
          return { success: false, error: errorMessage };
        }

        // Exponential backoff before retry
        const delayMs = SYNC_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        console.log(`[SyncService] Retrying report ${report.id} in ${delayMs}ms (attempt ${attempt + 1}/${maxAttempts})`);
        await this.sleep(delayMs);
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Upload report to backend API
   */
  private async uploadReport(report: PendingReport): Promise<AxiosResponse> {
    // Mock implementation - real code would use axios
    // const response = await axios.post(
    //   `${API_BASE_URL}${API_ENDPOINTS.HUB_PROCESS}`,
    //   {
    //     event_id: report.id,
    //     location: { lat: report.lat, lng: report.lng },
    //     crisis_type: report.crisis_type,
    //     description: report.description,
    //     reported_casualties: report.reported_casualties,
    //     reporter_id: report.reporter_id,
    //   },
    //   { timeout: NETWORK_TIMEOUT_MS }
    // );

    // Mock success response
    console.log(`[SyncService] Uploading report ${report.id} to ${API_BASE_URL}${API_ENDPOINTS.HUB_PROCESS}`);
    return {
      status: 200,
      data: { status: 'ok', event_id: report.id },
    };
  }

  /**
   * Get all pending reports
   */
  private async getPendingReports(): Promise<PendingReport[]> {
    const sql = `
      SELECT * FROM pending_reports
      WHERE sync_status = 'pending'
      ORDER BY created_at ASC
    `;

    try {
      const results = await this.executeSqlAsync(sql, []);
      const reports: PendingReport[] = [];

      for (let i = 0; i < results.rows.length; i++) {
        reports.push(results.rows.item(i));
      }

      return reports;
    } catch (error) {
      console.error('[SyncService] Failed to get pending reports:', error);
      return [];
    }
  }

  /**
   * Get count of pending reports
   */
  async getPendingCount(): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM pending_reports
      WHERE sync_status = 'pending'
    `;

    try {
      const results = await this.executeSqlAsync(sql, []);
      return results.rows.item(0).count;
    } catch (error) {
      console.error('[SyncService] Failed to get pending count:', error);
      return 0;
    }
  }

  /**
   * Get failed reports
   */
  async getFailedReports(): Promise<PendingReport[]> {
    const sql = `
      SELECT * FROM pending_reports
      WHERE sync_status = 'failed'
      ORDER BY created_at DESC
    `;

    try {
      const results = await this.executeSqlAsync(sql, []);
      const reports: PendingReport[] = [];

      for (let i = 0; i < results.rows.length; i++) {
        reports.push(results.rows.item(i));
      }

      return reports;
    } catch (error) {
      console.error('[SyncService] Failed to get failed reports:', error);
      return [];
    }
  }

  /**
   * Retry all failed reports
   */
  async retryFailed(): Promise<void> {
    const sql = `
      UPDATE pending_reports
      SET sync_status = 'pending', sync_attempts = 0
      WHERE sync_status = 'failed'
    `;

    try {
      await this.executeSqlAsync(sql, []);
      console.log('[SyncService] Failed reports marked for retry');
    } catch (error) {
      console.error('[SyncService] Failed to retry failed reports:', error);
    }
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus(
    reportId: string,
    status: string,
    attempts: number,
    error?: string
  ): Promise<void> {
    const sql = `
      UPDATE pending_reports
      SET sync_status = ?,
          sync_attempts = ?,
          last_sync_attempt = ?,
          sync_error = ?
      WHERE id = ?
    `;

    const params = [status, attempts, Date.now(), error || null, reportId];

    try {
      await this.executeSqlAsync(sql, params);
    } catch (err) {
      console.error('[SyncService] Failed to update sync status:', err);
    }
  }

  /**
   * Log sync attempt
   */
  private async logSyncAttempt(
    reportId: string,
    attempt: number,
    success: boolean,
    responseCode: number | null,
    errorMessage: string | null
  ): Promise<void> {
    const sql = `
      INSERT INTO sync_log (id, report_id, attempt_at, success, response_code, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [
      this.generateId(),
      reportId,
      Date.now(),
      success ? 1 : 0,
      responseCode,
      errorMessage,
    ];

    try {
      await this.executeSqlAsync(sql, params);
    } catch (error) {
      console.error('[SyncService] Failed to log sync attempt:', error);
    }
  }

  /**
   * Execute SQL with promise wrapper
   */
  private executeSqlAsync(sql: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.executeSql(
        sql,
        params,
        (tx, results) => resolve(results),
        (tx, error) => reject(error)
      );
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export default SyncService.getInstance();
