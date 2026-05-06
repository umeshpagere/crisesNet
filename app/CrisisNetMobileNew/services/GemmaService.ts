/**
 * CrisisNet Mobile - Gemma 4 On-Device Inference Service
 * 
 * Singleton wrapper for react-native-mediapipe LLM inference
 * Handles model loading, inference, streaming, and fallback
 * 
 * States: UNLOADED → LOADING → READY → ERROR → FALLBACK
 */

import { GemmaServiceState, CrisisType, SeverityLevel } from '../types';
import {
  GEMMA_MAX_INPUT_TOKENS,
  GEMMA_MAX_OUTPUT_TOKENS,
  GEMMA_TEMPERATURE,
  GEMMA_TOP_P,
  GEMMA_MODEL_PATH,
} from '../constants';

// Mock MediaPipe interface (real implementation would use react-native-mediapipe)
interface MediaPipeLLM {
  loadModel(path: string, onProgress: (progress: number) => void): Promise<void>;
  generate(prompt: string, maxTokens: number, temperature: number, topP: number): Promise<string>;
  generateStream(
    prompt: string,
    maxTokens: number,
    temperature: number,
    topP: number,
    onToken: (token: string) => void
  ): Promise<void>;
  dispose(): void;
}

/**
 * Rule-based fallback triage logic
 * Used when Gemma 4 model unavailable
 */
const FALLBACK_TRIAGE_RULES: Array<[number, CrisisType[], SeverityLevel, boolean]> = [
  [10, ['flood', 'earthquake', 'fire'], 'critical', true],
  [5, ['flood', 'earthquake', 'fire', 'medical'], 'high', true],
  [1, ['medical'], 'high', true],
  [1, ['flood', 'earthquake', 'fire'], 'moderate', false],
  [0, ['flood', 'earthquake', 'fire', 'medical', 'other'], 'low', false],
];

const FALLBACK_ACTIONS: { [key in CrisisType]: string[] } = {
  flood: ['Move to high ground', 'Avoid floodwater', 'Signal for rescue'],
  earthquake: ['Exit building', 'Stay away from structures', 'Check for injuries'],
  fire: ['Evacuate immediately', 'Stay low', 'Call for help'],
  medical: ['Do not move injured person', 'Apply pressure to wounds', 'Keep warm'],
  other: ['Stay calm', 'Stay in place', 'Signal for help'],
};

const FALLBACK_RESOURCES: { [key in SeverityLevel]: string[] } = {
  critical: ['rescue_team', 'medical_team', 'evacuation_support'],
  high: ['rescue_team', 'medical_support'],
  moderate: ['first_aid', 'assessment_team'],
  low: ['monitoring'],
};

class GemmaService {
  private static instance: GemmaService;
  private state: GemmaServiceState;
  private llm: MediaPipeLLM | null = null;
  private modelPath: string;

  private constructor() {
    this.state = {
      status: 'unloaded',
      loadProgress: 0,
      modelSizeBytes: 0,
      inferenceCount: 0,
      lastInferenceMs: 0,
      errorMessage: null,
    };
    
    // Platform-specific model path
    this.modelPath = GEMMA_MODEL_PATH.android; // TODO: Platform.OS === 'ios' ? GEMMA_MODEL_PATH.ios : GEMMA_MODEL_PATH.android
  }

  static getInstance(): GemmaService {
    if (!GemmaService.instance) {
      GemmaService.instance = new GemmaService();
    }
    return GemmaService.instance;
  }

  /**
   * Initialize model loading (async, non-blocking)
   * App should call this on startup but NOT await it
   */
  async initialize(): Promise<void> {
    if (this.state.status !== 'unloaded') {
      console.log('[GemmaService] Already initialized or loading');
      return;
    }

    this.state.status = 'loading';
    this.state.loadProgress = 0;

    try {
      // Mock implementation - real code would use react-native-mediapipe
      // this.llm = new MediaPipeLLM();
      // await this.llm.loadModel(this.modelPath, (progress) => {
      //   this.state.loadProgress = progress;
      // });

      // For now, simulate loading failure to test fallback
      console.log('[GemmaService] Model loading not implemented - using fallback mode');
      this.state.status = 'fallback';
      this.state.errorMessage = 'MediaPipe not available - using rule-based fallback';
      
    } catch (error) {
      console.error('[GemmaService] Model load failed:', error);
      this.state.status = 'fallback';
      this.state.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  /**
   * Run inference
   * Throws if model not ready
   */
  async infer(prompt: string, maxTokens: number = GEMMA_MAX_OUTPUT_TOKENS): Promise<string> {
    if (this.state.status !== 'ready') {
      throw new Error(`Model not ready (status: ${this.state.status})`);
    }

    // Truncate prompt if too long
    const truncatedPrompt = this.truncatePrompt(prompt);

    const startTime = Date.now();

    try {
      if (!this.llm) {
        throw new Error('LLM instance not initialized');
      }

      const response = await this.llm.generate(
        truncatedPrompt,
        maxTokens,
        GEMMA_TEMPERATURE,
        GEMMA_TOP_P
      );

      this.state.lastInferenceMs = Date.now() - startTime;
      this.state.inferenceCount++;

      return response;
    } catch (error) {
      console.error('[GemmaService] Inference failed:', error);
      throw error;
    }
  }

  /**
   * Run streaming inference
   * Calls onToken for each generated token
   */
  async inferStream(
    prompt: string,
    onToken: (token: string) => void,
    maxTokens: number = GEMMA_MAX_OUTPUT_TOKENS
  ): Promise<void> {
    if (this.state.status !== 'ready') {
      throw new Error(`Model not ready (status: ${this.state.status})`);
    }

    const truncatedPrompt = this.truncatePrompt(prompt);

    const startTime = Date.now();

    try {
      if (!this.llm) {
        throw new Error('LLM instance not initialized');
      }

      await this.llm.generateStream(
        truncatedPrompt,
        maxTokens,
        GEMMA_TEMPERATURE,
        GEMMA_TOP_P,
        onToken
      );

      this.state.lastInferenceMs = Date.now() - startTime;
      this.state.inferenceCount++;
    } catch (error) {
      console.error('[GemmaService] Streaming inference failed:', error);
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): GemmaServiceState {
    return { ...this.state };
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.state.status === 'ready';
  }

  /**
   * Get rule-based fallback response
   * Used when model unavailable
   */
  getFallbackResponse(promptType: string, input: any): string {
    console.log('[GemmaService] Using fallback for:', promptType);

    if (promptType === 'triage') {
      return this.getFallbackTriage(input);
    } else if (promptType === 'guidance') {
      return this.getFallbackGuidance(input);
    } else if (promptType === 'assessment') {
      return this.getFallbackAssessment(input);
    }

    return JSON.stringify({
      error: 'Unknown prompt type',
      fallback: true,
    });
  }

  /**
   * Rule-based triage fallback
   */
  private getFallbackTriage(input: {
    crisisType: CrisisType;
    reportedCasualties: number;
  }): string {
    const { crisisType, reportedCasualties } = input;

    // Find matching rule
    let severity: SeverityLevel = 'low';
    let escalate = false;

    for (const [minCasualties, types, sev, esc] of FALLBACK_TRIAGE_RULES) {
      if (reportedCasualties >= minCasualties && types.includes(crisisType)) {
        severity = sev;
        escalate = esc;
        break;
      }
    }

    const actions = FALLBACK_ACTIONS[crisisType] || FALLBACK_ACTIONS.other;
    const resources = FALLBACK_RESOURCES[severity];

    const guidance =
      severity === 'critical'
        ? 'Evacuate immediately. Help is on the way.'
        : severity === 'high'
        ? 'Move to safety. Responders dispatched.'
        : severity === 'moderate'
        ? 'Stay alert. Help available if needed.'
        : 'Situation monitored. Stay safe.';

    return JSON.stringify({
      severity,
      confidence: 0.6, // Lower confidence for rule-based
      immediate_actions: actions,
      resources_needed: resources,
      escalate_to_hub: escalate,
      victim_guidance: guidance,
    });
  }

  /**
   * Rule-based guidance fallback
   */
  private getFallbackGuidance(input: { crisisType: CrisisType; severity: SeverityLevel }): string {
    const actions = FALLBACK_ACTIONS[input.crisisType] || FALLBACK_ACTIONS.other;
    return `${actions[0]}. ${actions[1] || 'Stay safe.'}`;
  }

  /**
   * Rule-based assessment fallback
   */
  private getFallbackAssessment(input: any): string {
    return JSON.stringify({
      priority_actions: ['Assess situation', 'Secure area', 'Request resources'],
      resource_requests: ['assessment_team', 'first_aid'],
      zone_status: 'active',
      estimated_affected: 10,
      coordinator_notes: 'Standard assessment - AI unavailable',
    });
  }

  /**
   * Truncate prompt to fit token budget
   */
  private truncatePrompt(prompt: string): string {
    // Approximate: 4 chars per token
    const maxChars = GEMMA_MAX_INPUT_TOKENS * 4;
    if (prompt.length <= maxChars) {
      return prompt;
    }

    console.warn(`[GemmaService] Truncating prompt from ${prompt.length} to ${maxChars} chars`);
    return prompt.slice(0, maxChars);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.llm) {
      this.llm.dispose();
      this.llm = null;
    }
    this.state.status = 'unloaded';
  }
}

// Export singleton instance
export default GemmaService.getInstance();
