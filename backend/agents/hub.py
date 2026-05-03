"""
Decision Hub Orchestrator: Coordinates all 5 agents
Implements consensus-driven crisis response pipeline
"""

from typing import Dict
import time
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from backend.agents.verification_agent import VerificationAgent
from backend.agents.assessment_agent import AssessmentAgent
from backend.agents.allocation_agent import AllocationAgent
from backend.agents.communication_agent import CommunicationAgent
from backend.agents.accountability_agent import AccountabilityAgent

logger = logging.getLogger("crisisnet.hub")

def run_decision_hub(crisis_event: Dict, firestore_client=None) -> Dict:
    """
    Run complete 5-agent decision pipeline
    
    Pipeline:
    1. Verification Agent (if false_alarm_probability > 0.8, short-circuit)
    2. Assessment Agent
    3. Allocation Agent (depends on Assessment)
    4. Communication Agent (parallel with Accountability)
    5. Accountability Agent (captures full pipeline)
    
    Args:
        crisis_event: {
            event_id, location, crisis_type, reported_casualties,
            reporter_id, description (optional)
        }
        firestore_client: Firestore client instance (optional)
        
    Returns:
        Consolidated hub response with all agent outputs
    """
    start_time = time.time()
    agent_timings = {}
    
    # Validate input
    required_fields = ['event_id', 'location', 'crisis_type', 'reported_casualties', 'reporter_id']
    missing = [f for f in required_fields if f not in crisis_event]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")
    
    logger.info(f"Processing crisis event: {crisis_event['event_id']}")
    
    # Initialize agents
    verification_agent = VerificationAgent(firestore_client)
    assessment_agent = AssessmentAgent()
    allocation_agent = AllocationAgent(firestore_client)
    communication_agent = CommunicationAgent()
    accountability_agent = AccountabilityAgent(firestore_client)
    
    try:
        # STEP 1: Verification Agent (runs first)
        logger.info("Step 1: Running Verification Agent")
        verification_output, verification_ms = verification_agent.run_with_timing({
            'location': crisis_event['location'],
            'reporter_id': crisis_event['reporter_id'],
            'crisis_type': crisis_event['crisis_type'],
            'description': crisis_event.get('description', '')
        })
        agent_timings['verification'] = verification_ms
        
        # Short-circuit if high false alarm probability
        if verification_output['false_alarm_probability'] > 0.8:
            total_pipeline_ms = int((time.time() - start_time) * 1000)
            logger.warning(f"Short-circuit: False alarm probability {verification_output['false_alarm_probability']}")
            
            return {
                "status": "REJECTED_FALSE_ALARM",
                "event_id": crisis_event['event_id'],
                "verification": verification_output,
                "total_pipeline_ms": total_pipeline_ms,
                "reason": f"False alarm probability: {verification_output['false_alarm_probability']:.2f}"
            }
        
        # STEP 2: Assessment Agent
        logger.info("Step 2: Running Assessment Agent")
        assessment_output, assessment_ms = assessment_agent.run_with_timing({
            'crisis_type': crisis_event['crisis_type'],
            'reported_casualties': crisis_event['reported_casualties'],
            'description': crisis_event.get('description', ''),
            'location': crisis_event['location']
        })
        agent_timings['assessment'] = assessment_ms
        
        # STEP 3: Allocation Agent (depends on Assessment)
        logger.info("Step 3: Running Allocation Agent")
        allocation_output, allocation_ms = allocation_agent.run_with_timing({
            'assessment': assessment_output,
            'location': crisis_event['location'],
            'event_id': crisis_event['event_id']
        })
        agent_timings['allocation'] = allocation_ms
        
        # STEP 4 & 5: Communication and Accountability in parallel
        logger.info("Step 4-5: Running Communication and Accountability in parallel")
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            # Submit Communication Agent
            comm_future = executor.submit(
                communication_agent.run_with_timing,
                {
                    'assessment': assessment_output,
                    'allocation': allocation_output,
                    'location': crisis_event.get('location', 'Unknown')
                }
            )
            
            # Calculate total pipeline time so far for Accountability
            current_pipeline_ms = int((time.time() - start_time) * 1000)
            
            # Submit Accountability Agent
            accountability_future = executor.submit(
                accountability_agent.run_with_timing,
                {
                    'event_id': crisis_event['event_id'],
                    'verification': verification_output,
                    'assessment': assessment_output,
                    'allocation': allocation_output,
                    'total_pipeline_ms': current_pipeline_ms,
                    'agent_timings': agent_timings
                }
            )
            
            # Wait for both with timeout
            try:
                communication_output, communication_ms = comm_future.result(timeout=10)
                agent_timings['communication'] = communication_ms
            except FuturesTimeoutError:
                logger.error("Communication Agent timeout")
                communication_output = {
                    "error": "timeout",
                    "coordinator_alert": "Communication generation failed",
                    "public_alert": "Emergency response in progress",
                    "sms_alert": "Help on the way",
                    "language": "en",
                    "urgency_level": "URGENT"
                }
                agent_timings['communication'] = 10000
            
            try:
                # Update accountability with communication output
                accountability_input = accountability_future.result(timeout=10)
                
                # Re-run accountability with communication included
                accountability_output, accountability_ms = accountability_agent.run_with_timing({
                    'event_id': crisis_event['event_id'],
                    'verification': verification_output,
                    'assessment': assessment_output,
                    'allocation': allocation_output,
                    'communication': communication_output,
                    'total_pipeline_ms': int((time.time() - start_time) * 1000),
                    'agent_timings': agent_timings
                })
                agent_timings['accountability'] = accountability_ms
                
            except FuturesTimeoutError:
                logger.error("Accountability Agent timeout")
                accountability_output = {
                    "audit_id": "TIMEOUT",
                    "decision_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "total_pipeline_ms": int((time.time() - start_time) * 1000),
                    "sla_met": False,
                    "sla_threshold_ms": 300000,
                    "agents_consensus": False,
                    "flagged_for_review": True,
                    "flag_reason": "ACCOUNTABILITY_TIMEOUT"
                }
                agent_timings['accountability'] = 10000
        
        # Calculate final pipeline time
        total_pipeline_ms = int((time.time() - start_time) * 1000)
        
        # Build consolidated response
        response = {
            "status": "PROCESSED",
            "event_id": crisis_event['event_id'],
            "verification": verification_output,
            "assessment": assessment_output,
            "allocation": allocation_output,
            "communication": communication_output,
            "accountability": accountability_output,
            "total_pipeline_ms": total_pipeline_ms,
            "agent_timings": agent_timings
        }
        
        logger.info(f"Pipeline complete: {total_pipeline_ms}ms, SLA met: {accountability_output['sla_met']}")
        
        return response
        
    except Exception as e:
        total_pipeline_ms = int((time.time() - start_time) * 1000)
        logger.error(f"Pipeline failed after {total_pipeline_ms}ms: {str(e)}")
        
        return {
            "status": "ERROR",
            "event_id": crisis_event['event_id'],
            "error": str(e),
            "total_pipeline_ms": total_pipeline_ms,
            "agent_timings": agent_timings
        }
