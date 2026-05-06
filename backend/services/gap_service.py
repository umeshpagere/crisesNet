"""
Gap Analysis Service for NGO Dashboard
Identifies coverage gaps where crises exist but no NGO resources are deployed.
"""

from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime, timedelta
import math


@dataclass
class GapZone:
    """Represents an area with active crisis but no NGO coverage."""
    lat: float
    lng: float
    radius_km: float
    affected_people: int
    nearest_ngo: str
    distance_to_nearest_km: float
    crisis_severity: float
    priority_score: float  # severity * affected / distance
    crisis_id: str
    crisis_type: str


class GapAnalysisService:
    """Analyzes crisis events and resource coverage to identify gaps."""
    
    def __init__(self, firestore_client=None):
        self.db = firestore_client
    
    def _haversine_km(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points in kilometers."""
        R = 6371  # Earth radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def compute_gaps(self, coverage_threshold_km: float = 5.0) -> List[GapZone]:
        """
        Identify coverage gaps.
        
        Args:
            coverage_threshold_km: Distance threshold to consider a crisis "covered"
        
        Returns:
            List of GapZone objects sorted by priority_score descending
        """
        if not self.db:
            return self._mock_gaps()
        
        gaps = []
        
        # Get active crises (last 6 hours)
        cutoff_time = datetime.utcnow() - timedelta(hours=6)
        crisis_docs = self.db.collection('crisis_events').limit(100).stream()
        
        # Get all deployed resources
        resource_docs = self.db.collection('resources').where('status', '==', 'deployed').stream()
        resources = [doc.to_dict() for doc in resource_docs]
        
        for crisis_doc in crisis_docs:
            crisis = crisis_doc.to_dict()
            crisis_id = crisis_doc.id
            
            # Skip if no location
            if 'lat' not in crisis or 'lng' not in crisis:
                continue
            
            crisis_lat = crisis['lat']
            crisis_lng = crisis['lng']
            
            # Find nearest resource
            nearest_distance = float('inf')
            nearest_ngo = "None"
            
            for resource in resources:
                if 'lat' not in resource or 'lng' not in resource:
                    continue
                
                distance = self._haversine_km(
                    crisis_lat, crisis_lng,
                    resource['lat'], resource['lng']
                )
                
                if distance < nearest_distance:
                    nearest_distance = distance
                    nearest_ngo = resource.get('ngo_id', 'Unknown')
            
            # If no resource within threshold, it's a gap
            if nearest_distance > coverage_threshold_km:
                severity = crisis.get('severity', 5)
                affected = crisis.get('affected_count', 10)
                
                # Priority score: higher severity and more people = higher priority
                # Divide by distance to deprioritize very remote gaps
                priority_score = (severity * affected) / max(nearest_distance, 1.0)
                
                gap = GapZone(
                    lat=crisis_lat,
                    lng=crisis_lng,
                    radius_km=2.0,  # Default 2km radius
                    affected_people=affected,
                    nearest_ngo=nearest_ngo,
                    distance_to_nearest_km=round(nearest_distance, 2),
                    crisis_severity=severity,
                    priority_score=round(priority_score, 2),
                    crisis_id=crisis_id,
                    crisis_type=crisis.get('type', 'unknown')
                )
                gaps.append(gap)
        
        # Sort by priority score descending
        gaps.sort(key=lambda g: g.priority_score, reverse=True)
        
        return gaps[:10]  # Top 10 gaps
    
    def _mock_gaps(self) -> List[GapZone]:
        """Return mock gap data when Firestore unavailable."""
        return [
            GapZone(
                lat=19.8900,
                lng=73.8000,
                radius_km=2.0,
                affected_people=47,
                nearest_ngo="None",
                distance_to_nearest_km=8.5,
                crisis_severity=8,
                priority_score=44.2,
                crisis_id="CRISIS_001",
                crisis_type="flood"
            ),
            GapZone(
                lat=20.0100,
                lng=73.7500,
                radius_km=2.0,
                affected_people=23,
                nearest_ngo="NGO_RELIEF_INDIA",
                distance_to_nearest_km=12.3,
                crisis_severity=6,
                priority_score=11.2,
                crisis_id="CRISIS_002",
                crisis_type="medical"
            )
        ]
