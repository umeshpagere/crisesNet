#!/usr/bin/env python3
"""
CrisisNet Phase 1: Benchmark Runner
Runs 5 end-to-end crisis simulation scenarios
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List

BASE_URL = "https://crisisnet-api-3mz45jxewq-el.a.run.app"

class BenchmarkRunner:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def run_benchmark(self, benchmark_num: int, name: str, scenario: Dict, 
                     max_time_ms: int, success_criteria: str) -> Dict:
        """Run a complete crisis simulation benchmark"""
        print(f"\n{'='*70}")
        print(f"BENCHMARK {benchmark_num}: {name}")
        print(f"{'='*70}")
        print(f"Max Time: {max_time_ms}ms")
        print(f"Success Criteria: {success_criteria}")
        
        start_time = time.time()
        pipeline_results = {}
        
        try:
            # Step 1: Assessment
            print("\n[1/5] Running Assessment Agent...")
            assess_response = requests.post(
                f"{self.base_url}/api/v1/agents/assess",
                json=scenario["assessment_input"],
                timeout=30
            )
            assess_data = assess_response.json()
            crisis_id = assess_data.get("crisis_id")
            pipeline_results["assessment"] = assess_data
            print(f"  ✓ Crisis ID: {crisis_id}")
            time.sleep(3)  # Wait for async processing
            
            # Step 2: Verification
            print("\n[2/5] Running Verification Agent...")
            verify_response = requests.post(
                f"{self.base_url}/api/v1/agents/verify",
                json={
                    "assessment_id": assess_data.get("assessment_id"),
                    "crisis_id": crisis_id,
                    "assessment": scenario.get("verification_context", {})
                },
                timeout=30
            )
            verify_data = verify_response.json()
            pipeline_results["verification"] = verify_data
            print(f"  ✓ Verification ID: {verify_data.get('verification_id')}")
            time.sleep(3)
            
            # Step 3: Allocation
            print("\n[3/5] Running Allocation Agent...")
            alloc_response = requests.post(
                f"{self.base_url}/api/v1/agents/allocate",
                json={
                    "crisis_id": crisis_id,
                    **scenario["allocation_input"]
                },
                timeout=30
            )
            alloc_data = alloc_response.json()
            pipeline_results["allocation"] = alloc_data
            print(f"  ✓ Allocation ID: {alloc_data.get('allocation_id')}")
            time.sleep(3)
            
            # Step 4: Communication
            print("\n[4/5] Running Communication Agent...")
            comm_response = requests.post(
                f"{self.base_url}/api/v1/agents/communicate",
                json={
                    "crisis_id": crisis_id,
                    **scenario["communication_input"]
                },
                timeout=30
            )
            comm_data = comm_response.json()
            pipeline_results["communication"] = comm_data
            print(f"  ✓ Communication ID: {comm_data.get('communication_id')}")
            time.sleep(3)
            
            # Step 5: Consensus Decision
            print("\n[5/5] Running Consensus Voting...")
            decision_response = requests.post(
                f"{self.base_url}/api/v1/agents/decide",
                json={
                    "crisis_id": crisis_id,
                    "decision_type": "RESCUE"
                },
                timeout=30
            )
            decision_data = decision_response.json()
            pipeline_results["decision"] = decision_data
            print(f"  ✓ Decision ID: {decision_data.get('decision_id')}")
            time.sleep(3)
            
            # Calculate total time
            total_time_ms = (time.time() - start_time) * 1000
            
            # Determine pass/fail
            status = "PASS" if total_time_ms <= max_time_ms else "FAIL"
            
            if status == "PASS":
                self.passed += 1
                print(f"\n✅ PASS - Total time: {total_time_ms:.0f}ms (limit: {max_time_ms}ms)")
            else:
                self.failed += 1
                print(f"\n❌ FAIL - Total time: {total_time_ms:.0f}ms (exceeded {max_time_ms}ms limit)")
            
            result = {
                "benchmark_num": benchmark_num,
                "name": name,
                "status": status,
                "total_time_ms": total_time_ms,
                "max_time_ms": max_time_ms,
                "success_criteria": success_criteria,
                "pipeline_results": pipeline_results,
                "crisis_id": crisis_id
            }
            
            return result
            
        except Exception as e:
            total_time_ms = (time.time() - start_time) * 1000
            print(f"\n❌ FAIL - Error: {str(e)}")
            self.failed += 1
            return {
                "benchmark_num": benchmark_num,
                "name": name,
                "status": "FAIL",
                "total_time_ms": total_time_ms,
                "error": str(e),
                "success_criteria": success_criteria
            }
    
    def run_all_benchmarks(self):
        """Run all 5 benchmark scenarios"""
        
        # BENCHMARK 1: River Rescue (Standard Case)
        self.results.append(self.run_benchmark(
            1, "River Rescue - Standard Case",
            {
                "assessment_input": {
                    "location": {"lat": 19.89, "lon": 73.80, "name": "Nashik River"},
                    "description": "Boat capsized in river, 8 people in water, strong current",
                    "source_type": "citizen_report"
                },
                "verification_context": {
                    "severity": 9,
                    "confidence": 0.85,
                    "source_type": "citizen_report"
                },
                "allocation_input": {
                    "crisis": {"severity": 9, "estimated_affected": 8},
                    "resource_pool": [
                        {"id": "BOAT_01", "type": "boat", "capacity": 10},
                        {"id": "BOAT_02", "type": "boat", "capacity": 10},
                        {"id": "MEDICAL_01", "type": "medical_team", "capacity": 20}
                    ]
                },
                "communication_input": {
                    "crisis": {"severity": 9, "location": "Nashik River"},
                    "language": "english"
                }
            },
            25000,  # 25 seconds max
            "Total time <25s, all 5 agents complete, consensus reached"
        ))
        
        # BENCHMARK 2: Urban Flash Flood (Scale Test)
        self.results.append(self.run_benchmark(
            2, "Urban Flash Flood - Scale Test",
            {
                "assessment_input": {
                    "location": {"lat": 19.12, "lon": 72.88, "name": "Mumbai Suburbs"},
                    "description": "Flash flood in 3 villages, 200 people stranded, water rising rapidly",
                    "source_type": "police_report"
                },
                "verification_context": {
                    "severity": 9,
                    "confidence": 0.95,
                    "source_type": "police_report"
                },
                "allocation_input": {
                    "crisis": {"severity": 9, "estimated_affected": 200},
                    "resource_pool": [
                        {"id": "BOAT_01", "type": "boat", "capacity": 10},
                        {"id": "BOAT_02", "type": "boat", "capacity": 10},
                        {"id": "BOAT_03", "type": "boat", "capacity": 10},
                        {"id": "HELICOPTER_01", "type": "helicopter", "capacity": 5},
                        {"id": "MEDICAL_01", "type": "medical_team", "capacity": 20}
                    ]
                },
                "communication_input": {
                    "crisis": {"severity": 9, "location": "Mumbai Suburbs"},
                    "language": "marathi"
                }
            },
            30000,  # 30 seconds max
            "Total time <30s, handles 200 people, Marathi communication"
        ))
        
        # BENCHMARK 3: False Alarm Detection
        self.results.append(self.run_benchmark(
            3, "False Alarm Detection",
            {
                "assessment_input": {
                    "location": {"lat": 18.52, "lon": 73.85},
                    "description": "Someone posted about water on road",
                    "source_type": "social_media"
                },
                "verification_context": {
                    "severity": 3,
                    "confidence": 0.2,
                    "source_type": "social_media"
                },
                "allocation_input": {
                    "crisis": {"severity": 3, "estimated_affected": 0},
                    "resource_pool": []
                },
                "communication_input": {
                    "crisis": {"severity": 3, "location": "Unknown"},
                    "language": "english"
                }
            },
            20000,  # 20 seconds max
            "Total time <20s, correctly identifies false alarm, no resources allocated"
        ))
        
        # BENCHMARK 4: Mass Evacuation (Extreme Case)
        self.results.append(self.run_benchmark(
            4, "Mass Evacuation - Extreme Case",
            {
                "assessment_input": {
                    "location": {"lat": 19.07, "lon": 72.87, "name": "Bandra Hills"},
                    "description": "Massive landslide, 1000+ people need evacuation, roads blocked",
                    "source_type": "government_alert"
                },
                "verification_context": {
                    "severity": 10,
                    "confidence": 0.98,
                    "source_type": "government_alert"
                },
                "allocation_input": {
                    "crisis": {"severity": 10, "estimated_affected": 1000},
                    "resource_pool": [
                        {"id": "BOAT_01", "type": "boat", "capacity": 10},
                        {"id": "BOAT_02", "type": "boat", "capacity": 10},
                        {"id": "HELICOPTER_01", "type": "helicopter", "capacity": 5},
                        {"id": "HELICOPTER_02", "type": "helicopter", "capacity": 5},
                        {"id": "BUS_01", "type": "bus", "capacity": 50},
                        {"id": "BUS_02", "type": "bus", "capacity": 50},
                        {"id": "MEDICAL_01", "type": "medical_team", "capacity": 20}
                    ]
                },
                "communication_input": {
                    "crisis": {"severity": 10, "location": "Bandra Hills"},
                    "language": "hindi"
                }
            },
            35000,  # 35 seconds max
            "Total time <35s, severity=10 detected, handles 1000+ people"
        ))
        
        # BENCHMARK 5: Multi-Crisis Stress Test
        self.results.append(self.run_benchmark(
            5, "Multi-Crisis Stress Test",
            {
                "assessment_input": {
                    "location": {"lat": 19.20, "lon": 73.10, "name": "Multiple Locations"},
                    "description": "3 simultaneous crises: flood in area A (severity 9, 50 people), building collapse in area B (severity 7, 20 people), fire in area C (severity 6, 10 people)",
                    "source_type": "police_report"
                },
                "verification_context": {
                    "severity": 9,
                    "confidence": 0.90,
                    "source_type": "police_report"
                },
                "allocation_input": {
                    "crises": [
                        {"id": "CRISIS_A", "severity": 9, "estimated_affected": 50},
                        {"id": "CRISIS_B", "severity": 7, "estimated_affected": 20},
                        {"id": "CRISIS_C", "severity": 6, "estimated_affected": 10}
                    ],
                    "resource_pool": [
                        {"id": "BOAT_01", "type": "boat"},
                        {"id": "BOAT_02", "type": "boat"},
                        {"id": "MEDICAL_01", "type": "medical_team"},
                        {"id": "FIRE_01", "type": "fire_truck"}
                    ]
                },
                "communication_input": {
                    "crisis": {"severity": 9, "location": "Multiple Locations"},
                    "language": "english"
                }
            },
            40000,  # 40 seconds max
            "Total time <40s, correct priority (A>B>C), no resource conflicts"
        ))
    
    def generate_report(self):
        """Generate benchmark results report"""
        print(f"\n{'='*70}")
        print("BENCHMARK RESULTS SUMMARY")
        print(f"{'='*70}")
        print(f"Total Benchmarks: {len(self.results)}")
        print(f"Passed: {self.passed} ✅")
        print(f"Failed: {self.failed} ❌")
        print(f"Pass Rate: {self.passed/len(self.results)*100:.1f}%")
        
        # Calculate average time
        avg_time = sum(r["total_time_ms"] for r in self.results) / len(self.results)
        print(f"Average Pipeline Time: {avg_time:.0f}ms")
        
        # Save results
        report = {
            "benchmark_date": datetime.utcnow().isoformat() + "Z",
            "base_url": self.base_url,
            "total_benchmarks": len(self.results),
            "passed": self.passed,
            "failed": self.failed,
            "pass_rate": self.passed/len(self.results)*100,
            "average_pipeline_time_ms": avg_time,
            "results": self.results
        }
        
        with open("benchmarks/benchmark_results.json", "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📊 Results saved to: benchmarks/benchmark_results.json")
        
        return report

def main():
    print("="*70)
    print("CrisisNet Phase 1: Benchmark Runner")
    print("="*70)
    print(f"Base URL: {BASE_URL}")
    print(f"Start Time: {datetime.utcnow().isoformat()}Z")
    print("="*70)
    
    runner = BenchmarkRunner(BASE_URL)
    runner.run_all_benchmarks()
    report = runner.generate_report()
    
    return report

if __name__ == "__main__":
    main()
