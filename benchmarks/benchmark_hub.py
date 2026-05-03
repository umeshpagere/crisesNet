# _REPO_ROOT_BOOTSTRAP_
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

#!/usr/bin/env python3
"""
CrisisNet Phase 2: Hub Latency Benchmark
Measures pipeline performance with mocked agents
"""

import time
import json
from backend.agents.hub import run_decision_hub

def run_benchmark():
    """Run hub benchmark test"""
    
    event = {
        'event_id': 'bench-001',
        'location': {'lat': 19.99, 'lng': 73.78},
        'crisis_type': 'flood',
        'reported_casualties': 25,
        'reporter_id': 'user-123',
        'description': 'Flash flood near bridge'
    }
    
    print("="*60)
    print("CrisisNet Phase 2: Hub Benchmark")
    print("="*60)
    print(f"Event ID: {event['event_id']}")
    print(f"Crisis Type: {event['crisis_type']}")
    print(f"Casualties: {event['reported_casualties']}")
    print("="*60)
    
    start = time.time()
    result = run_decision_hub(event, firestore_client=None)
    elapsed_ms = int((time.time() - start) * 1000)
    
    print(f"\n✅ Pipeline Complete")
    print(f"Total Time: {elapsed_ms}ms")
    print(f"Status: {result['status']}")
    
    if result['status'] == 'PROCESSED':
        print(f"\nAgent Timings:")
        for agent, timing in result.get('agent_timings', {}).items():
            print(f"  {agent}: {timing}ms")
        
        print(f"\nAccountability:")
        acc = result['accountability']
        print(f"  SLA Met: {acc['sla_met']}")
        print(f"  SLA Threshold: {acc['sla_threshold_ms']}ms")
        print(f"  Consensus: {acc['agents_consensus']}")
        print(f"  Flagged: {acc['flagged_for_review']}")
        
        print(f"\nVerification:")
        ver = result['verification']
        print(f"  Verified: {ver['verified']}")
        print(f"  Confidence: {ver['confidence']}")
        print(f"  False Alarm Prob: {ver['false_alarm_probability']}")
        
        print(f"\nAssessment:")
        assess = result['assessment']
        print(f"  Severity: {assess['severity_score']}")
        print(f"  Tier: {assess['recommended_response_tier']}")
        print(f"  Confidence: {assess['confidence']}")
        
        print(f"\nAllocation:")
        alloc = result['allocation']
        print(f"  Resources Dispatched: {alloc['total_resources_dispatched']}")
        print(f"  Optimization Score: {alloc['optimization_score']}")
        
        print(f"\nCommunication:")
        comm = result['communication']
        print(f"  Urgency: {comm['urgency_level']}")
        print(f"  SMS Length: {len(comm['sms_alert'])} chars")
    
    print("\n" + "="*60)
    print("Benchmark Results:")
    print("="*60)
    print(f"Pipeline Time: {elapsed_ms}ms")
    
    # Check against targets
    if elapsed_ms < 5000:
        print(f"✅ PASS: Under 5s target (mocked)")
    elif elapsed_ms < 15000:
        print(f"✅ PASS: Under 15s target (live)")
    else:
        print(f"❌ FAIL: Exceeded 15s target")
    
    if result.get('accountability', {}).get('sla_met'):
        print(f"✅ PASS: SLA met (< 5 min)")
    else:
        print(f"❌ FAIL: SLA breach")
    
    print("="*60)
    
    return result

if __name__ == '__main__':
    result = run_benchmark()
