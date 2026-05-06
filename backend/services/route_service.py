"""
Route Planning Service
Computes optimal route from a resource to a crisis using Haversine distance.
Returns waypoints, distance in km, and estimated ETA in minutes.
"""

import math
import logging
from typing import Dict, List, Optional

logger = logging.getLogger("crisisnet.route")

AVG_SPEED_KMH = 15.0   # default boat / rescue team speed


class RouteService:
    """Simple Haversine-based route planner."""

    def __init__(self, firestore_client=None):
        self.db = firestore_client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def plan_route(
        self,
        resource_id: str,
        crisis_id: str,
        speed_kmh: float = AVG_SPEED_KMH,
    ) -> Dict:
        """
        Compute a direct route between a resource and a crisis event.

        Returns:
            {
                resource_id, crisis_id, distance_km, eta_minutes,
                speed_kmh, waypoints: [{lat, lng, label}]
            }
        """
        resource = self._get_resource(resource_id)
        crisis   = self._get_crisis(crisis_id)

        if resource is None:
            return {"error": f"Resource '{resource_id}' not found"}, 404
        if crisis is None:
            return {"error": f"Crisis '{crisis_id}' not found"}, 404

        r_lat, r_lng = resource["lat"], resource["lng"]
        c_lat, c_lng = crisis["lat"],   crisis["lng"]

        distance_km = self._haversine_km(r_lat, r_lng, c_lat, c_lng)
        eta_min     = (distance_km / speed_kmh) * 60.0

        waypoints = self._build_waypoints(r_lat, r_lng, c_lat, c_lng, resource, crisis)

        return {
            "resource_id":   resource_id,
            "resource_name": resource.get("name", resource_id),
            "crisis_id":     crisis_id,
            "crisis_type":   crisis.get("type", "unknown"),
            "distance_km":   round(distance_km, 2),
            "eta_minutes":   round(eta_min, 1),
            "speed_kmh":     speed_kmh,
            "waypoints":     waypoints,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_waypoints(
        self,
        r_lat: float, r_lng: float,
        c_lat: float, c_lng: float,
        resource: Dict,
        crisis: Dict,
        intermediate_count: int = 3,
    ) -> List[Dict]:
        """Build intermediate waypoints along the straight-line path."""
        waypoints = [
            {
                "lat":   r_lat,
                "lng":   r_lng,
                "label": f"🚀 Start: {resource.get('name', 'Resource')}",
                "type":  "start",
            }
        ]
        for i in range(1, intermediate_count + 1):
            fraction = i / (intermediate_count + 1)
            waypoints.append({
                "lat":   round(r_lat + fraction * (c_lat - r_lat), 6),
                "lng":   round(r_lng + fraction * (c_lng - r_lng), 6),
                "label": f"Waypoint {i}",
                "type":  "intermediate",
            })
        waypoints.append({
            "lat":   c_lat,
            "lng":   c_lng,
            "label": f"🎯 Crisis: {crisis.get('type', '').upper()} — {crisis.get('description', '')[:40]}",
            "type":  "destination",
        })
        return waypoints

    def _get_resource(self, resource_id: str) -> Optional[Dict]:
        if self.db:
            doc = self.db.collection("resources").document(resource_id).get()
            return doc.to_dict() if doc.exists else None
        return self._mock_resource(resource_id)

    def _get_crisis(self, crisis_id: str) -> Optional[Dict]:
        if self.db:
            doc = self.db.collection("crises").document(crisis_id).get()
            return doc.to_dict() if doc.exists else None
        return self._mock_crisis(crisis_id)

    def _mock_resource(self, resource_id: str) -> Optional[Dict]:
        mocks = {
            "BOAT_NK_01": {"lat": 19.985, "lng": 73.780, "name": "Rescue Boat Alpha", "type": "boat"},
            "BOAT_NK_02": {"lat": 20.010, "lng": 73.760, "name": "Rescue Boat Beta",  "type": "boat"},
            "MED_MA_01":  {"lat": 19.840, "lng": 73.990, "name": "Medical Unit Alpha","type": "medical"},
        }
        return mocks.get(resource_id)

    def _mock_crisis(self, crisis_id: str) -> Optional[Dict]:
        mocks = {
            "NK-001": {"lat": 19.9975, "lng": 73.7898, "type": "flood",   "description": "Boat capsized near Godavari ghat"},
            "NK-002": {"lat": 19.847,  "lng": 73.999,  "type": "medical", "description": "Mass illness outbreak"},
            "NK-003": {"lat": 20.012,  "lng": 73.765,  "type": "flood",   "description": "Rising water level"},
            "NK-004": {"lat": 19.780,  "lng": 73.920,  "type": "flood",   "description": "Sinnar bridge submerged"},
            "NK-006": {"lat": 19.910,  "lng": 74.050,  "type": "flood",   "description": "Dam overflow"},
        }
        return mocks.get(crisis_id)

    @staticmethod
    def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlng / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
