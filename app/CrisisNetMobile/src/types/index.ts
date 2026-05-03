/**
 * CrisisNet Mobile - TypeScript Type Definitions
 */

export type CrisisType = 'flood' | 'earthquake' | 'fire' | 'medical' | 'other';

export type SeverityLevel = 'critical' | 'high' | 'moderate' | 'low';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type GemmaStatus = 'unloaded' | 'loading' | 'ready' | 'error' | 'fallback';

export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

export type ReporterMode = 'victim' | 'responder';

export interface Location {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

export interface PendingReport {
  id: string;
  created_at: number;
  crisis_type: CrisisType;
  lat: number;
  lng: number;
  description?: string;
  reported_casualties: number;
  reporter_id: string;
  gemma_triage_result?: string; // JSON string
  severity_local?: SeverityLevel;
  sync_status: SyncStatus;
  sync_attempts: number;
  last_sync_attempt?: number;
  sync_error?: string;
  photo_uris?: string; // JSON array
}

export interface TriageInput {
  crisisType: CrisisType;
  description: string;
  reportedCasualties: number;
  location: string;
  reporterObservation: string;
}

export interface TriageOutput {
  severity: SeverityLevel;
  confidence: number;
  immediate_actions: string[];
  resources_needed: string[];
  escalate_to_hub: boolean;
  victim_guidance: string;
}

export interface GuidanceInput {
  severity: SeverityLevel;
  crisisType: CrisisType;
  userQuestion: string;
}

export interface AssessmentInput {
  observations: string[];
  location: string;
  infrastructure_damage: string;
  medical_needs: string;
}

export interface AssessmentOutput {
  priority_actions: string[];
  resource_requests: string[];
  zone_status: 'active' | 'contained' | 'resolved';
  estimated_affected: number;
  coordinator_notes: string;
}

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}

export interface SyncProgress {
  synced: number;
  total: number;
}

export interface GemmaServiceState {
  status: GemmaStatus;
  loadProgress: number;
  modelSizeBytes: number;
  inferenceCount: number;
  lastInferenceMs: number;
  errorMessage: string | null;
}
