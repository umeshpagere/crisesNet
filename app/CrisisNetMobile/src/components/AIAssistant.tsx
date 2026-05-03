/**
 * CrisisNet Mobile - AI Assistant Component
 * 
 * Chat bubble UI for Gemma 4 responses
 * Streaming token display with cursor blink
 * JSON field rendering for structured output
 * Follow-up question input
 * All states: idle, loading, streaming, complete, fallback, error
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useGemmaInference } from '../hooks/useGemmaInference';
import { useAppStore } from '../store/useAppStore';
import { TriageOutput } from '../types';

interface AIAssistantProps {
  prompt: string;
  promptType: 'triage' | 'guidance' | 'assessment';
  streaming?: boolean;
  onComplete?: (response: string, parsed: any) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  prompt,
  promptType,
  streaming = false,
  onComplete,
}) => {
  const { gemmaStatus } = useAppStore();
  const { status, response, parsedResponse, inferenceMs, error, run, runStream, reset } =
    useGemmaInference();

  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Run inference when prompt changes
  useEffect(() => {
    if (prompt) {
      reset();
      if (streaming) {
        runStream(prompt, promptType);
      } else {
        run(prompt, promptType);
      }
    }
  }, [prompt, promptType, streaming]);

  // Notify parent on complete
  useEffect(() => {
    if (status === 'complete' && onComplete) {
      onComplete(response, parsedResponse);
    }
  }, [status, response, parsedResponse, onComplete]);

  // Cursor blink animation for streaming
  useEffect(() => {
    if (status === 'streaming') {
      const interval = setInterval(() => {
        setShowCursor((prev) => !prev);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setShowCursor(false);
    }
  }, [status]);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (status === 'streaming' && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [response, status]);

  const handleFollowUp = () => {
    if (followUpQuestion.trim()) {
      // Build follow-up prompt (simplified - real implementation would use guidance prompt)
      const followUpPrompt = `Question: ${followUpQuestion}`;
      setFollowUpQuestion('');
      run(followUpPrompt, 'guidance');
    }
  };

  // Render based on status
  const renderContent = () => {
    if (status === 'idle') {
      return null;
    }

    if (status === 'loading') {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.loadingText}>AI analyzing...</Text>
        </View>
      );
    }

    if (status === 'error' && !response) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error || 'AI unavailable'}</Text>
        </View>
      );
    }

    // Show response (streaming, complete, or fallback)
    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.responseContainer}
        contentContainerStyle={styles.responseContent}
      >
        {/* Status indicator */}
        {status === 'fallback' && (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackText}>Standard Mode</Text>
          </View>
        )}

        {/* Parsed JSON fields (for triage/assessment) */}
        {parsedResponse && promptType === 'triage' && (
          <TriageResponseView triage={parsedResponse as TriageOutput} />
        )}

        {/* Raw response (for guidance or unparsed) */}
        {!parsedResponse && response && (
          <Text style={styles.responseText}>
            {response}
            {status === 'streaming' && showCursor && (
              <Text style={styles.cursor}>|</Text>
            )}
          </Text>
        )}

        {/* Inference time */}
        {status === 'complete' && inferenceMs > 0 && (
          <Text style={styles.inferenceTime}>
            Response time: {(inferenceMs / 1000).toFixed(1)}s
          </Text>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Model status indicator */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {gemmaStatus === 'ready' ? '🤖 CrisisNet AI' : '📋 Standard Guidance'}
        </Text>
        {status === 'streaming' && (
          <ActivityIndicator size="small" color="#3B82F6" style={styles.headerSpinner} />
        )}
      </View>

      {/* Response content */}
      {renderContent()}

      {/* Follow-up question input (only show when complete) */}
      {status === 'complete' && promptType === 'guidance' && (
        <View style={styles.followUpContainer}>
          <TextInput
            style={styles.followUpInput}
            placeholder="Ask a follow-up question..."
            placeholderTextColor="#6B7280"
            value={followUpQuestion}
            onChangeText={setFollowUpQuestion}
            onSubmitEditing={handleFollowUp}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={styles.followUpButton}
            onPress={handleFollowUp}
            disabled={!followUpQuestion.trim()}
          >
            <Text style={styles.followUpButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/**
 * Render triage response with structured fields
 */
const TriageResponseView: React.FC<{ triage: TriageOutput }> = ({ triage }) => {
  const severityColor = getSeverityColor(triage.severity);

  return (
    <View style={styles.triageContainer}>
      {/* Severity badge */}
      <View style={[styles.severityBadge, { backgroundColor: severityColor }]}>
        <Text style={styles.severityText}>{triage.severity.toUpperCase()}</Text>
        <Text style={styles.confidenceText}>
          {Math.round(triage.confidence * 100)}% confidence
        </Text>
      </View>

      {/* Victim guidance (prominent) */}
      <View style={styles.guidanceBox}>
        <Text style={styles.guidanceIcon}>💡</Text>
        <Text style={styles.guidanceText}>{triage.victim_guidance}</Text>
      </View>

      {/* Immediate actions checklist */}
      {triage.immediate_actions && triage.immediate_actions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Immediate Actions:</Text>
          {triage.immediate_actions.map((action, idx) => (
            <View key={idx} style={styles.checklistItem}>
              <Text style={styles.checklistBullet}>•</Text>
              <Text style={styles.checklistText}>{action}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Resources needed */}
      {triage.resources_needed && triage.resources_needed.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resources Requested:</Text>
          <View style={styles.resourceTags}>
            {triage.resources_needed.map((resource, idx) => (
              <View key={idx} style={styles.resourceTag}>
                <Text style={styles.resourceTagText}>{resource}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Escalation notice */}
      {triage.escalate_to_hub && (
        <View style={styles.escalationNotice}>
          <Text style={styles.escalationText}>
            ⚡ Escalated to coordination hub
          </Text>
        </View>
      )}
    </View>
  );
};

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#DC2626';
    case 'high':
      return '#F97316';
    case 'moderate':
      return '#EAB308';
    case 'low':
      return '#22C55E';
    default:
      return '#6B7280';
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  headerSpinner: {
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginLeft: 12,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  fallbackBadge: {
    backgroundColor: '#78350F',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  fallbackText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '600',
  },
  responseContainer: {
    maxHeight: 400,
  },
  responseContent: {
    padding: 16,
  },
  responseText: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 22,
  },
  cursor: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  inferenceTime: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 12,
    fontStyle: 'italic',
  },
  triageContainer: {
    gap: 16,
  },
  severityBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  guidanceBox: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guidanceIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  guidanceText: {
    flex: 1,
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  checklistBullet: {
    color: '#3B82F6',
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  checklistText: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
  },
  resourceTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resourceTag: {
    backgroundColor: '#374151',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resourceTagText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  escalationNotice: {
    backgroundColor: '#78350F',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  escalationText: {
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '600',
  },
  followUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    backgroundColor: '#111827',
  },
  followUpInput: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    color: '#E5E7EB',
    fontSize: 14,
    marginRight: 8,
  },
  followUpButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  followUpButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
