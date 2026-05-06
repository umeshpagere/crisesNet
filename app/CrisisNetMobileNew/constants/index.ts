/**
 * CrisisNet Mobile - Application Constants
 */

import { Platform } from 'react-native';

// Gemma 4 Model Configuration
export const GEMMA_MODEL_PATH = {
  android: '/data/data/com.crisisnetmobile/files/gemma-4-it-q4.bin',
  ios: 'gemma-4-it-q4.bin', // bundled in app
};

export const GEMMA_MODEL_URL = 'https://storage.googleapis.com/crisisnet-models/gemma-4-it-q4.bin';
export const GEMMA_MODEL_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
export const GEMMA_MAX_INPUT_TOKENS = 512;
export const GEMMA_MAX_OUTPUT_TOKENS = 256;
export const GEMMA_TEMPERATURE = 0.3;
export const GEMMA_TOP_P = 0.9;
export const GEMMA_TOP_K = 40;

// Sync Configuration
export const SYNC_RETRY_MAX = 3;
export const SYNC_RETRY_BASE_MS = 1000;
export const SYNC_AUTO_TRIGGER_DELAY_MS = 3000;
export const SYNC_MAX_CONCURRENT = 3;

// Location Configuration
export const GPS_ACCURACY_THRESHOLD_M = 50;
export const GPS_TIMEOUT_MS = 15000;
export const GPS_MAX_AGE_MS = 5000;

// API Configuration
export const API_BASE_URL = process.env.API_BASE_URL || 'https://crisisnet-api-3mz45jxewq-el.a.run.app';

export const API_ENDPOINTS = {
  HUB_PROCESS: '/api/v1/hub/process',
  BOATS_LOCATION: '/api/v1/boats/location',
  HEATMAP: '/api/v1/heatmap',
};

// UI Configuration
export const CRISIS_COLORS = {
  flood: '#3B82F6',      // blue
  earthquake: '#8B5CF6', // purple
  fire: '#EF4444',       // red
  medical: '#10B981',    // green
  other: '#6B7280',      // gray
};

export const SEVERITY_COLORS = {
  critical: '#DC2626',   // red-600
  high: '#F97316',       // orange-500
  moderate: '#EAB308',   // yellow-500
  low: '#22C55E',        // green-500
};

// Database Configuration
export const DB_NAME = 'crisisnet.db';
export const DB_VERSION = 1;

// Permissions
export const REQUIRED_PERMISSIONS = Platform.select({
  android: [
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
  ],
  ios: [
    'ios.permission.LOCATION_WHEN_IN_USE',
  ],
  default: [],
});

export const OPTIONAL_PERMISSIONS = Platform.select({
  android: [
    'android.permission.RECORD_AUDIO',
  ],
  ios: [
    'ios.permission.MICROPHONE',
  ],
  default: [],
});

// Timeouts
export const NETWORK_TIMEOUT_MS = 30000;
export const INFERENCE_TIMEOUT_MS = 10000;

// Fallback Messages
export const FALLBACK_MESSAGES = {
  MODEL_UNAVAILABLE: 'AI offline — showing standard guidance',
  NETWORK_ERROR: 'No connection — report saved locally',
  SYNC_FAILED: 'Sync failed — will retry automatically',
  GPS_UNAVAILABLE: 'Location unavailable — using last known position',
};
