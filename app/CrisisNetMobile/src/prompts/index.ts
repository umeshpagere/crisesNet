/**
 * CrisisNet Mobile - Gemma 4 Optimized Prompts
 * 
 * CRITICAL DESIGN CONSTRAINTS:
 * - Gemma 4 instruction-tuned format: <start_of_turn>user / <end_of_turn> / <start_of_turn>model
 * - Max input tokens: 512 (mobile memory constraint)
 * - Max output tokens: 256 (latency constraint)
 * - Temperature: 0.3 (consistency over creativity)
 * - Token budget breakdown:
 *   - System + instructions: ~120 tokens
 *   - Few-shot example: ~80 tokens
 *   - Dynamic input: ~100 tokens (reserved)
 *   - Response: 256 tokens max
 * 
 * Prompt engineering principles applied:
 * 1. Role prompting: Brief expert persona
 * 2. Structured output: Enforce JSON format
 * 3. Constraint boundaries: Explicit enum values
 * 4. Few-shot: 1 example only (token budget)
 * 5. Format enforcement: "Start with {" prevents preamble
 * 6. No chain-of-thought: Saves tokens, not needed for classification
 */

import { TriageInput, GuidanceInput, AssessmentInput } from '../types';

/**
 * TRIAGE PROMPT
 * Purpose: Assess crisis severity and provide immediate guidance
 * Token budget: ~300 tokens (system + example + input)
 * Output: JSON with severity, actions, resources
 */
export const buildTriagePrompt = (input: TriageInput): string => {
  // Truncate description to fit token budget
  const truncatedDesc = input.description.slice(0, 200);
  
  return `<start_of_turn>user
You are a crisis triage AI. Assess severity and give response guidance.
Respond ONLY with JSON. Start with {. No explanation.

Output schema:
{"severity":"critical|high|moderate|low","confidence":0.0-1.0,"immediate_actions":["string"],"resources_needed":["string"],"escalate_to_hub":true|false,"victim_guidance":"string (max 100 chars, plain language)"}

Example:
Input: flood, 8 casualties, river overflowing
Output: {"severity":"critical","confidence":0.88,"immediate_actions":["Move to high ground immediately","Do not enter floodwater"],"resources_needed":["rescue_boats","medical_team"],"escalate_to_hub":true,"victim_guidance":"Go to highest point. Help is coming. Stay visible."}

Now assess:
Type: ${input.crisisType}
Casualties: ${input.reportedCasualties}
Location: ${input.location}
Description: ${truncatedDesc}
<end_of_turn>
<start_of_turn>model
`;
};

/**
 * GUIDANCE PROMPT
 * Purpose: Answer victim questions in plain language
 * Token budget: ~150 tokens
 * Output: 2 sentences max, conversational
 */
export const buildGuidancePrompt = (input: GuidanceInput): string => {
  const truncatedQuestion = input.userQuestion.slice(0, 150);
  
  return `<start_of_turn>user
Crisis assistant. ${input.crisisType}, severity: ${input.severity}.
Answer in 2 sentences max. Plain language. No jargon.
Question: ${truncatedQuestion}
<end_of_turn>
<start_of_turn>model
`;
};

/**
 * ASSESSMENT PROMPT
 * Purpose: Field responder structured assessment
 * Token budget: ~250 tokens
 * Output: JSON with priority actions and resource requests
 */
export const buildAssessmentPrompt = (input: AssessmentInput): string => {
  // Take first 3 observations to fit token budget
  const topObservations = input.observations.slice(0, 3).join('; ');
  const truncatedInfra = input.infrastructure_damage.slice(0, 100);
  const truncatedMedical = input.medical_needs.slice(0, 100);
  
  return `<start_of_turn>user
Field assessment AI. Output JSON only. Start with {.
Schema: {"priority_actions":["string"],"resource_requests":["string"],"zone_status":"active|contained|resolved","estimated_affected":number,"coordinator_notes":"string (max 150 chars)"}
Location: ${input.location}
Observations: ${topObservations}
Infrastructure: ${truncatedInfra}
Medical: ${truncatedMedical}
<end_of_turn>
<start_of_turn>model
`;
};

/**
 * Token counting utility (approximate)
 * Uses simple heuristic: ~4 chars per token
 */
export const estimateTokenCount = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Validate prompt token budget
 * Returns true if within limits
 */
export const validatePromptTokens = (prompt: string): boolean => {
  const estimated = estimateTokenCount(prompt);
  return estimated <= 512; // GEMMA_MAX_INPUT_TOKENS
};
