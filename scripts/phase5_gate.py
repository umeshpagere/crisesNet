"""
Phase 5 Gate: All Tests Pass

Final validation gate for CrisisNet Phase 5.
Runs all test suites and benchmarks. Must achieve 100% pass rate.

Exit code 0 = GATE PASSED
Exit code 1 = GATE FAILED
"""

import subprocess
import sys
import json
import time
from typing import List, Tuple


CWD = "/Users/umeshpagere/Documents/crisisnet-api"

GATE_CHECKS = [
    {
        "id": "unit_alloc",
        "label": "AllocationOptimizer Unit Tests",
        "cmd": ["python3", "-m", "pytest", "tests/test_allocation_optimizer.py", "-v", "--tb=short"],
        "timeout": 120
    },
    {
        "id": "e2e",
        "label": "E2E Integration Tests (21 tests)",
        "cmd": ["python3", "-m", "pytest", "tests/test_e2e_integration.py", "-v", "--tb=short"],
        "timeout": 60
    },
    {
        "id": "phase2",
        "label": "Phase 2 Agent Tests",
        "cmd": ["python3", "-m", "pytest", "tests/test_phase2_agents.py", "-v", "--tb=short"],
        "timeout": 60
    },
    {
        "id": "benchmarks",
        "label": "Full Benchmark Suite (4 phases, 100% pass)",
        "cmd": ["python3", "benchmarks/benchmark_full_suite.py"],
        "timeout": 120
    },
    {
        "id": "smoke_live",
        "label": "Live Smoke Tests (Flask on :8080)",
        "cmd": ["python3", "scripts/smoke_tests.py", "--url", "http://localhost:8080"],
        "timeout": 30,
        "requires_server": True
    },
    {
        "id": "demo_seeder",
        "label": "Demo Seeder (all 4 scenarios)",
        "cmd": ["python3", "scripts/demo_seeder.py", "--scenario", "multi_crisis", "--output", "/tmp/gate_demo.json"],
        "timeout": 30
    }
]


def run_check(check: dict) -> Tuple[bool, str, float]:
    """Run a single gate check. Returns (success, output_snippet, duration_s)."""
    start = time.time()
    try:
        result = subprocess.run(
            check["cmd"],
            capture_output=True,
            text=True,
            timeout=check["timeout"],
            cwd=CWD
        )
        duration = time.time() - start
        success = result.returncode == 0
        # Extract last meaningful output lines
        output = (result.stdout + result.stderr).strip()
        snippet = "\n".join(output.splitlines()[-6:]) if output else "(no output)"
        return success, snippet, duration
    except subprocess.TimeoutExpired:
        return False, f"TIMEOUT after {check['timeout']}s", time.time() - start
    except Exception as e:
        return False, str(e), time.time() - start


def start_flask() -> subprocess.Popen:
    """Start Flask server for smoke tests."""
    proc = subprocess.Popen(
        ["python3", "-m", "backend.main"],
        cwd=CWD,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    time.sleep(3)
    return proc


def main():
    start_total = time.time()

    print()
    print("╔" + "═" * 78 + "╗")
    print("║" + "  CRISISNET PHASE 5 GATE — FINAL VALIDATION".center(78) + "║")
    print("╚" + "═" * 78 + "╝")
    print(f"  Started: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    print(f"  Checks:  {len(GATE_CHECKS)}")
    print()

    results = []
    flask_proc = None

    # Start Flask for smoke tests
    needs_server = any(c.get("requires_server") for c in GATE_CHECKS)
    if needs_server:
        print("  🚀 Starting Flask server for smoke tests...")
        flask_proc = start_flask()
        print("  ✓ Flask ready on :8080\n")

    for i, check in enumerate(GATE_CHECKS, 1):
        print(f"  [{i}/{len(GATE_CHECKS)}] {check['label']}")
        success, snippet, duration = run_check(check)
        icon = "✅" if success else "❌"
        print(f"        {icon}  {'PASS' if success else 'FAIL'}  ({duration:.1f}s)")
        if not success:
            print(f"        └─ {snippet.splitlines()[-1][:100]}")
        results.append({"id": check["id"], "label": check["label"],
                        "passed": success, "duration_s": round(duration, 2)})

    # Stop Flask
    if flask_proc:
        flask_proc.terminate()
        flask_proc.wait()

    # ── Summary ──────────────────────────────────────────────────────────────
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    total_duration = time.time() - start_total
    gate_pass = failed == 0

    print()
    print("─" * 80)
    print(f"  {'Check':<48} {'Duration':>8}   {'Status'}")
    print("─" * 80)
    for r in results:
        status = "✅ PASS" if r["passed"] else "❌ FAIL"
        print(f"  {r['label']:<48} {r['duration_s']:>7.1f}s   {status}")
    print("─" * 80)
    print(f"  Total: {passed}/{total} passed   ({total_duration:.1f}s)\n")

    if gate_pass:
        print("╔" + "═" * 78 + "╗")
        print("║" + "  🎉  PHASE 5 GATE PASSED — ALL CHECKS GREEN  🎉".center(78) + "║")
        print("╚" + "═" * 78 + "╝")
    else:
        print("╔" + "═" * 78 + "╗")
        print("║" + f"  ❌  PHASE 5 GATE FAILED  ({failed} check(s) failing)".center(78) + "║")
        print("╚" + "═" * 78 + "╝")

    # Save report
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "gate_pass": gate_pass,
        "total": total,
        "passed": passed,
        "failed": failed,
        "duration_s": round(total_duration, 2),
        "checks": results
    }
    with open("benchmarks/results/phase5_gate_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  📊 Report → benchmarks/results/phase5_gate_report.json\n")

    return 0 if gate_pass else 1


if __name__ == "__main__":
    sys.exit(main())
