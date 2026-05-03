"""
Demo Data Seeder for CrisisNet Hackathon

Seeds realistic demo data for live demonstration:
- Crisis events (floods, earthquakes, fires)
- Victim reports with GPS coordinates
- Responder locations and availability
- Real-time event injection

Usage:
    python3 demo_seeder.py --scenario flood_nashik
    python3 demo_seeder.py --scenario earthquake_mumbai
    python3 demo_seeder.py --live-inject --interval 5
"""

import argparse
import json
import time
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any


class DemoSeeder:
    """Demo data seeder for CrisisNet"""
    
    def __init__(self):
        self.scenarios = {
            "flood_nashik": self._flood_nashik_scenario,
            "earthquake_mumbai": self._earthquake_mumbai_scenario,
            "fire_pune": self._fire_pune_scenario,
            "multi_crisis": self._multi_crisis_scenario
        }
        
        # Nashik coordinates
        self.nashik_center = {"lat": 19.9975, "lng": 73.7898}
        
        # Mumbai coordinates
        self.mumbai_center = {"lat": 19.0760, "lng": 72.8777}
        
        # Pune coordinates
        self.pune_center = {"lat": 18.5204, "lng": 73.8567}
    
    def _generate_nearby_location(self, center: Dict, radius_km: float = 5.0) -> Dict:
        """Generate random location near center point"""
        # Approximate: 1 degree ≈ 111 km
        lat_offset = (random.random() - 0.5) * (radius_km / 111.0) * 2
        lng_offset = (random.random() - 0.5) * (radius_km / 111.0) * 2
        
        return {
            "lat": round(center["lat"] + lat_offset, 6),
            "lng": round(center["lng"] + lng_offset, 6)
        }
    
    def _flood_nashik_scenario(self) -> Dict[str, Any]:
        """Flood scenario in Nashik riverside area"""
        print("\n🌊 Generating Flood Scenario: Nashik Riverside")
        
        # 15 victims trapped in flooded areas
        victims = []
        for i in range(15):
            loc = self._generate_nearby_location(self.nashik_center, radius_km=3.0)
            victims.append({
                "id": f"flood_victim_{i+1}",
                "type": "flood",
                "severity": random.choice(["critical", "critical", "high", "high", "moderate"]),
                "location": loc,
                "timestamp": (datetime.utcnow() - timedelta(minutes=random.randint(5, 30))).isoformat() + "Z",
                "description": random.choice([
                    "Trapped on roof, water rising fast",
                    "Family of 4 stranded, need immediate rescue",
                    "Elderly person unable to evacuate",
                    "Children trapped in flooded building",
                    "Water level at chest height, need help"
                ]),
                "reporter_type": "victim",
                "victim_count": random.randint(1, 5)
            })
        
        # 5 rescue boats (responders)
        responders = []
        for i in range(5):
            loc = self._generate_nearby_location(self.nashik_center, radius_km=2.0)
            responders.append({
                "id": f"rescue_boat_{i+1}",
                "type": "rescue_boat",
                "location": loc,
                "capacity": random.choice([5, 7, 10]),
                "status": "available",
                "equipment": ["life_jackets", "medical_kit", "rope", "radio"],
                "crew_size": random.randint(2, 4)
            })
        
        return {
            "scenario": "flood_nashik",
            "description": "Severe flooding in Nashik riverside area",
            "crisis_type": "flood",
            "severity": "critical",
            "location": self.nashik_center,
            "victims": victims,
            "responders": responders,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    
    def _earthquake_mumbai_scenario(self) -> Dict[str, Any]:
        """Earthquake scenario in Mumbai"""
        print("\n🏚️ Generating Earthquake Scenario: Mumbai")
        
        # 20 victims in collapsed buildings
        victims = []
        for i in range(20):
            loc = self._generate_nearby_location(self.mumbai_center, radius_km=5.0)
            victims.append({
                "id": f"earthquake_victim_{i+1}",
                "type": "earthquake",
                "severity": random.choice(["critical", "high", "high", "moderate"]),
                "location": loc,
                "timestamp": (datetime.utcnow() - timedelta(minutes=random.randint(10, 60))).isoformat() + "Z",
                "description": random.choice([
                    "Building collapsed, people trapped under rubble",
                    "Injured person needs medical attention",
                    "Gas leak detected, immediate evacuation needed",
                    "Structural damage, building unsafe",
                    "Multiple casualties, urgent help required"
                ]),
                "reporter_type": random.choice(["victim", "witness", "responder"]),
                "victim_count": random.randint(1, 8)
            })
        
        # 8 rescue teams
        responders = []
        for i in range(8):
            loc = self._generate_nearby_location(self.mumbai_center, radius_km=3.0)
            responders.append({
                "id": f"rescue_team_{i+1}",
                "type": "search_and_rescue",
                "location": loc,
                "capacity": random.choice([3, 5, 7]),
                "status": "available",
                "equipment": ["thermal_camera", "cutting_tools", "medical_kit", "dogs"],
                "crew_size": random.randint(4, 8)
            })
        
        return {
            "scenario": "earthquake_mumbai",
            "description": "Major earthquake in Mumbai metropolitan area",
            "crisis_type": "earthquake",
            "severity": "critical",
            "location": self.mumbai_center,
            "victims": victims,
            "responders": responders,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    
    def _fire_pune_scenario(self) -> Dict[str, Any]:
        """Fire scenario in Pune"""
        print("\n🔥 Generating Fire Scenario: Pune")
        
        # 10 victims in fire zones
        victims = []
        for i in range(10):
            loc = self._generate_nearby_location(self.pune_center, radius_km=2.0)
            victims.append({
                "id": f"fire_victim_{i+1}",
                "type": "fire",
                "severity": random.choice(["critical", "high", "moderate"]),
                "location": loc,
                "timestamp": (datetime.utcnow() - timedelta(minutes=random.randint(5, 20))).isoformat() + "Z",
                "description": random.choice([
                    "Apartment fire, smoke inhalation victims",
                    "Trapped in burning building, 3rd floor",
                    "Industrial fire, chemical hazard",
                    "Forest fire spreading, evacuation needed",
                    "Residential fire, elderly unable to evacuate"
                ]),
                "reporter_type": random.choice(["victim", "witness"]),
                "victim_count": random.randint(1, 6)
            })
        
        # 4 fire trucks
        responders = []
        for i in range(4):
            loc = self._generate_nearby_location(self.pune_center, radius_km=1.5)
            responders.append({
                "id": f"fire_truck_{i+1}",
                "type": "fire_rescue",
                "location": loc,
                "capacity": random.choice([4, 6, 8]),
                "status": "available",
                "equipment": ["ladder", "hose", "breathing_apparatus", "medical_kit"],
                "crew_size": random.randint(4, 6)
            })
        
        return {
            "scenario": "fire_pune",
            "description": "Multiple fire incidents in Pune city",
            "crisis_type": "fire",
            "severity": "high",
            "location": self.pune_center,
            "victims": victims,
            "responders": responders,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    
    def _multi_crisis_scenario(self) -> Dict[str, Any]:
        """Multi-crisis scenario combining all types"""
        print("\n⚠️ Generating Multi-Crisis Scenario")
        
        all_victims = []
        all_responders = []
        
        # Add some victims from each crisis type
        flood_data = self._flood_nashik_scenario()
        earthquake_data = self._earthquake_mumbai_scenario()
        fire_data = self._fire_pune_scenario()
        
        all_victims.extend(flood_data["victims"][:5])
        all_victims.extend(earthquake_data["victims"][:8])
        all_victims.extend(fire_data["victims"][:4])
        
        all_responders.extend(flood_data["responders"][:2])
        all_responders.extend(earthquake_data["responders"][:3])
        all_responders.extend(fire_data["responders"][:2])
        
        return {
            "scenario": "multi_crisis",
            "description": "Multiple simultaneous crises across Maharashtra",
            "crisis_type": "multi",
            "severity": "critical",
            "location": self.mumbai_center,  # Central coordination point
            "victims": all_victims,
            "responders": all_responders,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    
    def seed_scenario(self, scenario_name: str) -> Dict[str, Any]:
        """Seed a specific scenario"""
        if scenario_name not in self.scenarios:
            raise ValueError(f"Unknown scenario: {scenario_name}. Available: {list(self.scenarios.keys())}")
        
        print(f"\n{'='*80}")
        print(f"SEEDING DEMO SCENARIO: {scenario_name.upper()}")
        print(f"{'='*80}")
        
        data = self.scenarios[scenario_name]()
        
        print(f"\n✅ Scenario generated:")
        print(f"   Victims: {len(data['victims'])}")
        print(f"   Responders: {len(data['responders'])}")
        print(f"   Crisis Type: {data['crisis_type']}")
        print(f"   Severity: {data['severity']}")
        
        return data
    
    def save_scenario(self, data: Dict[str, Any], filename: str = None):
        """Save scenario data to JSON file"""
        if filename is None:
            filename = f"demo_data_{data['scenario']}_{int(time.time())}.json"
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n💾 Scenario saved to: {filename}")
        return filename
    
    def inject_live_events(self, scenario_name: str, interval_seconds: int = 5, duration_minutes: int = 5):
        """Inject events in real-time for live demo"""
        print(f"\n{'='*80}")
        print(f"LIVE EVENT INJECTION: {scenario_name.upper()}")
        print(f"{'='*80}")
        print(f"Interval: {interval_seconds}s | Duration: {duration_minutes}min")
        print(f"Press Ctrl+C to stop\n")
        
        data = self.scenarios[scenario_name]()
        victims = data["victims"]
        
        start_time = time.time()
        end_time = start_time + (duration_minutes * 60)
        event_count = 0
        
        try:
            while time.time() < end_time:
                # Pick random victim to inject
                victim = random.choice(victims)
                
                print(f"[{datetime.now().strftime('%H:%M:%S')}] 🚨 Event #{event_count + 1}: "
                      f"{victim['type'].upper()} - {victim['severity']} severity")
                print(f"   Location: ({victim['location']['lat']:.4f}, {victim['location']['lng']:.4f})")
                print(f"   Description: {victim['description'][:60]}...")
                
                # In real implementation, would POST to API here
                # requests.post("http://localhost:8080/api/reports", json=victim)
                
                event_count += 1
                time.sleep(interval_seconds)
        
        except KeyboardInterrupt:
            print(f"\n\n⏹️  Injection stopped. Total events injected: {event_count}")
        
        print(f"\n✅ Live injection complete: {event_count} events in {int(time.time() - start_time)}s")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="CrisisNet Demo Data Seeder")
    parser.add_argument(
        "--scenario",
        choices=["flood_nashik", "earthquake_mumbai", "fire_pune", "multi_crisis"],
        default="flood_nashik",
        help="Demo scenario to seed"
    )
    parser.add_argument(
        "--live-inject",
        action="store_true",
        help="Inject events in real-time for live demo"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="Interval between events (seconds) for live injection"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=5,
        help="Duration of live injection (minutes)"
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output filename for scenario data"
    )
    
    args = parser.parse_args()
    
    seeder = DemoSeeder()
    
    if args.live_inject:
        seeder.inject_live_events(args.scenario, args.interval, args.duration)
    else:
        data = seeder.seed_scenario(args.scenario)
        seeder.save_scenario(data, args.output)
    
    print("\n" + "="*80)
    print("✅ DEMO SEEDER COMPLETE")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
