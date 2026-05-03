# CrisisNet Agent Prompts — Changelog

Format: [version] (date) — description

---

## v1.0.1 (2026-04-27)

### Fixed
- **Allocation Agent**: Added multi-crisis resource contention example (Test 10 fix)
- **Communication Agent**: Added Marathi language support + multi-language example (Test 12 fix)
- **Communication Agent**: Added medium-severity example
- **Assessment Agent**: Added prompt injection defense (Test 5 fix)
- **Verification Agent**: Added multi-source example, conflicting-source example (Test 8 fix)

### Changed
- **Allocation Agent**: Added MULTI-CRISIS PRIORITY RULES to system_prompt
- **Allocation Agent**: Clarified optimization_score calculation formula
- **Communication Agent**: Added LANGUAGE SUPPORT section to system_prompt
- **Communication Agent**: Removed hardcoded contact numbers (now parameterized)
- **Assessment Agent**: Added SECURITY GUIDELINES section
- **Metadata**: Added evaluation_metrics, git_commit, rollback_version, changelog reference

### Improved
- All agents now have version tracking (v1.0.1)
- Versioning compliance: 100% (was 33%)
- Predicted test pass rate: 100% (13/13 tests, was 69%)
- Few-shot examples increased: Allocation (2→3), Verification (3→5), Communication (2→4)

### Known Issues
- Accountability Agent still has only 2 examples (target: 3-4)
- Actual accuracy metrics not yet measured (backend not built)
- Complete-failure scenario example not yet added to Accountability Agent

---

## v1.0.0 (2026-04-27)

### Added
- Initial release
- 5 agents: Assessment, Verification, Allocation, Communication, Accountability
- 15 total few-shot examples across all agents
- Estimated cost: $0.00071 per crisis
- Target response time: 4.4 seconds total
- Governance framework: SemVer, A/B testing, rollback

### Baseline Metrics (Structural Only)
- Governance score: 8.3/10 average
- Predicted test pass rate: 69% (9/13 tests)
- Versioning compliance: 33% (needs improvement)
- Critical gaps: Multi-crisis allocation, multi-language communication
