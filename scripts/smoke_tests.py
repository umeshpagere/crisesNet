"""
Cloud Run Smoke Tests

Post-deployment validation tests:
1. Health check endpoint
2. Allocation endpoint with demo data
3. Response time validation
4. Error handling

Usage:
    python3 smoke_tests.py --url https://crisisnet-api-xxx.run.app
"""

import argparse
import requests
import json
import time
import sys
from typing import Dict, Any


class SmokeTests:
    """Post-deployment smoke tests"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.results = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "base_url": self.base_url,
            "tests": {},
            "summary": {}
        }
        self.failed_tests = []
    
    def test_health_endpoint(self) -> bool:
        """Test /health endpoint"""
        print("\n" + "="*80)
        print("TEST 1: Health Check Endpoint")
        print("="*80)
        
        try:
            url = f"{self.base_url}/health"
            print(f"GET {url}")
            
            start = time.time()
            response = requests.get(url, timeout=10)
            latency_ms = (time.time() - start) * 1000
            
            print(f"  Status: {response.status_code}")
            print(f"  Latency: {latency_ms:.2f} ms")
            
            success = response.status_code == 200
            
            if success:
                print(f"  ✅ PASS")
            else:
                print(f"  ❌ FAIL - Expected 200, got {response.status_code}")
            
            self.results["tests"]["health_check"] = {
                "status": "pass" if success else "fail",
                "status_code": response.status_code,
                "latency_ms": round(latency_ms, 2)
            }
            
            if not success:
                self.failed_tests.append("Health Check")
            
            return success
        
        except Exception as e:
            print(f"  ❌ FAIL - Exception: {str(e)}")
            self.results["tests"]["health_check"] = {
                "status": "fail",
                "error": str(e)
            }
            self.failed_tests.append("Health Check")
            return False
    
    def test_allocation_endpoint(self) -> bool:
        """Test /api/allocate endpoint with demo data"""
        print("\n" + "="*80)
        print("TEST 2: Allocation Endpoint")
        print("="*80)
        
        try:
            # Load demo data
            try:
                with open("demo-data/test_multi_crisis.json") as f:
                    demo_data = json.load(f)
            except FileNotFoundError:
                print(f"  ⚠ Demo data not found, generating minimal test data")
                demo_data = {
                    "victims": [
                        {"id": "v1", "lat": 19.99, "lng": 73.78, "severity": "critical"},
                        {"id": "v2", "lat": 20.00, "lng": 73.79, "severity": "high"}
                    ],
                    "responders": [
                        {"id": "r1", "lat": 20.00, "lng": 73.80, "capacity": 5}
                    ]
                }
            
            # Extract allocation data
            allocation_request = {
                "victims": [
                    {"id": v["id"], "lat": v["location"]["lat"], 
                     "lng": v["location"]["lng"], "severity": v["severity"]}
                    for v in demo_data.get("victims", demo_data.get("victims", []))
                ] if "location" in demo_data.get("victims", [{}])[0] else demo_data.get("victims", []),
                "responders": [
                    {"id": r["id"], "lat": r["location"]["lat"],
                     "lng": r["location"]["lng"], "capacity": r["capacity"]}
                    for r in demo_data.get("responders", [])
                ] if "location" in demo_data.get("responders", [{}])[0] else demo_data.get("responders", [])
            }
            
            url = f"{self.base_url}/api/allocate"
            print(f"POST {url}")
            print(f"  Victims: {len(allocation_request['victims'])}")
            print(f"  Responders: {len(allocation_request['responders'])}")
            
            start = time.time()
            response = requests.post(
                url,
                json=allocation_request,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            latency_ms = (time.time() - start) * 1000
            
            print(f"  Status: {response.status_code}")
            print(f"  Latency: {latency_ms:.2f} ms")
            
            if response.status_code == 200:
                result = response.json()
                print(f"  Response Status: {result.get('status', 'unknown')}")
                print(f"  Assignments: {len(result.get('assignments', []))}")
                print(f"  Total Distance: {result.get('total_distance_km', 0):.2f} km")
                print(f"  Solve Time: {result.get('solve_time_ms', 0):.2f} ms")
                
                # Validate response structure
                success = (
                    result.get("status") == "success" and
                    "assignments" in result and
                    "total_distance_km" in result and
                    "solve_time_ms" in result
                )
                
                if success:
                    print(f"  ✅ PASS")
                else:
                    print(f"  ❌ FAIL - Invalid response structure")
                
                self.results["tests"]["allocation_endpoint"] = {
                    "status": "pass" if success else "fail",
                    "status_code": response.status_code,
                    "latency_ms": round(latency_ms, 2),
                    "solve_time_ms": result.get("solve_time_ms", 0),
                    "total_distance_km": result.get("total_distance_km", 0),
                    "assignments": len(result.get("assignments", []))
                }
            else:
                print(f"  ❌ FAIL - Expected 200, got {response.status_code}")
                success = False
                self.results["tests"]["allocation_endpoint"] = {
                    "status": "fail",
                    "status_code": response.status_code,
                    "error": response.text[:200]
                }
            
            if not success:
                self.failed_tests.append("Allocation Endpoint")
            
            return success
        
        except Exception as e:
            print(f"  ❌ FAIL - Exception: {str(e)}")
            self.results["tests"]["allocation_endpoint"] = {
                "status": "fail",
                "error": str(e)
            }
            self.failed_tests.append("Allocation Endpoint")
            return False
    
    def test_response_times(self) -> bool:
        """Test response time is acceptable"""
        print("\n" + "="*80)
        print("TEST 3: Response Time Validation")
        print("="*80)
        
        # Check if health check latency is acceptable
        health_latency = self.results["tests"].get("health_check", {}).get("latency_ms", 0)
        allocation_latency = self.results["tests"].get("allocation_endpoint", {}).get("latency_ms", 0)
        
        print(f"  Health Check: {health_latency:.2f} ms")
        print(f"  Allocation: {allocation_latency:.2f} ms")
        
        # Acceptable thresholds
        health_ok = health_latency < 5000  # <5s for health
        allocation_ok = allocation_latency < 30000  # <30s for allocation
        
        success = health_ok and allocation_ok
        
        if success:
            print(f"  ✅ PASS - All response times acceptable")
        else:
            if not health_ok:
                print(f"  ❌ FAIL - Health check too slow ({health_latency:.2f} ms > 5000 ms)")
            if not allocation_ok:
                print(f"  ❌ FAIL - Allocation too slow ({allocation_latency:.2f} ms > 30000 ms)")
        
        self.results["tests"]["response_times"] = {
            "status": "pass" if success else "fail",
            "health_latency_ms": health_latency,
            "allocation_latency_ms": allocation_latency,
            "health_ok": health_ok,
            "allocation_ok": allocation_ok
        }
        
        if not success:
            self.failed_tests.append("Response Times")
        
        return success
    
    def test_error_handling(self) -> bool:
        """Test error handling with invalid input"""
        print("\n" + "="*80)
        print("TEST 4: Error Handling")
        print("="*80)
        
        try:
            # Test with invalid JSON
            url = f"{self.base_url}/api/allocate"
            print(f"POST {url} (invalid data)")
            
            response = requests.post(
                url,
                json={"invalid": "data"},
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            print(f"  Status: {response.status_code}")
            
            # Should return 400 Bad Request
            success = response.status_code == 400
            
            if success:
                print(f"  ✅ PASS - Correctly rejected invalid input")
            else:
                print(f"  ❌ FAIL - Expected 400, got {response.status_code}")
            
            self.results["tests"]["error_handling"] = {
                "status": "pass" if success else "fail",
                "status_code": response.status_code
            }
            
            if not success:
                self.failed_tests.append("Error Handling")
            
            return success
        
        except Exception as e:
            print(f"  ❌ FAIL - Exception: {str(e)}")
            self.results["tests"]["error_handling"] = {
                "status": "fail",
                "error": str(e)
            }
            self.failed_tests.append("Error Handling")
            return False
    
    def generate_summary(self):
        """Generate test summary"""
        total_tests = len(self.results["tests"])
        passed_tests = sum(1 for t in self.results["tests"].values() if t["status"] == "pass")
        failed_tests = total_tests - passed_tests
        
        self.results["summary"] = {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "pass_rate_pct": round((passed_tests / total_tests * 100), 1) if total_tests > 0 else 0,
            "overall_status": "PASS" if failed_tests == 0 else "FAIL"
        }
    
    def print_final_report(self):
        """Print final test report"""
        print("\n" + "="*80)
        print("SMOKE TESTS FINAL REPORT")
        print("="*80)
        
        summary = self.results["summary"]
        
        print(f"\nBase URL: {self.base_url}")
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']}")
        print(f"Failed: {summary['failed']}")
        print(f"Pass Rate: {summary['pass_rate_pct']}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   - {test}")
        
        print(f"\n{'='*80}")
        if summary['overall_status'] == "PASS":
            print("✅ ALL SMOKE TESTS PASSED - SERVICE IS HEALTHY")
        else:
            print("❌ SOME SMOKE TESTS FAILED - SERVICE MAY HAVE ISSUES")
        print(f"{'='*80}\n")
        
        # Save report
        with open("benchmarks/results/smoke_tests_report.json", "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"📊 Report saved to: benchmarks/results/smoke_tests_report.json\n")
    
    def run_all(self) -> int:
        """Run all smoke tests"""
        print("\n" + "="*80)
        print("CRISISNET SMOKE TESTS")
        print("Post-Deployment Validation")
        print("="*80)
        print(f"Timestamp: {self.results['timestamp']}")
        print(f"Target: {self.base_url}\n")
        
        # Run all tests
        self.test_health_endpoint()
        self.test_allocation_endpoint()
        self.test_response_times()
        self.test_error_handling()
        
        # Generate summary
        self.generate_summary()
        
        # Print report
        self.print_final_report()
        
        # Return exit code
        return 0 if self.results["summary"]["overall_status"] == "PASS" else 1


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="CrisisNet Smoke Tests")
    parser.add_argument(
        "--url",
        required=True,
        help="Base URL of deployed service (e.g., https://crisisnet-api-xxx.run.app)"
    )
    
    args = parser.parse_args()
    
    smoke_tests = SmokeTests(args.url)
    exit_code = smoke_tests.run_all()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
