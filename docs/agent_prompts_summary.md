# CrisisNet Agent Prompts Summary

## Overview

This document summarizes the 5 specialized AI agents designed for CrisisNet Phase 1: Multi-Agent Decision Hub.

**Total Estimated Cost per Crisis**: $0.00071 (~$0.71 per 1000 crises)  
**Target Total Response Time**: 4.4 seconds  
**Model**: Vertex AI Gemini 2.0 Flash Exp

---

## Agent Architecture

```
CRISIS REPORT
     ↓
[Assessment Agent] → Severity (1-10), Resource Needs (500ms, $0.0001)
     ↓
[Verification Agent] → Confidence Score, False Alarm Detection (1s, $0.00015)
     ↓
[Allocation Agent] → Optimal Resource Deployment (1.5s, $0.0002)
     ↓
[Communication Agent] → Multi-Channel Alerts (800ms, $0.00012)
     ↓
[Accountability Agent] → Impact Tracking, Audit Trail (600ms, $0.00014)
     ↓
CONSENSUS VOTING → 4/5 approval for CRITICAL decisions
```

---

## 1. Assessment Agent

**Purpose**: Parse crisis reports and estimate severity

**Key Parameters**:
- Temperature: 0.3 (low for consistency)
- Max Tokens: 500
- Target Response: 500ms

**Responsibilities**:
1. Parse location, description, source type
2. Score severity (1-10 scale)
3. Estimate affected population
4. Identify resource needs (boats, medical, etc.)
5. Provide confidence score

**Severity Guidelines**:
- **10**: Mass casualty (100+ lives at risk)
- **9**: Critical rescue (10-100 lives, water/fire hazard)
- **8**: Major disaster (infrastructure collapse, 50+ people)
- **7**: Serious incident (medical emergency, 10-50 people)
- **6**: Moderate emergency (property damage, <10 people)
- **1-5**: Low priority or false alarm

**Output Format**:
```json
{
  "severity_score": 9,
  "estimated_affected": 8,
  "resource_needs": {"boats": 2, "medical": 1},
  "confidence": 0.85,
  "reasoning": "Water rescue with multiple missing persons...",
  "flags": []
}
```

**Hallucination Prevention**:
- Never invent details not in input
- Conservative estimates preferred
- Lower confidence if information missing
- Flag vague reports

**Few-Shot Examples**: 5 diverse scenarios (boat rescue, flooding, false alarm, building collapse, landslide)

---

## 2. Verification Agent

**Purpose**: Validate assessments and detect false alarms

**Key Parameters**:
- Temperature: 0.2 (very low for accuracy)
- Max Tokens: 800
- Target Response: 1000ms

**Responsibilities**:
1. Cross-check against data sources
2. Calculate confidence based on source credibility
3. Detect false alarm patterns
4. Flag inconsistencies

**Source Credibility Weights**:
- Government alerts: 0.95
- Emergency calls: 0.90
- Police reports: 0.85
- Citizen reports: 0.60
- Social media: 0.30

**Verification Rules**:
- HIGH confidence (>0.80): Requires 2+ sources
- MEDIUM confidence (0.70-0.80): Single government source
- LOW confidence (0.40-0.60): Single citizen report
- VERY LOW (<0.40): Social media only

**False Alarm Indicators**:
- Vague descriptions
- Unverified social media only
- Location history of false reports
- Conflicting information
- Time inconsistencies (>24 hours old)

**Output Format**:
```json
{
  "verified": true,
  "confidence_score": 0.65,
  "false_alarm_risk": "MEDIUM",
  "verification_sources": ["citizen_report"],
  "reasoning": "Single citizen report with specific details...",
  "recommendations": ["Request coast guard verification"]
}
```

**Few-Shot Examples**: 3 scenarios (citizen report, government alert, social media false alarm)

---

## 3. Allocation Agent

**Purpose**: Optimize resource deployment using OR-Tools principles

**Key Parameters**:
- Temperature: 0.1 (deterministic)
- Max Tokens: 1000
- Target Response: 1500ms

**Responsibilities**:
1. Review verified crisis and needs
2. Check available resource pool
3. Calculate optimal assignments
4. Plan routes to minimize response time
5. Ensure 95%+ coverage

**Allocation Principles**:
- Prioritize by severity (10 > 9 > 8...)
- Minimize total travel time
- Never over-allocate
- Reserve 20% capacity for new emergencies
- Prefer nearby resources

**Resource Constraints**:
- Boat: 10 people per trip
- Medical unit: 20 people capacity
- Evacuation vehicle: 30 people
- Travel time: distance_km / 60 (60 km/h average)

**Coverage Calculation**:
```
coverage_percentage = (allocated_capacity / estimated_affected) * 100
Target: 95%+
```

**Output Format**:
```json
{
  "assigned_resources": [
    {
      "resource_id": "BOAT_002",
      "resource_type": "boat",
      "quantity": 1,
      "estimated_eta_minutes": 5,
      "route": "Direct to crisis location (3km)"
    }
  ],
  "coverage_percentage": 100,
  "total_capacity": 10,
  "unmet_needs": {},
  "reasoning": "BOAT_002 is closest...",
  "optimization_score": 0.95
}
```

**Few-Shot Examples**: 2 scenarios (sufficient resources, insufficient resources)

---

## 4. Communication Agent

**Purpose**: Draft multi-channel crisis alerts

**Key Parameters**:
- Temperature: 0.4 (higher for natural language)
- Max Tokens: 600
- Target Response: 800ms

**Responsibilities**:
1. Review crisis and allocation plan
2. Draft channel-specific messages
3. Tailor language for audience
4. Keep messages short and actionable
5. Avoid panic-inducing language

**Channel Guidelines**:

| Channel | Max Length | Purpose | Example |
|---------|-----------|---------|---------|
| **SMS** | 160 chars | Ultra-concise critical info | "FLOOD ALERT: Dharavi. Evacuate NOW. Boats in 10 min." |
| **WhatsApp** | 500 chars | More detail + contact info | "🚨 FLOOD ALERT\nLocation: Dharavi\nAction: Evacuate..." |
| **Push** | 100 chars | Attention-grabbing headline | "🚨 FLOOD: Evacuate Dharavi NOW. Tap for details." |
| **Radio** | 300 chars | Formal, calm, repeat key info | "This is an emergency broadcast from Mumbai..." |

**Tone Guidelines**:
- ✅ URGENT but not panic-inducing
- ✅ CLEAR and actionable
- ✅ AUTHORITATIVE and trustworthy
- ✅ EMPATHETIC but professional

**Avoid**:
- ❌ Panic words ("DANGER", "DEATH")
- ❌ Vague instructions ("Be careful")
- ❌ Technical jargon
- ❌ Excessive punctuation (!!!)

**Output Format**:
```json
{
  "sms": "<160 char message>",
  "whatsapp": "<500 char message>",
  "push_notification": "<100 char message>",
  "radio_broadcast": "<300 char message>",
  "target_audience": "Coastal residents, fishermen",
  "estimated_reach": 5000,
  "priority_level": "CRITICAL"
}
```

**Few-Shot Examples**: 2 scenarios (boat rescue, mass evacuation)

---

## 5. Accountability Agent

**Purpose**: Track deployment and measure impact for NGO auditing

**Key Parameters**:
- Temperature: 0.2
- Max Tokens: 700
- Target Response: 600ms

**Responsibilities**:
1. Track deployment status
2. Measure impact (people rescued, lives saved)
3. Calculate efficiency metrics
4. Flag resource shortages/delays
5. Generate audit-ready reports

**Deployment Statuses**:
- DISPATCHED → EN_ROUTE → ON_SITE → ACTIVE → COMPLETED/FAILED

**Impact Metrics**:
- People rescued / affected (coverage %)
- Response time (dispatch to on-site)
- Resource utilization (used / allocated)
- Lives saved (estimated)
- Cost per person rescued

**Efficiency Calculation**:
```
efficiency_score = (people_rescued / estimated_affected) * (1 / response_time_minutes) * 100
Target: >80
```

**Audit Requirements**:
- Log every resource movement with timestamp
- Record all decisions with agent votes
- Track costs (fuel, personnel, equipment)
- Document failures and reasons
- Measure against SLA (5-minute target)

**Output Format**:
```json
{
  "deployment_status": {
    "BOAT_002": {
      "status": "COMPLETED",
      "dispatched_at": "2026-04-25T14:30:00Z",
      "arrived_at": "2026-04-25T14:35:00Z",
      "completed_at": "2026-04-25T14:50:00Z"
    }
  },
  "impact_metrics": {
    "people_rescued": 8,
    "coverage_percentage": 100,
    "response_time_minutes": 5,
    "efficiency_score": 95
  },
  "resource_usage": {
    "boat": {"allocated": 1, "used": 1, "utilization_percentage": 100}
  },
  "issues_flagged": [],
  "audit_trail": "CRISIS_001: Boat rescue completed...",
  "recommendations": ["Implement real-time GPS tracking"]
}
```

**Few-Shot Examples**: 2 scenarios (successful rescue, partial rescue with issues)

---

## Consensus Voting Mechanism

All 5 agents vote on critical decisions:

| Decision Type | Approval Threshold | Example |
|--------------|-------------------|---------|
| **CRITICAL** | 4/5 agents | Mass evacuation, rescue deployment |
| **HIGH** | 3/5 agents | Resource allocation changes |
| **NORMAL** | 2/5 agents | Alert timing adjustments |

**Vote Format**:
```json
{
  "agent_name": "assessment_agent",
  "vote": "APPROVE",
  "confidence": 0.85,
  "reasoning": "Multiple people missing + water hazard = high severity"
}
```

---

## Hallucination Prevention Strategy

All agents follow strict guidelines:

1. **Never invent data** not in the input
2. **Conservative estimates** preferred over optimistic
3. **Explicit uncertainty** when information is missing
4. **Flag ambiguities** rather than guess
5. **Structured output** enforced (JSON only, no markdown)
6. **Low temperature** for factual agents (0.1-0.3)
7. **Few-shot examples** demonstrate correct behavior

---

## Token Budget & Cost Optimization

| Agent | Max Tokens | Est. Cost | % of Total |
|-------|-----------|-----------|------------|
| Assessment | 500 | $0.0001 | 14% |
| Verification | 800 | $0.00015 | 21% |
| Allocation | 1000 | $0.0002 | 28% |
| Communication | 600 | $0.00012 | 17% |
| Accountability | 700 | $0.00014 | 20% |
| **TOTAL** | **3600** | **$0.00071** | **100%** |

**Cost Projections**:
- 1,000 crises/month: $0.71
- 10,000 crises/month: $7.10
- 100,000 crises/month: $71.00

**Optimization Opportunities**:
- Reduce token limits if agents consistently under-use
- Cache common patterns (location data, resource pools)
- Batch non-urgent requests
- Use cheaper models for low-severity crises

---

## Next Steps

1. ✅ **Prompts designed** (this document)
2. ⏳ **Set up prompt governance** (versioning, A/B testing)
3. ⏳ **Integrate with Flask API** (7 endpoints)
4. ⏳ **Connect to Vertex AI** (Gemini 2.0 Flash)
5. ⏳ **Implement Pub/Sub messaging** (inter-agent communication)
6. ⏳ **Create Firestore schema** (decision logging)
7. ⏳ **Write tests** (20+ test cases)
8. ⏳ **Run benchmarks** (5 crisis simulations)
9. ⏳ **Deploy to Cloud Run**
10. ⏳ **Self-evaluate** (target: 80+ score)

---

## Files Generated

- `agent_prompts.yaml` - Full prompt specifications with examples
- `agent_prompts_summary.md` - This document
- Next: `prompt_governance.md` - Versioning and evaluation strategy
