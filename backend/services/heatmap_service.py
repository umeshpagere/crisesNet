"""
Threat Heatmap Service
Computes crisis intensity heatmap with time decay and grid grouping
"""

import logging
import math
from typing import Dict, List, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger("crisisnet.heatmap")

class ThreatHeatmapService:
    """
    Generates threat heatmap from crisis events
    Uses time decay and spatial grid grouping
    """
    
    def __init__(self, firestore_client=None):
        """
        Initialize heatmap service
        
        Args:
            firestore_client: Firestore client instance
        """
        self.db = firestore_client
    
    def compute_heatmap(self, grid_resolution_km: float = 2.0) -> Dict:
        """
        Compute threat heatmap from recent crisis events
        
        Args:
            grid_resolution_km: Grid cell size in kilometers
            
        Returns:
            Heatmap with hotspots, bounding box, and metadata
        """
        # Get recent events (last 72 hours)
        events = self._get_recent_events(hours=72)
        
        if not events:
            return {
                "generated_at": datetime.utcnow().isoformat() + 'Z',
                "grid_resolution_km": grid_resolution_km,
                "hotspots": [],
                "total_active_events": 0,
                "bounding_box": {
                    "min_lat": 0, "max_lat": 0,
                    "min_lng": 0, "max_lng": 0
                }
            }
        
        # Build weighted grid
        grid = defaultdict(lambda: {
            'total_weight': 0.0,
            'event_count': 0,
            'crisis_types': defaultdict(int),
            'latest_timestamp': None,
            'latest_event_id': None
        })
        
        min_lat = min_lng = float('inf')
        max_lat = max_lng = float('-inf')
        
        for event in events:
            lat = event['lat']
            lng = event['lng']
            severity = event.get('severity_score', 0.5)
            crisis_type = event.get('crisis_type', 'other')
            event_id = event.get('event_id', 'unknown')
            timestamp = event.get('timestamp')
            
            # Update bounding box
            min_lat = min(min_lat, lat)
            max_lat = max(max_lat, lat)
            min_lng = min(min_lng, lng)
            max_lng = max(max_lng, lng)
            
            # Calculate time decay
            hours_elapsed = self._hours_since(timestamp)
            time_decay = math.exp(-hours_elapsed / 12)  # Half-life ~8.3 hours
            
            # Calculate weight
            weight = severity * time_decay
            
            # Assign to grid cell
            grid_key = self._get_grid_key(lat, lng, grid_resolution_km)
            
            cell = grid[grid_key]
            cell['total_weight'] += weight
            cell['event_count'] += 1
            cell['crisis_types'][crisis_type] += 1
            
            # Track latest event
            if cell['latest_timestamp'] is None or timestamp > cell['latest_timestamp']:
                cell['latest_timestamp'] = timestamp
                cell['latest_event_id'] = event_id
        
        # Normalize intensities
        max_weight = max((cell['total_weight'] for cell in grid.values()), default=1.0)
        
        # Build hotspots
        hotspots = []
        for grid_key, cell in grid.items():
            lat, lng = self._grid_key_to_coords(grid_key, grid_resolution_km)
            
            # Normalize intensity
            intensity = cell['total_weight'] / max_weight if max_weight > 0 else 0.0
            
            # Dominant crisis type
            dominant_type = max(cell['crisis_types'].items(), key=lambda x: x[1])[0]
            
            hotspots.append({
                'lat': lat,
                'lng': lng,
                'intensity': round(intensity, 3),
                'event_count': cell['event_count'],
                'dominant_crisis_type': dominant_type,
                'latest_event_id': cell['latest_event_id']
            })
        
        # Sort by intensity (highest first)
        hotspots.sort(key=lambda x: x['intensity'], reverse=True)
        
        return {
            "generated_at": datetime.utcnow().isoformat() + 'Z',
            "grid_resolution_km": grid_resolution_km,
            "hotspots": hotspots,
            "total_active_events": len(events),
            "bounding_box": {
                "min_lat": min_lat if min_lat != float('inf') else 0,
                "max_lat": max_lat if max_lat != float('-inf') else 0,
                "min_lng": min_lng if min_lng != float('inf') else 0,
                "max_lng": max_lng if max_lng != float('-inf') else 0
            }
        }
    
    def get_zone_risk_score(
        self,
        lat: float,
        lng: float,
        radius_km: float = 5.0
    ) -> Dict:
        """
        Calculate risk score for a specific zone
        
        Args:
            lat: Latitude
            lng: Longitude
            radius_km: Search radius in kilometers
            
        Returns:
            Risk assessment for the zone
        """
        # Get recent events
        events = self._get_recent_events(hours=72)
        
        # Find nearby events
        nearby_events = []
        for event in events:
            distance = self._haversine_km(
                lat, lng,
                event['lat'], event['lng']
            )
            
            if distance <= radius_km:
                nearby_events.append({
                    'event': event,
                    'distance_km': distance
                })
        
        if not nearby_events:
            return {
                "lat": lat,
                "lng": lng,
                "radius_km": radius_km,
                "risk_score": 0.0,
                "nearby_events": 0,
                "risk_level": "safe",
                "recommendation": "No active threats detected in this zone"
            }
        
        # Calculate risk score
        total_risk = 0.0
        for item in nearby_events:
            event = item['event']
            distance = item['distance_km']
            
            severity = event.get('severity_score', 0.5)
            hours_elapsed = self._hours_since(event.get('timestamp'))
            
            # Time decay
            time_factor = math.exp(-hours_elapsed / 12)
            
            # Distance decay (closer = higher risk)
            distance_factor = 1.0 - (distance / radius_km)
            
            risk_contribution = severity * time_factor * distance_factor
            total_risk += risk_contribution
        
        # Normalize risk score (0.0-1.0)
        risk_score = min(1.0, total_risk / len(nearby_events))
        
        # Determine risk level
        if risk_score >= 0.8:
            risk_level = "critical"
            recommendation = "EVACUATE IMMEDIATELY - Multiple high-severity threats detected"
        elif risk_score >= 0.6:
            risk_level = "high"
            recommendation = "High risk zone - Avoid entry, prepare evacuation"
        elif risk_score >= 0.4:
            risk_level = "moderate"
            recommendation = "Moderate risk - Exercise caution, monitor situation"
        elif risk_score >= 0.2:
            risk_level = "low"
            recommendation = "Low risk - Stay alert, follow local advisories"
        else:
            risk_level = "safe"
            recommendation = "Minimal risk - Normal operations permitted"
        
        return {
            "lat": lat,
            "lng": lng,
            "radius_km": radius_km,
            "risk_score": round(risk_score, 3),
            "nearby_events": len(nearby_events),
            "risk_level": risk_level,
            "recommendation": recommendation
        }
    
    def _get_recent_events(self, hours: int = 72) -> List[Dict]:
        """Get crisis events from last N hours"""
        if not self.db:
            logger.warning("Firestore not available, returning mock events")
            return self._get_mock_events()
        
        try:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            
            events_ref = self.db.collection('events')
            query = events_ref.where('timestamp', '>=', cutoff)
            
            events = []
            for doc in query.stream():
                data = doc.to_dict()
                
                # Extract location
                location = data.get('location', {})
                if not location or 'lat' not in location or 'lng' not in location:
                    continue
                
                events.append({
                    'event_id': doc.id,
                    'lat': location['lat'],
                    'lng': location['lng'],
                    'severity_score': data.get('severity_score', 0.5),
                    'crisis_type': data.get('crisis_type', 'other'),
                    'timestamp': data.get('timestamp', datetime.utcnow())
                })
            
            logger.info(f"Retrieved {len(events)} recent events")
            return events
            
        except Exception as e:
            logger.error(f"Failed to get recent events: {e}")
            return []
    
    def _get_mock_events(self) -> List[Dict]:
        """Return mock events for testing"""
        now = datetime.utcnow()
        return [
            {
                'event_id': 'event-001',
                'lat': 19.99,
                'lng': 73.78,
                'severity_score': 0.9,
                'crisis_type': 'flood',
                'timestamp': now - timedelta(hours=2)
            },
            {
                'event_id': 'event-002',
                'lat': 20.00,
                'lng': 73.79,
                'severity_score': 0.7,
                'crisis_type': 'flood',
                'timestamp': now - timedelta(hours=5)
            },
            {
                'event_id': 'event-003',
                'lat': 19.85,
                'lng': 73.65,
                'severity_score': 0.6,
                'crisis_type': 'medical',
                'timestamp': now - timedelta(hours=12)
            }
        ]
    
    def _get_grid_key(self, lat: float, lng: float, resolution_km: float) -> Tuple[int, int]:
        """
        Convert lat/lng to grid key
        
        Args:
            lat: Latitude
            lng: Longitude
            resolution_km: Grid cell size in km
            
        Returns:
            (grid_lat, grid_lng) tuple
        """
        # Approximate: 1 degree lat ≈ 111 km
        # 1 degree lng ≈ 111 * cos(lat) km
        
        degrees_per_cell_lat = resolution_km / 111.0
        degrees_per_cell_lng = resolution_km / (111.0 * math.cos(math.radians(lat)))
        
        grid_lat = int(lat / degrees_per_cell_lat)
        grid_lng = int(lng / degrees_per_cell_lng)
        
        return (grid_lat, grid_lng)
    
    def _grid_key_to_coords(self, grid_key: Tuple[int, int], resolution_km: float) -> Tuple[float, float]:
        """Convert grid key back to lat/lng (cell center)"""
        grid_lat, grid_lng = grid_key
        
        degrees_per_cell_lat = resolution_km / 111.0
        
        # Use approximate lat for lng calculation
        approx_lat = grid_lat * degrees_per_cell_lat
        degrees_per_cell_lng = resolution_km / (111.0 * math.cos(math.radians(approx_lat)))
        
        # Return cell center
        lat = (grid_lat + 0.5) * degrees_per_cell_lat
        lng = (grid_lng + 0.5) * degrees_per_cell_lng
        
        return (lat, lng)
    
    def _haversine_km(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """
        Calculate distance between two points using Haversine formula
        
        Args:
            lat1, lng1: First point
            lat2, lng2: Second point
            
        Returns:
            Distance in kilometers
        """
        R = 6371  # Earth radius in km
        
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlng / 2) ** 2)
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def _hours_since(self, timestamp) -> float:
        """Calculate hours elapsed since timestamp"""
        if timestamp is None:
            return 0.0
        
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        
        if not isinstance(timestamp, datetime):
            return 0.0
        
        # Make timezone-aware if needed
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=None)
            now = datetime.utcnow()
        else:
            now = datetime.now(timestamp.tzinfo)
        
        delta = now - timestamp
        return delta.total_seconds() / 3600.0
