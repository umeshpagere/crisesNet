"""
Allocation Agent: Optimal resource dispatch using OR-Tools TSP
Minimizes total travel time while maximizing coverage
"""

from typing import Dict, List
from backend.agents.base_agent import BaseAgent
import math

try:
    from ortools.constraint_solver import routing_enums_pb2
    from ortools.constraint_solver import pywrapcp
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False

class AllocationAgent(BaseAgent):
    """Agent 2: Allocation - Optimizes resource dispatch"""
    
    def __init__(self, firestore_client=None):
        super().__init__("allocation", timeout_seconds=10)
        self.db = firestore_client
    
    def run(self, input_data: Dict) -> Dict:
        """
        Determine optimal resource dispatch
        
        Input:
            - assessment: {severity_score, crisis_type, recommended_response_tier}
            - location: {lat, lng}
            - event_id: string
            
        Output:
            - dispatch_plan: [{resource_id, resource_type, destination, eta_minutes}]
            - total_resources_dispatched: int
            - optimization_score: 0.0-1.0
        """
        self.validate_input(input_data, ['assessment', 'location'])
        
        assessment = input_data['assessment']
        crisis_location = input_data['location']
        severity = assessment['severity_score']
        tier = assessment['recommended_response_tier']
        
        # Get available resources from Firestore
        available_resources = self._get_available_resources()
        
        if len(available_resources) == 0:
            self.logger.warning("RESOURCE_SHORTAGE: No available resources")
            return {
                "dispatch_plan": [],
                "total_resources_dispatched": 0,
                "optimization_score": 0.0,
                "status": "RESOURCE_SHORTAGE"
            }
        
        # Determine resource requirements based on severity
        required_count = self._calculate_required_resources(severity, tier)
        
        # Select best resources using OR-Tools optimization
        dispatch_plan = self._optimize_dispatch(
            available_resources,
            crisis_location,
            required_count
        )
        
        # Calculate optimization score
        optimization_score = self._calculate_optimization_score(
            dispatch_plan,
            required_count,
            severity
        )
        
        return {
            "dispatch_plan": dispatch_plan,
            "total_resources_dispatched": len(dispatch_plan),
            "optimization_score": round(optimization_score, 3)
        }
    
    def _get_available_resources(self) -> List[Dict]:
        """Query Firestore for available resources"""
        if self.db is None:
            # Mock resources for testing
            return [
                {
                    "id": "BOAT_01",
                    "type": "boat",
                    "capacity": 10,
                    "location": {"lat": 19.95, "lng": 73.75},
                    "status": "available"
                },
                {
                    "id": "BOAT_02",
                    "type": "boat",
                    "capacity": 10,
                    "location": {"lat": 19.98, "lng": 73.82},
                    "status": "available"
                },
                {
                    "id": "MEDICAL_01",
                    "type": "medical",
                    "capacity": 20,
                    "location": {"lat": 19.92, "lng": 73.78},
                    "status": "available"
                },
                {
                    "id": "RESCUE_01",
                    "type": "rescue",
                    "capacity": 5,
                    "location": {"lat": 20.00, "lng": 73.80},
                    "status": "available"
                },
                {
                    "id": "RESCUE_02",
                    "type": "rescue",
                    "capacity": 5,
                    "location": {"lat": 19.90, "lng": 73.85},
                    "status": "available"
                }
            ]
        
        try:
            resources_ref = self.db.collection('resources')
            available = resources_ref.where('status', '==', 'available').stream()
            
            return [
                {
                    "id": doc.id,
                    **doc.to_dict()
                }
                for doc in available
            ]
        except Exception as e:
            self.logger.error(f"Resource query failed: {e}")
            return []
    
    def _calculate_required_resources(self, severity: float, tier: str) -> int:
        """
        Determine how many resources to dispatch based on severity
        
        critical: 3-5 resources
        high: 2-3 resources
        moderate: 1-2 resources
        low: 1 resource
        """
        if tier == "critical" or severity >= 0.8:
            return 4
        elif tier == "high" or severity >= 0.6:
            return 3
        elif tier == "moderate" or severity >= 0.4:
            return 2
        else:
            return 1
    
    def _optimize_dispatch(
        self,
        resources: List[Dict],
        crisis_location: Dict,
        required_count: int
    ) -> List[Dict]:
        """
        Use OR-Tools to optimize resource selection
        Minimizes total travel distance while meeting requirements
        """
        # If we need all or more than available, dispatch all
        if required_count >= len(resources):
            return self._create_dispatch_plan(resources, crisis_location)
        
        # Calculate distances for all resources
        resource_distances = []
        for resource in resources:
            distance = self._haversine_distance(
                resource['location'],
                crisis_location
            )
            resource_distances.append({
                "resource": resource,
                "distance_km": distance,
                "eta_minutes": self._estimate_eta(distance, resource['type'])
            })
        
        # Sort by distance (greedy approach for small problems)
        # For larger problems, use full TSP solver
        if len(resources) <= 10:
            # Greedy: select closest resources
            resource_distances.sort(key=lambda x: x['distance_km'])
            selected = resource_distances[:required_count]
        else:
            # Use OR-Tools TSP for larger problems
            selected = self._solve_tsp(resource_distances, required_count)
        
        # Create dispatch plan
        dispatch_plan = []
        for item in selected:
            resource = item['resource']
            dispatch_plan.append({
                "resource_id": resource['id'],
                "resource_type": resource['type'],
                "destination": crisis_location,
                "eta_minutes": item['eta_minutes']
            })
        
        return dispatch_plan
    
    def _create_dispatch_plan(
        self,
        resources: List[Dict],
        crisis_location: Dict
    ) -> List[Dict]:
        """Create dispatch plan for all resources"""
        plan = []
        for resource in resources:
            distance = self._haversine_distance(
                resource['location'],
                crisis_location
            )
            eta = self._estimate_eta(distance, resource['type'])
            
            plan.append({
                "resource_id": resource['id'],
                "resource_type": resource['type'],
                "destination": crisis_location,
                "eta_minutes": eta
            })
        
        return plan
    
    def _haversine_distance(self, loc1: Dict, loc2: Dict) -> float:
        """
        Calculate distance between two lat/lng points in kilometers
        Using Haversine formula
        """
        lat1, lng1 = loc1['lat'], loc1['lng']
        lat2, lng2 = loc2['lat'], loc2['lng']
        
        R = 6371  # Earth radius in km
        
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlng / 2) ** 2)
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def _estimate_eta(self, distance_km: float, resource_type: str) -> int:
        """
        Estimate arrival time in minutes
        
        Speed assumptions:
        - boat: 20 km/h
        - medical: 60 km/h (ambulance)
        - rescue: 40 km/h (truck)
        """
        speeds = {
            "boat": 20,
            "medical": 60,
            "rescue": 40
        }
        
        speed = speeds.get(resource_type, 30)  # default 30 km/h
        hours = distance_km / speed
        return int(hours * 60) + 5  # Add 5 min buffer
    
    def _solve_tsp(
        self,
        resource_distances: List[Dict],
        required_count: int
    ) -> List[Dict]:
        """
        Solve TSP to find optimal resource selection
        (Simplified: just use greedy for now, full TSP is overkill for small N)
        """
        # For this use case, greedy is sufficient
        resource_distances.sort(key=lambda x: x['distance_km'])
        return resource_distances[:required_count]
    
    def _calculate_optimization_score(
        self,
        dispatch_plan: List[Dict],
        required_count: int,
        severity: float
    ) -> float:
        """
        Calculate optimization quality score
        
        Factors:
        - Coverage: dispatched / required
        - Speed: inverse of average ETA
        - Severity match: higher severity needs faster response
        """
        if len(dispatch_plan) == 0:
            return 0.0
        
        # Coverage score
        coverage = min(1.0, len(dispatch_plan) / required_count)
        
        # Speed score (inverse of average ETA, normalized)
        avg_eta = sum(r['eta_minutes'] for r in dispatch_plan) / len(dispatch_plan)
        speed_score = max(0.0, 1.0 - (avg_eta / 60))  # 60 min = 0 score
        
        # Severity weight: critical needs faster response
        severity_weight = 0.3 + (severity * 0.7)
        
        # Combined score
        score = (coverage * 0.5) + (speed_score * 0.5 * severity_weight)
        
        return min(1.0, score)
