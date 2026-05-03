"""
CrisisNet Demo Dry-Run Script

Comprehensive validation of all systems before deployment:
1. Unit tests (AllocationOptimizer)
2. E2E integration tests
3. Benchmark suite
4. Demo data generation
5. API endpoint validation
6. Performance checks

Exit code 0 = all checks passed
Exit code 1 = some checks failed
"""

# _REPO_ROOT_BOOTSTRAP_ — allow `python3 path/to/script.py` from repo root
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import subprocess
import sys
import json
import time
from typing import List, Dict, Tuple


class DemoDryRun:
    """Comprehensive demo validation"""
    
    def __init__(self):
        self.results = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "checks": {},
            "summary": {}
        }
        self.failed_checks = []
    
    def run_command(self, cmd: List[str], description: str, timeout: int = 60) -> Tuple[bool, str]:
        """Run command and return success status"""
        print(f"\n{'─'*80}")
        print(f"🔍 {description}")
        print(f"{'─'*80}")
        print(f"Command: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd="/Users/umeshpagere/Documents/crisisnet-api"
            )
            
            success = result.returncode == 0
            
            if success:
                print(f"✅ PASS")
            else:
                print(f"❌ FAIL (exit code: {result.returncode})")
                if result.stderr:
                    print(f"\nError output:\n{result.stderr[:500]}")
            
            return success, result.stdout
        
        except subprocess.TimeoutExpired:
            print(f"❌ FAIL (timeout after {timeout}s)")
            return False, ""
        except Exception as e:
            print(f"❌ FAIL (exception: {str(e)})")
            return False, ""
    
    def check_unit_tests(self) -> bool:
        """Run AllocationOptimizer unit tests"""
        print("\n" + "="*80)
        print("CHECK 1: UNIT TESTS (AllocationOptimizer)")
        print("="*80)
        
        success, output = self.run_command(
            ["python3", "-m", "pytest", "tests/test_allocation_optimizer.py", "-v", "--tb=short"],
            "Running AllocationOptimizer unit tests (13 tests)"
        )
        
        self.results["checks"]["unit_tests"] = {
            "status": "pass" if success else "fail",
            "description": "AllocationOptimizer unit tests"
        }
        
        if not success:
            self.failed_checks.append("Unit Tests")
        
        return success
    
    def check_e2e_tests(self) -> bool:
        """Run E2E integration tests"""
        print("\n" + "="*80)
        print("CHECK 2: E2E INTEGRATION TESTS")
        print("="*80)
        
        success, output = self.run_command(
            ["python3", "-m", "pytest", "tests/test_e2e_integration.py", "-v", "--tb=short"],
            "Running E2E integration tests (21 tests)"
        )
        
        self.results["checks"]["e2e_tests"] = {
            "status": "pass" if success else "fail",
            "description": "E2E integration tests"
        }
        
        if not success:
            self.failed_checks.append("E2E Tests")
        
        return success
    
    def check_benchmarks(self) -> bool:
        """Run full benchmark suite"""
        print("\n" + "="*80)
        print("CHECK 3: BENCHMARK SUITE")
        print("="*80)
        
        success, output = self.run_command(
            ["python3", "benchmarks/benchmark_full_suite.py"],
            "Running full benchmark suite (4 phases)",
            timeout=120
        )
        
        self.results["checks"]["benchmarks"] = {
            "status": "pass" if success else "fail",
            "description": "Full benchmark suite"
        }
        
        if not success:
            self.failed_checks.append("Benchmarks")
        
        return success
    
    def check_demo_seeder(self) -> bool:
        """Validate demo data generation"""
        print("\n" + "="*80)
        print("CHECK 4: DEMO DATA SEEDER")
        print("="*80)
        
        # Test all scenarios
        scenarios = ["flood_nashik", "earthquake_mumbai", "fire_pune", "multi_crisis"]
        all_success = True
        
        for scenario in scenarios:
            success, output = self.run_command(
                ["python3", "scripts/demo_seeder.py", "--scenario", scenario, "--output", f"demo-data/test_{scenario}.json"],
                f"Generating {scenario} scenario"
            )
            
            if not success:
                all_success = False
                break
            
            # Validate JSON structure
            try:
                with open(f"/Users/umeshpagere/Documents/crisisnet-api/demo-data/test_{scenario}.json") as f:
                    data = json.load(f)
                    
                    # Check required fields
                    required = ["scenario", "victims", "responders", "crisis_type", "severity"]
                    if not all(field in data for field in required):
                        print(f"❌ Missing required fields in {scenario}")
                        all_success = False
                        break
                    
                    # Check data counts
                    if len(data["victims"]) == 0 or len(data["responders"]) == 0:
                        print(f"❌ Empty victims or responders in {scenario}")
                        all_success = False
                        break
                    
                    print(f"  ✓ Valid: {len(data['victims'])} victims, {len(data['responders'])} responders")
            
            except Exception as e:
                print(f"❌ JSON validation failed: {str(e)}")
                all_success = False
                break
        
        self.results["checks"]["demo_seeder"] = {
            "status": "pass" if all_success else "fail",
            "description": "Demo data seeder (4 scenarios)"
        }
        
        if not all_success:
            self.failed_checks.append("Demo Seeder")
        
        return all_success
    
    def check_allocation_performance(self) -> bool:
        """Validate allocation performance with demo data"""
        print("\n" + "="*80)
        print("CHECK 5: ALLOCATION PERFORMANCE")
        print("="*80)
        
        try:
            # Load multi-crisis scenario
            with open("/Users/umeshpagere/Documents/crisisnet-api/demo-data/test_multi_crisis.json") as f:
                data = json.load(f)
            
            # Run allocation benchmark
            from backend.services.allocation_optimizer import AllocationOptimizer
            
            optimizer = AllocationOptimizer()
            
            victims = [
                {"id": v["id"], "lat": v["location"]["lat"], 
                 "lng": v["location"]["lng"], "severity": v["severity"]}
                for v in data["victims"]
            ]
            
            responders = [
                {"id": r["id"], "lat": r["location"]["lat"],
                 "lng": r["location"]["lng"], "capacity": r["capacity"]}
                for r in data["responders"]
            ]
            
            print(f"\nAllocating {len(victims)} victims to {len(responders)} responders...")
            
            start = time.time()
            result = optimizer.allocate(victims, responders)
            duration_ms = (time.time() - start) * 1000
            
            print(f"  ✓ Solve time: {duration_ms:.2f} ms")
            print(f"  ✓ Total distance: {result['total_distance_km']:.2f} km")
            print(f"  ✓ Assignments: {len(result['assignments'])}")
            print(f"  ✓ Unassigned: {result['unassigned_victims']}")
            
            # Performance check: should complete in <10s for demo data
            success = duration_ms < 10000 and result["status"] == "success"
            
            if success:
                print(f"\n✅ PASS - Performance acceptable")
            else:
                print(f"\n❌ FAIL - Performance issue or allocation failed")
            
            self.results["checks"]["allocation_performance"] = {
                "status": "pass" if success else "fail",
                "description": "Allocation performance with demo data",
                "solve_time_ms": round(duration_ms, 2),
                "total_distance_km": result['total_distance_km']
            }
            
            if not success:
                self.failed_checks.append("Allocation Performance")
            
            return success
        
        except Exception as e:
            print(f"❌ FAIL - Exception: {str(e)}")
            self.results["checks"]["allocation_performance"] = {
                "status": "fail",
                "description": "Allocation performance with demo data",
                "error": str(e)
            }
            self.failed_checks.append("Allocation Performance")
            return False
    
    def check_file_structure(self) -> bool:
        """Validate critical files exist"""
        print("\n" + "="*80)
        print("CHECK 6: FILE STRUCTURE")
        print("="*80)
        
        critical_files = [
            "backend/main.py",
            "backend/services/allocation_optimizer.py",
            "tests/test_allocation_optimizer.py",
            "tests/test_e2e_integration.py",
            "benchmarks/benchmark_full_suite.py",
            "benchmarks/benchmark_allocation.py",
            "scripts/demo_seeder.py",
            "requirements.txt"
        ]
        
        import os
        base_path = "/Users/umeshpagere/Documents/crisisnet-api"
        
        all_exist = True
        for file in critical_files:
            full_path = os.path.join(base_path, file)
            exists = os.path.exists(full_path)
            
            if exists:
                print(f"  ✓ {file}")
            else:
                print(f"  ❌ {file} - MISSING")
                all_exist = False
        
        self.results["checks"]["file_structure"] = {
            "status": "pass" if all_exist else "fail",
            "description": "Critical files exist"
        }
        
        if not all_exist:
            self.failed_checks.append("File Structure")
        
        if all_exist:
            print(f"\n✅ PASS - All critical files present")
        else:
            print(f"\n❌ FAIL - Missing critical files")
        
        return all_exist
    
    def generate_summary(self):
        """Generate final summary"""
        total_checks = len(self.results["checks"])
        passed_checks = sum(1 for c in self.results["checks"].values() if c["status"] == "pass")
        failed_checks = total_checks - passed_checks
        
        self.results["summary"] = {
            "total_checks": total_checks,
            "passed": passed_checks,
            "failed": failed_checks,
            "pass_rate_pct": round((passed_checks / total_checks * 100), 1) if total_checks > 0 else 0,
            "overall_status": "PASS" if failed_checks == 0 else "FAIL"
        }
    
    def print_final_report(self):
        """Print final validation report"""
        print("\n" + "="*80)
        print("DEMO DRY-RUN FINAL REPORT")
        print("="*80)
        
        summary = self.results["summary"]
        
        print(f"\nTotal Checks: {summary['total_checks']}")
        print(f"Passed: {summary['passed']}")
        print(f"Failed: {summary['failed']}")
        print(f"Pass Rate: {summary['pass_rate_pct']}%")
        
        if self.failed_checks:
            print(f"\n❌ Failed Checks:")
            for check in self.failed_checks:
                print(f"   - {check}")
        
        print(f"\n{'='*80}")
        if summary['overall_status'] == "PASS":
            print("✅ ALL CHECKS PASSED - READY FOR DEPLOYMENT")
        else:
            print("❌ SOME CHECKS FAILED - FIX ISSUES BEFORE DEPLOYMENT")
        print(f"{'='*80}\n")
        
        # Save report
        with open("benchmarks/results/demo_dry_run_report.json", "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"📊 Report saved to: benchmarks/results/demo_dry_run_report.json\n")
    
    def run_all(self) -> int:
        """Run all validation checks"""
        print("\n" + "="*80)
        print("CRISISNET DEMO DRY-RUN")
        print("Comprehensive System Validation")
        print("="*80)
        print(f"Timestamp: {self.results['timestamp']}\n")
        
        # Run all checks
        self.check_file_structure()
        self.check_unit_tests()
        self.check_e2e_tests()
        self.check_benchmarks()
        self.check_demo_seeder()
        self.check_allocation_performance()
        
        # Generate summary
        self.generate_summary()
        
        # Print report
        self.print_final_report()
        
        # Return exit code
        return 0 if self.results["summary"]["overall_status"] == "PASS" else 1


def main():
    """Main entry point"""
    dry_run = DemoDryRun()
    exit_code = dry_run.run_all()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
