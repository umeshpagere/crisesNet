/**
 * CrisisNet Mobile - Gemma Inference Hook
 * 
 * Wraps GemmaService with React state management
 * States: idle → loading → streaming → complete → error
 * Auto-parse JSON from triage/assessment responses
 */

import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import GemmaService from '../services/GemmaService';
import { TriageOutput, AssessmentOutput } from '../types';

export type InferenceStatus = 'idle' | 'loading' | 'streaming' | 'complete' | 'error' | 'fallback';

export interface GemmaInferenceState {
  status: InferenceStatus;
  response: string;
  parsedResponse: TriageOutput | AssessmentOutput | null;
  inferenceMs: number;
  error: string | null;
}

export interface GemmaInferenceActions {
  run: (prompt: string, promptType?: string) => Promise<void>;
  runStream: (prompt: string, promptType?: string) => Promise<void>;
  reset: () => void;
}

export const useGemmaInference = (): GemmaInferenceState & GemmaInferenceActions => {
  const {
    gemmaStatus,
    incrementGemmaInferenceCount,
    setGemmaLastInferenceMs,
  } = useAppStore();

  const [status, setStatus] = useState<InferenceStatus>('idle');
  const [response, setResponse] = useState('');
  const [parsedResponse, setParsedResponse] = useState<TriageOutput | AssessmentOutput | null>(null);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Run inference (non-streaming)
   */
  const run = useCallback(async (prompt: string, promptType: string = 'triage') => {
    setStatus('loading');
    setResponse('');
    setParsedResponse(null);
    setError(null);

    const startTime = Date.now();

    try {
      let result: string;

      if (gemmaStatus === 'ready') {
        // Use Gemma AI
        result = await GemmaService.infer(prompt);
      } else {
        // Use fallback
        setStatus('fallback');
        result = GemmaService.getFallbackResponse(promptType, extractInputFromPrompt(prompt, promptType));
      }

      const elapsed = Date.now() - startTime;

      setResponse(result);
      setInferenceMs(elapsed);
      setStatus('complete');

      // Try to parse JSON
      const parsed = tryParseJSON(result);
      if (parsed) {
        setParsedResponse(parsed);
      }

      // Update store
      incrementGemmaInferenceCount();
      setGemmaLastInferenceMs(elapsed);

      console.log(`[useGemmaInference] Inference complete in ${elapsed}ms (${gemmaStatus})`);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Inference failed';

      console.error('[useGemmaInference] Inference error:', errorMessage);

      setError(errorMessage);
      setStatus('error');
      setInferenceMs(elapsed);

      // Fallback on error
      try {
        const fallbackResult = GemmaService.getFallbackResponse(promptType, extractInputFromPrompt(prompt, promptType));
        setResponse(fallbackResult);
        setStatus('fallback');

        const parsed = tryParseJSON(fallbackResult);
        if (parsed) {
          setParsedResponse(parsed);
        }
      } catch (fallbackErr) {
        console.error('[useGemmaInference] Fallback also failed:', fallbackErr);
      }
    }
  }, [gemmaStatus, incrementGemmaInferenceCount, setGemmaLastInferenceMs]);

  /**
   * Run streaming inference
   */
  const runStream = useCallback(async (prompt: string, promptType: string = 'triage') => {
    setStatus('streaming');
    setResponse('');
    setParsedResponse(null);
    setError(null);

    const startTime = Date.now();
    let accumulated = '';

    try {
      if (gemmaStatus === 'ready') {
        // Use Gemma AI streaming
        await GemmaService.inferStream(
          prompt,
          (token: string) => {
            accumulated += token;
            setResponse(accumulated);
          }
        );
      } else {
        // Fallback doesn't stream - just set result
        setStatus('fallback');
        const result = GemmaService.getFallbackResponse(promptType, extractInputFromPrompt(prompt, promptType));
        accumulated = result;
        setResponse(result);
      }

      const elapsed = Date.now() - startTime;

      setInferenceMs(elapsed);
      setStatus('complete');

      // Try to parse JSON
      const parsed = tryParseJSON(accumulated);
      if (parsed) {
        setParsedResponse(parsed);
      }

      // Update store
      incrementGemmaInferenceCount();
      setGemmaLastInferenceMs(elapsed);

      console.log(`[useGemmaInference] Streaming complete in ${elapsed}ms (${gemmaStatus})`);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Streaming failed';

      console.error('[useGemmaInference] Streaming error:', errorMessage);

      setError(errorMessage);
      setStatus('error');
      setInferenceMs(elapsed);

      // Fallback on error
      try {
        const fallbackResult = GemmaService.getFallbackResponse(promptType, extractInputFromPrompt(prompt, promptType));
        setResponse(fallbackResult);
        setStatus('fallback');

        const parsed = tryParseJSON(fallbackResult);
        if (parsed) {
          setParsedResponse(parsed);
        }
      } catch (fallbackErr) {
        console.error('[useGemmaInference] Fallback also failed:', fallbackErr);
      }
    }
  }, [gemmaStatus, incrementGemmaInferenceCount, setGemmaLastInferenceMs]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setResponse('');
    setParsedResponse(null);
    setInferenceMs(0);
    setError(null);
  }, []);

  return {
    status,
    response,
    parsedResponse,
    inferenceMs,
    error,
    run,
    runStream,
    reset,
  };
};

/**
 * Try to parse JSON response
 */
function tryParseJSON(text: string): TriageOutput | AssessmentOutput | null {
  try {
    // Extract JSON from response (may have preamble/postamble)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.warn('[useGemmaInference] Failed to parse JSON:', error);
    return null;
  }
}

/**
 * Extract input data from prompt for fallback
 * This is a simple parser - real implementation would be more robust
 */
function extractInputFromPrompt(prompt: string, promptType: string): any {
  if (promptType === 'triage') {
    // Extract crisis type and casualties from prompt
    const typeMatch = prompt.match(/Type:\s*(\w+)/);
    const casualtiesMatch = prompt.match(/Casualties:\s*(\d+)/);

    return {
      crisisType: typeMatch ? typeMatch[1] : 'other',
      reportedCasualties: casualtiesMatch ? parseInt(casualtiesMatch[1], 10) : 0,
    };
  } else if (promptType === 'guidance') {
    const typeMatch = prompt.match(/(\w+),\s*severity/);
    const severityMatch = prompt.match(/severity:\s*(\w+)/);

    return {
      crisisType: typeMatch ? typeMatch[1] : 'other',
      severity: severityMatch ? severityMatch[1] : 'moderate',
    };
  } else if (promptType === 'assessment') {
    return {}; // Assessment fallback doesn't need input parsing
  }

  return {};
}
