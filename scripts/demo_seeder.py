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
            "multi_crisis": self._multi_crisis_scenario,
            "ngo_coordination": self._ngo_coordination_scenario,
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
    
    def _ngo_coordination_scenario(self) -> Dict[str, Any]:
        """
        Multi-NGO coordination scenario for the NGO Command Dashboard demo.

        Sets up:
          - 4 NGOs with distinct zones, colours and resource types
          - 6 crisis events across Nashik district (mix of flood + medical)
          - 12 resources (boats, medical, rescue teams) distributed across NGOs
          - 3 coverage gaps where no NGO is within 8 km
          - 4 crisis assignments (resource → crisis)
          - 2 coordination chat messages simulating NGO comms
          - 2 coverage zones (rough polygons around NGO staging areas)

        Returns a dict that can be serialised to JSON or POSTed to the API.
        """
        print("\n🤝 Generating NGO Coordination Scenario: Nashik Multi-Agency Response")

        ts = datetime.utcnow().isoformat() + "Z"

        # ------------------------------------------------------------------
        # 4 NGOs
        # ------------------------------------------------------------------
        ngos = [
            {
                "ngo_id": "NGO_RELIEF_INDIA",
                "name": "Relief India",
                "contact": "Priya Sharma",
                "zone": "Nashik",
                "resource_types": ["Boats", "Rescue Team"],
                "colour": "#f59e0b",
                "status": "online",
                "last_seen": ts,
            },
            {
                "ngo_id": "NGO_MEDAID_MH",
                "name": "MedAid Maharashtra",
                "contact": "Dr. Rajan Kulkarni",
                "zone": "Sinnar",
                "resource_types": ["Medical", "Food & Water"],
                "colour": "#3b82f6",
                "status": "online",
                "last_seen": ts,
            },
            {
                "ngo_id": "NGO_SHELTER_FIRST",
                "name": "Shelter First",
                "contact": "Anita Deshmukh",
                "zone": "Igatpuri",
                "resource_types": ["Shelter", "Food & Water"],
                "colour": "#10b981",
                "status": "online",
                "last_seen": ts,
            },
            {
                "ngo_id": "NGO_RAPID_RESCUE",
                "name": "Rapid Rescue Force",
                "contact": "Col. Suresh Patil",
                "zone": "Nandgaon",
                "resource_types": ["Rescue Team", "Boats"],
                "colour": "#8b5cf6",
                "status": "online",
                "last_seen": ts,
            },
        ]

        # ------------------------------------------------------------------
        # 6 crisis events
        # ------------------------------------------------------------------
        crises = [
            {"id": "NK-001", "type": "flood",   "severity": 9, "lat": 19.9975, "lng": 73.7898, "affected_count": 8,  "description": "Boat capsized near Godavari ghat", "status": "active", "timestamp": ts},
            {"id": "NK-002", "type": "medical", "severity": 6, "lat": 19.847,  "lng": 73.999,  "affected_count": 47, "description": "Mass illness outbreak — contaminated water", "status": "active", "timestamp": ts},
            {"id": "NK-003", "type": "flood",   "severity": 4, "lat": 20.012,  "lng": 73.765,  "affected_count": 23, "description": "Rising water level, families on rooftops", "status": "active", "timestamp": ts},
            {"id": "NK-004", "type": "flood",   "severity": 7, "lat": 19.780,  "lng": 73.920,  "affected_count": 31, "description": "Sinnar bridge submerged, village cut off", "status": "active", "timestamp": ts},
            {"id": "NK-005", "type": "medical", "severity": 5, "lat": 20.055,  "lng": 73.680,  "affected_count": 18, "description": "Elderly persons require evacuation", "status": "active", "timestamp": ts},
            {"id": "NK-006", "type": "flood",   "severity": 8, "lat": 19.910,  "lng": 74.050,  "affected_count": 62, "description": "Dam overflow, downstream villages at risk", "status": "active", "timestamp": ts},
        ]

        # ------------------------------------------------------------------
        # 12 resources
        # ------------------------------------------------------------------
        resources = [
            # Relief India — boats and rescue
            {"resource_id": "BOAT_NK_01", "ngo_id": "NGO_RELIEF_INDIA", "type": "boat",   "name": "Rescue Boat Alpha", "capacity": 12, "lat": 19.9850, "lng": 73.7800, "status": "deployed",  "assigned_crisis_id": "NK-001", "battery_pct": 82,  "speed": 12, "heading": 45,  "updated_at": ts},
            {"resource_id": "BOAT_NK_02", "ngo_id": "NGO_RELIEF_INDIA", "type": "boat",   "name": "Rescue Boat Beta",  "capacity": 12, "lat": 20.010,  "lng": 73.760,  "status": "deployed",  "assigned_crisis_id": "NK-003", "battery_pct": 67,  "speed": 8,  "heading": 270, "updated_at": ts},
            {"resource_id": "BOAT_NK_03", "ngo_id": "NGO_RELIEF_INDIA", "type": "boat",   "name": "Rescue Boat Gamma", "capacity": 8,  "lat": 19.995,  "lng": 73.795,  "status": "available", "assigned_crisis_id": None,     "battery_pct": 100, "speed": 0,  "heading": 0,   "updated_at": ts},
            {"resource_id": "TEAM_RI_01", "ngo_id": "NGO_RELIEF_INDIA", "type": "rescue", "name": "Rescue Team 1",     "capacity": 6,  "lat": 19.990,  "lng": 73.785,  "status": "available", "assigned_crisis_id": None,     "battery_pct": 100, "speed": 0,  "heading": 0,   "updated_at": ts},
            # MedAid — medical and food
            {"resource_id": "MED_MA_01",  "ngo_id": "NGO_MEDAID_MH",    "type": "medical","name": "Medical Unit Alpha", "capacity": 20, "lat": 19.840,  "lng": 73.990,  "status": "deployed",  "assigned_crisis_id": "NK-002", "battery_pct": 75,  "speed": 0,  "heading": 0,   "updated_at": ts},
            {"resource_id": "MED_MA_02",  "ngo_id": "NGO_MEDAID_MH",    "type": "medical","name": "Medical Unit Beta",  "capacity": 20, "lat": 19.850,  "lng": 73.980,  "status": "available", "assigned_crisis_id": None,     "battery_pct": 90,  "speed": 0,  "heading": 0,   "updated_at": ts},
            {"resource_id": "FOOD_MA_01", "ngo_id": "NGO_MEDAID_MH",    "type": "food",   "name": "Food Supply Van 1",  "capacity": 200,"lat": 19.855,  "lng": 73.975,  "status": "available", "assigned_crisis_id": None,     "battery_pct": 100, "speed": 0,  "heading": 0,   "updated_at": ts},
            # Shelter First
            {"resource_id": "SHLT_SF_01", "ngo_id": "NGO_SHELTER_FIRST","type": "shelter","name": "Shelter Unit A",     "capacity": 50, "lat": 20.040,  "lng": 73.665,  "status": "deployed",  "assigned_crisis_id": "NK-005", "battery_pct": 100, "speed": 0,  "heading": 0,   "updated_at": ts},
            {"resource_id": "FOOD_SF_01", "ngo_id": "NGO_SHELTER_FIRST","type": "food",   "name": "Food Van Igatpuri",  "capacity": 150,"lat": 20.050,  "lng": 73.670,  "status": "available", "assigned_crisis_id": None,     "battery_pct": 100, "speed": 0,  "heading": 0,   "updated_at": ts},
            # Rapid Rescue Force
            {"resource_id": "BOAT_RR_01", "ngo_id": "NGO_RAPID_RESCUE", "type": "boat",   "name": "Heavy Rescue Vessel","capacity": 20, "lat": 19.905,  "lng": 74.045,  "status": "deployed",  "assigned_crisis_id": "NK-006", "battery_pct": 55,  "speed": 15, "heading": 90,  "updated_at": ts},
            {"resource_id": "TEAM_RR_01", "ngo_id": "NGO_RAPID_RESCUE", "type": "rescue", "name": "Rapid Response Team", "capacity": 10, "lat": 19.915,  "lng": 74.040,  "status": "deployed",  "assigned_crisis_id": "NK-006", "battery_pct": 80,  "speed": 0,  "heading": 0,   "updated_at": ts},
            {"resource_id": "TEAM_RR_02", "ngo_id": "NGO_RAPID_RESCUE", "type": "rescue", "name": "Dive Rescue Team",    "capacity": 6,  "lat": 19.780,  "lng": 73.925,  "status": "deployed",  "assigned_crisis_id": "NK-004", "battery_pct": 70,  "speed": 0,  "heading": 0,   "updated_at": ts},
        ]

        # ------------------------------------------------------------------
        # 4 crisis assignments
        # ------------------------------------------------------------------
        assignments = [
            {"crisis_id": "NK-001", "resource_id": "BOAT_NK_01", "ngo_id": "NGO_RELIEF_INDIA",  "eta_minutes": 3,  "status": "on_site",  "assigned_at": ts},
            {"crisis_id": "NK-002", "resource_id": "MED_MA_01",  "ngo_id": "NGO_MEDAID_MH",    "eta_minutes": 0,  "status": "on_site",  "assigned_at": ts},
            {"crisis_id": "NK-003", "resource_id": "BOAT_NK_02", "ngo_id": "NGO_RELIEF_INDIA",  "eta_minutes": 8,  "status": "en_route", "assigned_at": ts},
            {"crisis_id": "NK-006", "resource_id": "BOAT_RR_01", "ngo_id": "NGO_RAPID_RESCUE",  "eta_minutes": 5,  "status": "en_route", "assigned_at": ts},
        ]

        # ------------------------------------------------------------------
        # 3 coverage gaps (high-priority unserved areas)
        # ------------------------------------------------------------------
        gaps = [
            {"lat": 19.847, "lng": 73.999, "crisis_id": "NK-002", "crisis_type": "medical", "crisis_severity": 6, "affected_people": 47, "distance_to_nearest_km": 8.2, "priority_score": 9.1},
            {"lat": 19.780, "lng": 73.920, "crisis_id": "NK-004", "crisis_type": "flood",   "crisis_severity": 7, "affected_people": 31, "distance_to_nearest_km": 6.5, "priority_score": 7.8},
            {"lat": 19.910, "lng": 74.050, "crisis_id": "NK-006", "crisis_type": "flood",   "crisis_severity": 8, "affected_people": 62, "distance_to_nearest_km": 4.1, "priority_score": 8.9},
        ]

        # ------------------------------------------------------------------
        # 2 NGO coverage zone polygons
        # ------------------------------------------------------------------
        coverage_zones = [
            {
                "zone_id": "ZONE_RI_NASHIK",
                "ngo_id": "NGO_RELIEF_INDIA",
                "zone_name": "Nashik River Corridor",
                "polygon_coords": [[19.95, 73.75], [20.05, 73.75], [20.05, 73.85], [19.95, 73.85]],
            },
            {
                "zone_id": "ZONE_RR_EAST",
                "ngo_id": "NGO_RAPID_RESCUE",
                "zone_name": "Eastern Nashik",
                "polygon_coords": [[19.87, 73.99], [19.95, 73.99], [19.95, 74.10], [19.87, 74.10]],
            },
        ]

        # ------------------------------------------------------------------
        # 2 coord chat messages
        # ------------------------------------------------------------------
        chat_messages = [
            {
                "ngo_id": "NGO_RELIEF_INDIA", "ngo_name": "Relief India", "ngo_colour": "#f59e0b",
                "message": "BOAT_NK_01 on site at NK-001. 8 rescued, returning for second run. ETA 12 min.",
                "timestamp": ts, "type": "human",
            },
            {
                "ngo_id": "NGO_MEDAID_MH", "ngo_name": "MedAid Maharashtra", "ngo_colour": "#3b82f6",
                "message": "MED_MA_01 treating 47 at NK-002. Need food supplies — can Shelter First assist?",
                "timestamp": ts, "type": "human",
            },
        ]

        scenario_data = {
            "scenario": "ngo_coordination",
            "crisis_type": "multi",
            "severity": "critical",
            "generated_at": ts,
            "ngos": ngos,
            "victims": [
                {"type": c["type"], "severity": c["severity"],
                 "location": {"lat": c["lat"], "lng": c["lng"]},
                 "description": c["description"]}
                for c in crises
            ],
            "crises": crises,
            "resources": resources,
            "assignments": assignments,
            "coverage_gaps": gaps,
            "coverage_zones": coverage_zones,
            "chat_messages": chat_messages,
            "responders": [
                {"id": r["resource_id"], "type": r["type"], "ngo_id": r["ngo_id"],
                 "location": {"lat": r["lat"], "lng": r["lng"]},
                 "status": r["status"]}
                for r in resources
            ],
        }

        # ── Mutual Aid Requests ────────────────────────────────────────────
        mutual_aid_requests = [
            {
                "request_id": "MAR_001",
                "from_ngo": "NGO_RELIEF_INDIA",
                "to_ngo": "NGO_MEDAID_MH",
                "resource_type": "medical",
                "quantity": 2,
                "crisis_id": "NK-002",
                "message": "Medical emergency cluster — need extra units",
                "status": "accepted",
                "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat() + "Z",
                "updated_at": (datetime.utcnow() - timedelta(minutes=30)).isoformat() + "Z",
            },
            {
                "request_id": "MAR_002",
                "from_ngo": "NGO_SHELTER_FIRST",
                "to_ngo": "NGO_RELIEF_INDIA",
                "resource_type": "boat",
                "quantity": 1,
                "crisis_id": "NK-004",
                "message": "Flood evacuation — need boat urgently",
                "status": "pending",
                "created_at": (datetime.utcnow() - timedelta(minutes=20)).isoformat() + "Z",
                "updated_at": (datetime.utcnow() - timedelta(minutes=20)).isoformat() + "Z",
            },
            {
                "request_id": "MAR_003",
                "from_ngo": "NGO_RAPID_RESCUE",
                "to_ngo": "NGO_SHELTER_FIRST",
                "resource_type": "shelter",
                "quantity": 1,
                "crisis_id": "NK-006",
                "message": "Dam overflow — need shelter units for 200 displaced",
                "status": "pending",
                "created_at": (datetime.utcnow() - timedelta(minutes=5)).isoformat() + "Z",
                "updated_at": (datetime.utcnow() - timedelta(minutes=5)).isoformat() + "Z",
            },
        ]
        if db:
            for req in mutual_aid_requests:
                db.collection("mutual_aid_requests").document(req["request_id"]).set(req)

        scenario_data["mutual_aid_requests"] = mutual_aid_requests

        print(f"   NGOs: {len(ngos)}")
        print(f"   Crises: {len(crises)}")
        print(f"   Resources: {len(resources)}")
        print(f"   Assignments: {len(assignments)}")
        print(f"   Coverage Gaps: {len(gaps)}")
        print(f"   Mutual Aid Requests: {len(mutual_aid_requests)}")
        print(f"   Chat Messages: {len(chat_messages)}")

        return scenario_data

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
        choices=["flood_nashik", "earthquake_mumbai", "fire_pune", "multi_crisis", "ngo_coordination"],
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
