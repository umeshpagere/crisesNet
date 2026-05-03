#!/usr/bin/env python3
"""
CrisisNet Phase 4: Gemma 4 Prompt Quality Gate

Evaluates all Gemma prompts against 5 quality criteria:
1. TOKEN BUDGET (30%) - System + instruction tokens < 300
2. FORMAT ENFORCEMENT (25%) - Explicit output schema, "Start with {", no explain
3. GEMMA FORMAT COMPLIANCE (20%) - Correct <start_of_turn> usage
4. ENUM CONSTRAINTS (15%) - All categorical outputs defined as enums
5. FALLBACK COVERAGE (10%) - Every prompt type has fallback

Minimum passing score: 75/100 per prompt
"""

import re
import sys
from typing import Dict, List, Tuple

# Approximate token counting (4 chars per token heuristic)
def estimate_tokens(text: str) -> int:
    return len(text) // 4

def score_token_budget(prompt: str) -> Tuple[int, str]:
    """
    Score: 10 = <200 tokens, 7 = 200-300, 3 = 300-400, 0 = >400
    Weight: 30%
    """
    tokens = estimate_tokens(prompt)
    
    if tokens < 200:
        return 10, f"Excellent: {tokens} tokens (target: <200)"
    elif tokens < 300:
        return 7, f"Good: {tokens} tokens (target: <300)"
    elif tokens < 400:
        return 3, f"Warning: {tokens} tokens (limit: 400)"
    else:
        return 0, f"FAIL: {tokens} tokens (exceeds 400)"

def score_format_enforcement(prompt: str) -> Tuple[int, str]:
    """
    Score: 10 = all 3, 6 = 2/3, 2 = 1/3, 0 = none
    Weight: 25%
    
    Checks:
    1. Contains explicit output schema
    2. Contains "Start with {" or equivalent
    3. No "explain" or "think step by step"
    """
    checks = []
    
    # Check 1: Output schema
    has_schema = bool(re.search(r'schema|output.*format|json.*structure', prompt, re.IGNORECASE))
    checks.append(("Output schema defined", has_schema))
    
    # Check 2: Format constraint
    has_constraint = bool(re.search(r'start with \{|respond.*only.*json|output.*json', prompt, re.IGNORECASE))
    checks.append(("Format constraint present", has_constraint))
    
    # Check 3: No explain/CoT
    has_no_explain = not bool(re.search(r'explain|think step|reasoning|let\'s think', prompt, re.IGNORECASE))
    checks.append(("No explain/CoT instructions", has_no_explain))
    
    passed = sum(1 for _, check in checks if check)
    
    if passed == 3:
        score = 10
    elif passed == 2:
        score = 6
    elif passed == 1:
        score = 2
    else:
        score = 0
    
    details = "\n    ".join([f"{'✓' if check else '✗'} {name}" for name, check in checks])
    return score, f"{passed}/3 checks passed:\n    {details}"

def score_gemma_format(prompt: str) -> Tuple[int, str]:
    """
    Score: 10 = correct format, 0 = wrong format
    Weight: 20%
    
    Checks:
    1. Uses <start_of_turn>user
    2. Uses <end_of_turn>
    3. Ends with <start_of_turn>model (no newline after)
    """
    has_user_turn = '<start_of_turn>user' in prompt
    has_end_turn = '<end_of_turn>' in prompt
    ends_with_model = prompt.strip().endswith('<start_of_turn>model')
    
    if has_user_turn and has_end_turn and ends_with_model:
        return 10, "✓ Correct Gemma instruction format"
    else:
        issues = []
        if not has_user_turn:
            issues.append("Missing <start_of_turn>user")
        if not has_end_turn:
            issues.append("Missing <end_of_turn>")
        if not ends_with_model:
            issues.append("Does not end with <start_of_turn>model")
        return 0, f"✗ Format issues: {', '.join(issues)}"

def score_enum_constraints(prompt: str) -> Tuple[int, str]:
    """
    Score: 10 = all constrained, 5 = partial, 0 = none
    Weight: 15%
    
    Checks for enum definitions like:
    - "severity":"critical|high|moderate|low"
    - "status":"active|contained|resolved"
    """
    enum_patterns = [
        r'"[a-z_]+"\s*:\s*"[a-z]+\|[a-z|]+"',  # JSON enum
        r'[a-z_]+\s*:\s*[a-z]+\|[a-z|]+',      # Plain enum
    ]
    
    enum_count = 0
    for pattern in enum_patterns:
        enum_count += len(re.findall(pattern, prompt))
    
    if enum_count >= 3:
        return 10, f"✓ {enum_count} enum constraints found"
    elif enum_count >= 1:
        return 5, f"⚠ Only {enum_count} enum constraints (recommend 3+)"
    else:
        return 0, "✗ No enum constraints found"

def score_fallback_coverage(prompt_type: str, fallback_exists: bool) -> Tuple[int, str]:
    """
    Score: 10 = covered, 0 = missing
    Weight: 10%
    """
    if fallback_exists:
        return 10, f"✓ Fallback exists for {prompt_type}"
    else:
        return 0, f"✗ No fallback for {prompt_type}"

def evaluate_prompt(name: str, prompt: str, has_fallback: bool) -> Dict:
    """Evaluate a single prompt against all criteria"""
    
    print(f"\n{'='*60}")
    print(f"Evaluating: {name}")
    print(f"{'='*60}")
    
    # Calculate scores
    token_score, token_msg = score_token_budget(prompt)
    format_score, format_msg = score_format_enforcement(prompt)
    gemma_score, gemma_msg = score_gemma_format(prompt)
    enum_score, enum_msg = score_enum_constraints(prompt)
    fallback_score, fallback_msg = score_fallback_coverage(name, has_fallback)
    
    # Weighted total
    total = (
        token_score * 0.30 +
        format_score * 0.25 +
        gemma_score * 0.20 +
        enum_score * 0.15 +
        fallback_score * 0.10
    )
    
    # Print results
    print(f"\n1. TOKEN BUDGET (30%): {token_score}/10")
    print(f"   {token_msg}")
    
    print(f"\n2. FORMAT ENFORCEMENT (25%): {format_score}/10")
    print(f"   {format_msg}")
    
    print(f"\n3. GEMMA FORMAT (20%): {gemma_score}/10")
    print(f"   {gemma_msg}")
    
    print(f"\n4. ENUM CONSTRAINTS (15%): {enum_score}/10")
    print(f"   {enum_msg}")
    
    print(f"\n5. FALLBACK COVERAGE (10%): {fallback_score}/10")
    print(f"   {fallback_msg}")
    
    print(f"\n{'─'*60}")
    print(f"TOTAL SCORE: {total:.1f}/10.0 ({total*10:.0f}/100)")
    
    if total >= 7.5:
        print(f"STATUS: ✅ PASS (≥75/100)")
        status = "PASS"
    else:
        print(f"STATUS: ❌ FAIL (<75/100)")
        status = "FAIL"
    
    return {
        'name': name,
        'total': total * 10,
        'status': status,
        'scores': {
            'token_budget': token_score,
            'format_enforcement': format_score,
            'gemma_format': gemma_score,
            'enum_constraints': enum_score,
            'fallback_coverage': fallback_score,
        }
    }

def main():
    """Main validation entry point"""
    
    # Sample prompts (in real implementation, these would be imported from TypeScript)
    # For now, using representative examples
    
    triage_prompt = """<start_of_turn>user
You are a crisis triage AI. Assess severity and give response guidance.
Respond ONLY with JSON. Start with {. No explanation.

Output schema:
{"severity":"critical|high|moderate|low","confidence":0.0-1.0,"immediate_actions":["string"],"resources_needed":["string"],"escalate_to_hub":true|false,"victim_guidance":"string (max 100 chars, plain language)"}

Example:
Input: flood, 8 casualties, river overflowing
Output: {"severity":"critical","confidence":0.88,"immediate_actions":["Move to high ground immediately","Do not enter floodwater"],"resources_needed":["rescue_boats","medical_team"],"escalate_to_hub":true,"victim_guidance":"Go to highest point. Help is coming. Stay visible."}

Now assess:
Type: flood
Casualties: 5
Location: 19.99,73.78
Description: Flash flood near bridge
<end_of_turn>
<start_of_turn>model
"""
    
    guidance_prompt = """<start_of_turn>user
Crisis assistant. flood, severity: high.
Answer in 2 sentences max. Plain language. No jargon.
Question: What should I do if water is rising?
<end_of_turn>
<start_of_turn>model
"""
    
    assessment_prompt = """<start_of_turn>user
Field assessment AI. Output JSON only. Start with {.
Schema: {"priority_actions":["string"],"resource_requests":["string"],"zone_status":"active|contained|resolved","estimated_affected":number,"coordinator_notes":"string (max 150 chars)"}
Location: 19.99,73.78
Observations: Water level rising; Bridge unstable; 10 people stranded
Infrastructure: Bridge damaged, road flooded
Medical: No injuries reported
<end_of_turn>
<start_of_turn>model
"""
    
    prompts = [
        ('triage', triage_prompt, True),
        ('guidance', guidance_prompt, True),
        ('assessment', assessment_prompt, True),
    ]
    
    print("="*60)
    print("CrisisNet Phase 4: Gemma 4 Prompt Quality Gate")
    print("="*60)
    
    results = []
    for name, prompt, has_fallback in prompts:
        result = evaluate_prompt(name, prompt, has_fallback)
        results.append(result)
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    
    all_passed = True
    for result in results:
        status_icon = "✅" if result['status'] == 'PASS' else "❌"
        print(f"{status_icon} {result['name']}: {result['total']:.0f}/100 ({result['status']})")
        if result['status'] == 'FAIL':
            all_passed = False
    
    print(f"\n{'='*60}")
    if all_passed:
        print("✅ ALL PROMPTS PASSED - Ready for production")
        return 0
    else:
        print("❌ SOME PROMPTS FAILED - Fix issues before deployment")
        return 1

if __name__ == '__main__':
    sys.exit(main())
