"""
Accountability Agent: Immutable audit trail and SLA compliance tracking
Logs all decisions to Firestore with no update/delete capability
"""

from typing import Dict
from backend.agents.base_agent import BaseAgent
import uuid
from datetime import datetime
import os

class AccountabilityAgent(BaseAgent):
    """Agent 4: Accountability - Audit trail and SLA tracking"""
    
    def __init__(self, firestore_client=None):
        super().__init__("accountability", timeout_seconds=10)
        self.db = firestore_client
        self.sla_threshold_ms = int(os.getenv('SLA_THRESHOLD_MS', '300000'))  # 5 min
    
    def run(self, input_data: Dict) -> Dict:
        """
        Create immutable audit log entry
        
        Input:
            - event_id: string
            - verification: verification agent output
            - assessment: assessment agent output
            - allocation: allocation agent output
            - communication: communication agent output
            - total_pipeline_ms: int
            - agent_timings: {agent_name: ms}
            
        Output:
            - audit_id: uuid
            - decision_timestamp: ISO8601
            - total_pipeline_ms: int
            - sla_met: bool
            - sla_threshold_ms: int
            - agents_consensus: bool
            - flagged_for_review: bool
            - flag_reason: string|null
        """
        self.validate_input(input_data, [
            'event_id',
            'verification',
            'assessment',
            'total_pipeline_ms'
        ])
        
        # Generate audit ID
        audit_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + 'Z'
        
        # Check SLA compliance
        total_pipeline_ms = input_data['total_pipeline_ms']
        sla_met = total_pipeline_ms <= self.sla_threshold_ms
        
        # Check agent consensus
        verification = input_data['verification']
        assessment = input_data['assessment']
        
        agents_consensus = self._check_consensus(verification, assessment)
        
        # Determine if flagged for review
        flagged, flag_reason = self._check_flags(
            sla_met,
            agents_consensus,
            verification,
            assessment,
            input_data.get('allocation', {})
        )
        
        # Create audit log entry
        audit_entry = {
            "audit_id": audit_id,
            "event_id": input_data['event_id'],
            "decision_timestamp": timestamp,
            "total_pipeline_ms": total_pipeline_ms,
            "sla_met": sla_met,
            "sla_threshold_ms": self.sla_threshold_ms,
            "agents_consensus": agents_consensus,
            "flagged_for_review": flagged,
            "flag_reason": flag_reason,
            "agent_outputs": {
                "verification": verification,
                "assessment": assessment,
                "allocation": input_data.get('allocation', {}),
                "communication": input_data.get('communication', {})
            },
            "agent_timings": input_data.get('agent_timings', {}),
            "created_at": timestamp
        }
        
        # Write to Firestore (immutable - use set(), not update())
        if self.db is not None:
            try:
                self.db.collection('audit_log').document(audit_id).set(audit_entry)
                self.logger.info(f"Audit log created: {audit_id}")
            except Exception as e:
                self.logger.error(f"Failed to write audit log: {e}")
        
        # Return summary
        return {
            "audit_id": audit_id,
            "decision_timestamp": timestamp,
            "total_pipeline_ms": total_pipeline_ms,
            "sla_met": sla_met,
            "sla_threshold_ms": self.sla_threshold_ms,
            "agents_consensus": agents_consensus,
            "flagged_for_review": flagged,
            "flag_reason": flag_reason
        }
    
    def _check_consensus(
        self,
        verification: Dict,
        assessment: Dict
    ) -> bool:
        """
        Check if agents agree on crisis validity
        
        Consensus fails if:
        - Assessment confidence < 0.4 AND Verification confidence < 0.5
        """
        assessment_conf = assessment.get('confidence', 1.0)
        verification_conf = verification.get('confidence', 1.0)
        
        if assessment_conf < 0.4 and verification_conf < 0.5:
            return False
        
        return True
    
    def _check_flags(
        self,
        sla_met: bool,
        agents_consensus: bool,
        verification: Dict,
        assessment: Dict,
        allocation: Dict
    ) -> tuple:
        """
        Determine if decision should be flagged for human review
        
        Flag conditions:
        - SLA breach (> 5 min)
        - Agents disagree
        - High false alarm probability (> 0.7)
        - Resource shortage
        - Critical severity with low confidence
        
        Returns: (flagged: bool, reason: str|None)
        """
        reasons = []
        
        # SLA breach
        if not sla_met:
            reasons.append("SLA_BREACH")
        
        # Consensus failure
        if not agents_consensus:
            reasons.append("CONSENSUS_FAILURE")
        
        # High false alarm risk
        if verification.get('false_alarm_probability', 0) > 0.7:
            reasons.append("HIGH_FALSE_ALARM_RISK")
        
        # Resource shortage
        if allocation.get('status') == 'RESOURCE_SHORTAGE':
            reasons.append("RESOURCE_SHORTAGE")
        
        # Critical severity with low confidence
        severity = assessment.get('severity_score', 0)
        confidence = assessment.get('confidence', 1.0)
        if severity >= 0.8 and confidence < 0.6:
            reasons.append("CRITICAL_LOW_CONFIDENCE")
        
        if reasons:
            return True, " | ".join(reasons)
        
        return False, None
