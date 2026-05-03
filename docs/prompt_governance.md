# CrisisNet Prompt Governance Framework

**Version**: 1.0.0  
**Last Updated**: 2026-04-27  
**Owner**: CrisisNet Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [Prompt Versioning Strategy](#prompt-versioning-strategy)
3. [A/B Testing Framework](#ab-testing-framework)
4. [Evaluation Metrics](#evaluation-metrics)
5. [Approval Workflow](#approval-workflow)
6. [Prompt Registry](#prompt-registry)
7. [Rollback Procedures](#rollback-procedures)
8. [Cost Monitoring](#cost-monitoring)

---

## Overview

This document defines how CrisisNet manages, versions, tests, and deploys AI agent prompts in production.

**Why Prompt Governance Matters**:
- Bad prompts = agent hallucination, false alarms, failed rescues
- Untracked changes = no rollback capability
- No A/B testing = can't measure improvements
- No cost monitoring = budget overruns

**Key Principles**:
1. **Never deploy untested prompts** to production
2. **Version every change** with semantic versioning
3. **A/B test significant changes** before full rollout
4. **Monitor costs and performance** continuously
5. **Require approval** for critical agent changes

---

## Prompt Versioning Strategy

### Semantic Versioning (SemVer)

Format: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

- **MAJOR**: Breaking changes (output format changes, new required fields)
- **MINOR**: New features (additional examples, improved reasoning)
- **PATCH**: Bug fixes (typo corrections, clarity improvements)

**Examples**:
- `1.0.0` → `1.0.1`: Fixed typo in Assessment Agent severity guidelines (PATCH)
- `1.0.1` → `1.1.0`: Added 2 new few-shot examples to Verification Agent (MINOR)
- `1.1.0` → `2.0.0`: Changed Allocation Agent output format from array to object (MAJOR)

### Version Control

**Storage**: All prompts stored in `docs/agent_prompts.yaml` with Git version control

**Branching Strategy**:
```
main (production)
  ↑
  └── release/v1.1.0 (staging)
        ↑
        └── feature/improve-assessment-agent (development)
```

**Commit Message Format**:
```
[AGENT_NAME] [VERSION] Brief description

- Detailed change 1
- Detailed change 2

Impact: <performance/cost/accuracy>
Tested: <yes/no>
```

**Example**:
```
[ASSESSMENT] v1.0.1 Fix severity scoring for landslides

- Updated severity guidelines to score landslides as 9-10 (was 7-8)
- Added landslide example to few-shot set
- Clarified "mass evacuation" trigger criteria

Impact: +15% accuracy on landslide scenarios
Tested: Yes (5 test cases, all passed)
```

### File Structure

```
docs/
├── agent_prompts.yaml              # Current production version
├── agent_prompts_v1.0.0.yaml       # Historical version (backup)
├── agent_prompts_v1.1.0.yaml       # Candidate version (staging)
└── prompt_changelog.md             # Human-readable change log
```

---

## A/B Testing Framework

### When to A/B Test

**Always test**:
- Major version changes (v1.x → v2.x)
- Changes to core logic (severity scoring, resource allocation)
- New few-shot examples
- Temperature/token limit adjustments

**Skip testing** (fast-track):
- Typo fixes
- Formatting improvements
- Documentation updates

### A/B Test Setup

**Traffic Split**: 50/50 between Control (old) and Treatment (new)

**Sample Size**: Minimum 100 crises per variant (200 total)

**Duration**: 24-48 hours or until statistical significance reached

**Configuration**:
```yaml
ab_test:
  test_id: "assessment_v1.1.0_landslide_fix"
  agent: "assessment_agent"
  control_version: "1.0.0"
  treatment_version: "1.1.0"
  traffic_split: 0.5
  start_date: "2026-04-27T00:00:00Z"
  end_date: "2026-04-28T23:59:59Z"
  success_metrics:
    - accuracy
    - false_alarm_rate
    - response_time
  target_improvement: 10%  # Treatment must be 10% better
```

### Traffic Routing Logic

```python
def get_prompt_version(agent_name: str, crisis_id: str) -> str:
    """Route crisis to control or treatment prompt based on A/B test config."""
    
    ab_test = get_active_ab_test(agent_name)
    
    if not ab_test:
        return get_production_version(agent_name)
    
    # Deterministic routing based on crisis_id hash
    if hash(crisis_id) % 100 < (ab_test.traffic_split * 100):
        return ab_test.treatment_version
    else:
        return ab_test.control_version
```

### A/B Test Results Format

```json
{
  "test_id": "assessment_v1.1.0_landslide_fix",
  "agent": "assessment_agent",
  "duration_hours": 48,
  "total_crises": 234,
  "control": {
    "version": "1.0.0",
    "crises_processed": 117,
    "accuracy": 0.82,
    "false_alarm_rate": 0.08,
    "avg_response_time_ms": 485,
    "avg_cost_usd": 0.00011
  },
  "treatment": {
    "version": "1.1.0",
    "crises_processed": 117,
    "accuracy": 0.91,
    "false_alarm_rate": 0.04,
    "avg_response_time_ms": 492,
    "avg_cost_usd": 0.00012
  },
  "statistical_significance": {
    "accuracy": {"p_value": 0.003, "significant": true},
    "false_alarm_rate": {"p_value": 0.012, "significant": true},
    "response_time": {"p_value": 0.45, "significant": false}
  },
  "recommendation": "DEPLOY_TREATMENT",
  "reasoning": "Treatment improves accuracy by 11% and reduces false alarms by 50%. Slight cost increase ($0.00001) is acceptable."
}
```

---

## Evaluation Metrics

### Per-Agent Metrics

| Agent | Primary Metric | Secondary Metrics | Target |
|-------|---------------|-------------------|--------|
| **Assessment** | Severity accuracy | False alarm rate, Response time | >85% accuracy |
| **Verification** | False alarm detection | Confidence calibration | <5% false alarms |
| **Allocation** | Coverage percentage | Optimization score, ETA accuracy | >95% coverage |
| **Communication** | Message clarity | Character count, Readability | >90% clarity |
| **Accountability** | Audit completeness | Efficiency score, Issue detection | 100% completeness |

### System-Wide Metrics

**Performance**:
- Total response time (all 5 agents): <5 seconds
- Individual agent response time: <2 seconds
- 99th percentile latency: <10 seconds

**Accuracy**:
- End-to-end accuracy (crisis → correct decision): >80%
- False alarm rate: <5%
- Resource allocation efficiency: >90%

**Cost**:
- Cost per crisis: <$0.001
- Monthly budget: <$100 (for 100k crises)
- Cost per person rescued: <$0.10

**Reliability**:
- Agent availability: >99.9%
- Consensus voting success rate: >95%
- Audit trail completeness: 100%

### Evaluation Dataset

**Benchmark Scenarios** (5 required):
1. River Rescue: Boat capsized, 8 missing
2. Urban Flood: 200 stranded, 3 villages
3. False Alarm: Unconfirmed social media report
4. Landslide: 1000 at risk, mass evacuation
5. Multi-Crisis: 3 simultaneous events

**Ground Truth Labels**:
```json
{
  "scenario_id": "river_rescue_001",
  "expected_severity": 9,
  "expected_resources": {"boats": 2, "medical": 1},
  "expected_verification": true,
  "expected_confidence": 0.85,
  "expected_coverage": 100,
  "expected_false_alarm": false
}
```

**Evaluation Script**:
```bash
# Run evaluation on all 5 agents
python scripts/evaluate_agents.py \
  --scenarios benchmarks/scenarios.json \
  --prompts docs/agent_prompts.yaml \
  --output results/evaluation_report.json

# Compare two prompt versions
python scripts/evaluate_agents.py \
  --scenarios benchmarks/scenarios.json \
  --control-prompts docs/agent_prompts_v1.0.0.yaml \
  --treatment-prompts docs/agent_prompts_v1.1.0.yaml \
  --output results/ab_test_report.json
```

---

## Approval Workflow

### Change Request Process

1. **Developer** creates feature branch and updates prompts
2. **Developer** runs local evaluation (5 benchmark scenarios)
3. **Developer** creates Pull Request with:
   - Version bump (SemVer)
   - Changelog entry
   - Evaluation results
   - Cost impact analysis
4. **Reviewer** (Senior Engineer) reviews:
   - Prompt quality (clarity, hallucination prevention)
   - Few-shot examples (diversity, correctness)
   - Evaluation results (meets targets)
   - Cost impact (acceptable)
5. **Reviewer** approves or requests changes
6. **CI/CD** runs automated tests (20+ test cases)
7. **Staging Deployment** (A/B test for 24-48 hours)
8. **Product Owner** reviews A/B test results
9. **Production Deployment** (if A/B test successful)

### Approval Matrix

| Change Type | Approver | A/B Test Required | Min Sample Size |
|-------------|----------|-------------------|-----------------|
| PATCH (typo fix) | Any Engineer | No | N/A |
| MINOR (new examples) | Senior Engineer | Yes | 100 crises |
| MAJOR (format change) | Engineering Lead + Product Owner | Yes | 500 crises |
| CRITICAL (safety-related) | Engineering Lead + Product Owner + Legal | Yes | 1000 crises |

### Emergency Rollback Authority

**Who can rollback**:
- Engineering Lead (any time)
- On-call Engineer (if production incident)
- Product Owner (if safety issue)

**Rollback triggers**:
- False alarm rate >10%
- Agent response time >5 seconds
- Cost per crisis >$0.002
- Any safety-critical failure

---

## Prompt Registry

### Registry Schema

```yaml
prompt_registry:
  assessment_agent:
    current_version: "1.0.0"
    production_file: "docs/agent_prompts.yaml"
    versions:
      - version: "1.0.0"
        deployed_at: "2026-04-27T00:00:00Z"
        git_commit: "abc123def"
        performance:
          accuracy: 0.85
          false_alarm_rate: 0.05
          avg_response_time_ms: 485
          avg_cost_usd: 0.00011
        status: "ACTIVE"
      - version: "0.9.0"
        deployed_at: "2026-04-20T00:00:00Z"
        git_commit: "xyz789ghi"
        performance:
          accuracy: 0.78
          false_alarm_rate: 0.12
          avg_response_time_ms: 520
          avg_cost_usd: 0.00013
        status: "DEPRECATED"
        rollback_available: true
```

### Registry Operations

**View current versions**:
```bash
python scripts/prompt_registry.py list
```

**Deploy new version**:
```bash
python scripts/prompt_registry.py deploy \
  --agent assessment_agent \
  --version 1.1.0 \
  --file docs/agent_prompts_v1.1.0.yaml
```

**Rollback to previous version**:
```bash
python scripts/prompt_registry.py rollback \
  --agent assessment_agent \
  --to-version 1.0.0
```

---

## Rollback Procedures

### Automatic Rollback Triggers

**Circuit Breaker Pattern**:
```python
def check_agent_health(agent_name: str, window_minutes: int = 5):
    """Monitor agent performance and trigger rollback if degraded."""
    
    metrics = get_recent_metrics(agent_name, window_minutes)
    
    # Trigger rollback if any threshold exceeded
    if metrics.false_alarm_rate > 0.10:
        trigger_rollback(agent_name, reason="High false alarm rate")
    
    if metrics.avg_response_time_ms > 2000:
        trigger_rollback(agent_name, reason="Slow response time")
    
    if metrics.error_rate > 0.05:
        trigger_rollback(agent_name, reason="High error rate")
```

### Manual Rollback Steps

1. **Identify issue** (monitoring alert or user report)
2. **Check rollback availability** in prompt registry
3. **Execute rollback**:
   ```bash
   python scripts/prompt_registry.py rollback \
     --agent <agent_name> \
     --to-version <previous_version>
   ```
4. **Verify rollback** (run smoke tests)
5. **Notify team** (Slack, email)
6. **Create incident report** (root cause analysis)

### Rollback SLA

- **Detection to rollback**: <5 minutes
- **Rollback to verification**: <2 minutes
- **Total downtime**: <10 minutes

---

## Cost Monitoring

### Cost Tracking

**Per-Agent Cost**:
```python
def calculate_agent_cost(agent_name: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost for a single agent call."""
    
    # Gemini 2.0 Flash pricing (example)
    INPUT_COST_PER_1K = 0.00001  # $0.01 per 1M tokens
    OUTPUT_COST_PER_1K = 0.00002  # $0.02 per 1M tokens
    
    input_cost = (input_tokens / 1000) * INPUT_COST_PER_1K
    output_cost = (output_tokens / 1000) * OUTPUT_COST_PER_1K
    
    return input_cost + output_cost
```

**Daily Cost Report**:
```json
{
  "date": "2026-04-27",
  "total_crises": 1523,
  "total_cost_usd": 1.08,
  "cost_per_crisis": 0.00071,
  "by_agent": {
    "assessment_agent": {"calls": 1523, "cost": 0.15},
    "verification_agent": {"calls": 1523, "cost": 0.23},
    "allocation_agent": {"calls": 1421, "cost": 0.28},
    "communication_agent": {"calls": 1421, "cost": 0.17},
    "accountability_agent": {"calls": 1421, "cost": 0.21}
  },
  "budget_remaining": 98.92,
  "projected_monthly_cost": 32.40
}
```

### Cost Optimization Strategies

1. **Token Limit Tuning**: Reduce max_tokens if agents consistently under-use
2. **Caching**: Cache common patterns (location data, resource pools)
3. **Batching**: Batch non-urgent requests to reduce API calls
4. **Model Selection**: Use cheaper models for low-severity crises
5. **Prompt Compression**: Remove redundant instructions

### Budget Alerts

**Alert Thresholds**:
- Daily cost >$5: Warning (email)
- Daily cost >$10: Critical (Slack + email)
- Monthly projection >$150: Budget review meeting

---

## Changelog

### v1.0.0 (2026-04-27)
- Initial prompt governance framework
- Defined versioning strategy (SemVer)
- Created A/B testing framework
- Established evaluation metrics
- Documented approval workflow
- Set up prompt registry
- Defined rollback procedures
- Implemented cost monitoring

---

## Next Steps

1. ✅ **Prompts designed** (agent_prompts.yaml)
2. ✅ **Governance framework defined** (this document)
3. ⏳ **Implement prompt registry** (Python script)
4. ⏳ **Set up A/B testing infrastructure** (traffic routing)
5. ⏳ **Create evaluation scripts** (benchmark scenarios)
6. ⏳ **Integrate with CI/CD** (automated testing)
7. ⏳ **Deploy monitoring dashboards** (cost, performance)
8. ⏳ **Train team on workflow** (approval process)

---

## Appendix: Tools & Scripts

### Prompt Registry CLI

```bash
# List all agents and versions
python scripts/prompt_registry.py list

# Deploy new version
python scripts/prompt_registry.py deploy --agent assessment_agent --version 1.1.0

# Rollback to previous version
python scripts/prompt_registry.py rollback --agent assessment_agent --to-version 1.0.0

# View version history
python scripts/prompt_registry.py history --agent assessment_agent

# Compare two versions
python scripts/prompt_registry.py compare --agent assessment_agent --v1 1.0.0 --v2 1.1.0
```

### Evaluation CLI

```bash
# Run evaluation on all agents
python scripts/evaluate_agents.py --scenarios benchmarks/scenarios.json

# A/B test two versions
python scripts/evaluate_agents.py --control v1.0.0 --treatment v1.1.0

# Generate cost report
python scripts/cost_report.py --date 2026-04-27

# Monitor agent health
python scripts/health_monitor.py --agent assessment_agent --window 5
```

---

**Document Owner**: CrisisNet Engineering Team  
**Last Review**: 2026-04-27  
**Next Review**: 2026-05-27 (monthly)
