/**
 * CrisisNet Mobile - SQLite Database Schema
 * Offline queue for crisis reports with sync tracking
 */

export const DB_NAME = 'crisisnet.db';
export const DB_VERSION = 1;

/**
 * Create tables SQL
 * 
 * pending_reports: Queue of reports waiting to sync
 * sync_log: Audit trail of sync attempts
 */
export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS pending_reports (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    crisis_type TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    description TEXT,
    reported_casualties INTEGER DEFAULT 0,
    reporter_id TEXT NOT NULL,
    gemma_triage_result TEXT,
    severity_local TEXT,
    sync_status TEXT DEFAULT 'pending',
    sync_attempts INTEGER DEFAULT 0,
    last_sync_attempt INTEGER,
    sync_error TEXT,
    photo_uris TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    attempt_at INTEGER NOT NULL,
    success INTEGER NOT NULL,
    response_code INTEGER,
    error_message TEXT,
    FOREIGN KEY (report_id) REFERENCES pending_reports(id)
  );

  CREATE INDEX IF NOT EXISTS idx_pending_reports_sync_status
    ON pending_reports(sync_status, created_at);
`;

/**
 * Migration system
 * Handles schema version upgrades
 */
export const MIGRATIONS: { [version: number]: string } = {
  1: CREATE_TABLES_SQL,
  // Future migrations:
  // 2: 'ALTER TABLE pending_reports ADD COLUMN new_field TEXT;',
};

/**
 * Get migration SQL for target version
 */
export const getMigrationSQL = (currentVersion: number, targetVersion: number): string[] => {
  const migrations: string[] = [];
  
  for (let v = currentVersion + 1; v <= targetVersion; v++) {
    if (MIGRATIONS[v]) {
      migrations.push(MIGRATIONS[v]);
    }
  }
  
  return migrations;
};

/**
 * Drop all tables (for testing/reset)
 */
export const DROP_TABLES_SQL = `
  DROP TABLE IF EXISTS sync_log;
  DROP TABLE IF EXISTS pending_reports;
`;

/**
 * Initialize database
 * Creates tables if they don't exist
 */
export async function initDatabase(): Promise<void> {
  // Note: Actual SQLite implementation would use expo-sqlite or react-native-sqlite-storage
  // This is a placeholder that will be implemented when npm install runs
  console.log('[DB] Database initialized (placeholder)');
  return Promise.resolve();
}
