/**
 * CrisisNet Mobile - API Service
 * 
 * Axios wrapper for Flask backend (Phase 0/2/3/5 endpoints)
 * Never throws to caller - always returns { data, error, statusCode }
 */

import axios, { AxiosError, AxiosResponse } from 'axios';
import { API_BASE_URL, API_ENDPOINTS, NETWORK_TIMEOUT_MS } from '../constants';
import { PendingReport } from '../types';

export interface APIResponse<T = any> {
  data: T | null;
  error: string | null;
  statusCode: number | null;
}

export interface GPSUpdate {
  boat_id: string;
  lat: number;
  lng: number;
  battery_pct: number;
  status: string;
}

export interface AllocationResult {
  status: string;
  objective_value: number;
  assignments: Array<{
    resource_id: string;
    resource_type: string;
    assigned_event_id: string;
    crisis_type: string;
    priority_score: number;
    distance_km: number;
    eta_minutes: number;
    route: Array<{ lat: number; lng: number }>;
  }>;
  unassigned_events: string[];
  optimization_ms: number;
  algorithm_used: string;
  coverage_rate: number;
}

class APIService {
  private static instance: APIService;
  private baseURL: string;

  private constructor() {
    this.baseURL = API_BASE_URL;
  }

  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  /**
   * Set custom base URL (for testing or config changes)
   */
  setBaseURL(url: string): void {
    this.baseURL = url;
    console.log('[APIService] Base URL updated:', url);
  }

  /**
   * Phase 2 - Decision Hub
   * Submit crisis report to hub/process endpoint
   */
  async submitCrisisReport(report: PendingReport): Promise<APIResponse> {
    try {
      const response = await axios.post(
        `${this.baseURL}${API_ENDPOINTS.HUB_PROCESS}`,
        {
          event_id: report.id,
          location: { lat: report.lat, lng: report.lng },
          crisis_type: report.crisis_type,
          description: report.description || '',
          reported_casualties: report.reported_casualties,
          reporter_id: report.reporter_id,
          timestamp: new Date(report.created_at).toISOString(),
        },
        { timeout: NETWORK_TIMEOUT_MS }
      );

      return {
        data: response.data,
        error: null,
        statusCode: response.status,
      };
    } catch (error) {
      return this.handleError(error as AxiosError, 'submitCrisisReport');
    }
  }

  /**
   * Phase 3 - GPS tracking
   * Update boat location
   */
  async updateBoatLocation(update: GPSUpdate): Promise<APIResponse> {
    try {
      const response = await axios.post(
        `${this.baseURL}${API_ENDPOINTS.BOATS_LOCATION}`,
        update,
        { timeout: NETWORK_TIMEOUT_MS }
      );

      return {
        data: response.data,
        error: null,
        statusCode: response.status,
      };
    } catch (error) {
      return this.handleError(error as AxiosError, 'updateBoatLocation');
    }
  }

  /**
   * Phase 3 - GPS tracking
   * Get active boats
   */
  async getActiveBoats(): Promise<APIResponse> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v1/boats`,
        { timeout: NETWORK_TIMEOUT_MS }
      );

      return {
        data: response.data,
        error: null,
        statusCode: response.status,
      };
    } catch (error) {
      return this.handleError(error as AxiosError, 'getActiveBoats');
    }
  }

  /**
   * Phase 3 - Heatmap
   * Get threat heatmap
   */
  async getHeatmap(): Promise<APIResponse> {
    try {
      const response = await axios.get(
        `${this.baseURL}${API_ENDPOINTS.HEATMAP}`,
        { timeout: NETWORK_TIMEOUT_MS }
      );

      return {
        data: response.data,
        error: null,
        statusCode: response.status,
      };
    } catch (error) {
      return this.handleError(error as AxiosError, 'getHeatmap');
    }
  }

  /**
   * Phase 5 - Allocation
   * Get optimal resource allocation from OR-Tools
   */
  async getOptimalAllocation(
    crisisLocation: { lat: number; lng: number },
    severity: string,
    resourcesNeeded: string[]
  ): Promise<APIResponse<AllocationResult>> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v1/allocation/optimize`,
        {
          params: {
            lat: crisisLocation.lat,
            lng: crisisLocation.lng,
            severity,
            resources: resourcesNeeded.join(','),
          },
          timeout: NETWORK_TIMEOUT_MS,
        }
      );

      return {
        data: response.data,
        error: null,
        statusCode: response.status,
      };
    } catch (error) {
      return this.handleError(error as AxiosError, 'getOptimalAllocation');
    }
  }

  /**
   * Health check
   * Returns true if backend is reachable
   */
  async ping(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v1/health`,
        { timeout: 5000 }
      );

      return response.status === 200;
    } catch (error) {
      console.error('[APIService] Health check failed:', error);
      return false;
    }
  }

  /**
   * Handle axios errors consistently
   * Never throws - always returns APIResponse
   */
  private handleError(error: AxiosError, method: string): APIResponse {
    if (error.response) {
      // Server responded with error status
      console.error(`[APIService] ${method} failed:`, error.response.status, error.response.data);
      return {
        data: null,
        error: error.response.data?.message || error.message || 'Server error',
        statusCode: error.response.status,
      };
    } else if (error.request) {
      // Request made but no response (network error)
      console.error(`[APIService] ${method} network error:`, error.message);
      return {
        data: null,
        error: 'Network error - check your connection',
        statusCode: null,
      };
    } else {
      // Request setup error
      console.error(`[APIService] ${method} request error:`, error.message);
      return {
        data: null,
        error: error.message || 'Request failed',
        statusCode: null,
      };
    }
  }
}

// Export singleton instance
export default APIService.getInstance();
