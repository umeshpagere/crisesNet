"""
GPS Location Ingestion Service
Handles boat tracking, location history, and real-time updates
"""

import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from backend.services.pubsub_bridge import pubsub_bridge

logger = logging.getLogger("crisisnet.gps")

class GPSIngestionService:
    """
    GPS tracking service for rescue boats
    Validates, stores, and streams location updates
    """
    
    def __init__(self, firestore_client=None):
        """
        Initialize GPS service
        
        Args:
            firestore_client: Firestore client instance
        """
        self.db = firestore_client
        self.pubsub = pubsub_bridge
    
    def ingest_location_update(self, update: Dict) -> Dict:
        """
        Ingest GPS location update
        
        Args:
            update: {
                boat_id, lat, lng, speed_knots, heading_degrees,
                battery_pct, timestamp
            }
            
        Returns:
            {status, boat_id, published}
        """
        # Validate update
        self._validate_update(update)
        
        boat_id = update['boat_id']
        timestamp_str = update['timestamp']
        
        # Parse timestamp
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except Exception:
            timestamp = datetime.utcnow()
        
        # Write to Firestore
        if self.db:
            try:
                # Update boat snapshot
                boat_ref = self.db.collection('boats').document(boat_id)
                boat_ref.set({
                    'boat_id': boat_id,
                    'name': update.get('name', f'Boat {boat_id}'),
                    'type': update.get('type', 'rescue'),
                    'status': 'active',
                    'last_lat': update['lat'],
                    'last_lng': update['lng'],
                    'last_seen': timestamp,
                    'battery_pct': update['battery_pct'],
                    'speed_knots': update['speed_knots'],
                    'heading_degrees': update['heading_degrees'],
                    'assigned_zone': update.get('assigned_zone'),
                    'updated_at': datetime.utcnow()
                }, merge=True)
                
                # Add to locations subcollection
                boat_ref.collection('locations').add({
                    'lat': update['lat'],
                    'lng': update['lng'],
                    'speed_knots': update['speed_knots'],
                    'heading_degrees': update['heading_degrees'],
                    'battery_pct': update['battery_pct'],
                    'timestamp': timestamp
                })
                
                logger.info(f"Stored location for boat {boat_id}")
            except Exception as e:
                logger.error(f"Failed to write to Firestore: {e}")
        
        # Publish to Pub/Sub
        published = False
        message_id = self.pubsub.publish('crisisnet-gps-updates', update)
        if message_id:
            published = True
        
        return {
            "status": "ok",
            "boat_id": boat_id,
            "published": published
        }
    
    def _validate_update(self, update: Dict):
        """
        Validate GPS update schema
        
        Raises:
            ValueError: If validation fails
        """
        required_fields = [
            'boat_id', 'lat', 'lng', 'speed_knots',
            'heading_degrees', 'battery_pct', 'timestamp'
        ]
        
        # Check required fields
        missing = [f for f in required_fields if f not in update]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")
        
        # Validate lat/lng
        lat = update['lat']
        lng = update['lng']
        
        if not isinstance(lat, (int, float)) or not (-90 <= lat <= 90):
            raise ValueError(f"Invalid latitude: {lat} (must be -90 to 90)")
        
        if not isinstance(lng, (int, float)) or not (-180 <= lng <= 180):
            raise ValueError(f"Invalid longitude: {lng} (must be -180 to 180)")
        
        # Validate speed
        speed = update['speed_knots']
        if not isinstance(speed, (int, float)) or not (0 <= speed <= 50):
            raise ValueError(f"Invalid speed: {speed} (must be 0-50 knots)")
        
        # Validate heading
        heading = update['heading_degrees']
        if not isinstance(heading, int) or not (0 <= heading <= 359):
            raise ValueError(f"Invalid heading: {heading} (must be 0-359 degrees)")
        
        # Validate battery
        battery = update['battery_pct']
        if not isinstance(battery, int) or not (0 <= battery <= 100):
            raise ValueError(f"Invalid battery: {battery} (must be 0-100%)")
    
    def get_boat_trail(
        self,
        boat_id: str,
        last_n_minutes: int = 30
    ) -> List[Dict]:
        """
        Get location history for a boat
        
        Args:
            boat_id: Boat identifier
            last_n_minutes: Time window for history
            
        Returns:
            List of location points (max 500, downsampled if needed)
        """
        if not self.db:
            logger.warning("Firestore not available, returning empty trail")
            return []
        
        try:
            # Calculate cutoff time
            cutoff = datetime.utcnow() - timedelta(minutes=last_n_minutes)
            
            # Query locations subcollection
            locations_ref = self.db.collection('boats').document(boat_id).collection('locations')
            
            query = locations_ref.where('timestamp', '>=', cutoff).order_by('timestamp', direction='ASCENDING')
            
            docs = list(query.stream())
            
            # Convert to list
            trail = []
            for doc in docs:
                data = doc.to_dict()
                trail.append({
                    'lat': data['lat'],
                    'lng': data['lng'],
                    'speed_knots': data.get('speed_knots', 0),
                    'heading_degrees': data.get('heading_degrees', 0),
                    'battery_pct': data.get('battery_pct', 100),
                    'timestamp': data['timestamp'].isoformat() if hasattr(data['timestamp'], 'isoformat') else str(data['timestamp'])
                })
            
            # Downsample if > 500 points
            if len(trail) > 500:
                step = len(trail) // 500
                trail = trail[::step][:500]
            
            logger.info(f"Retrieved {len(trail)} points for boat {boat_id}")
            return trail
            
        except Exception as e:
            logger.error(f"Failed to get boat trail: {e}")
            return []
    
    def get_all_active_boats(
        self,
        stale_threshold_minutes: int = 10
    ) -> List[Dict]:
        """
        Get all active boats with recent updates
        
        Args:
            stale_threshold_minutes: Minutes before marking boat as stale
            
        Returns:
            List of boat objects with status
        """
        if not self.db:
            logger.warning("Firestore not available, returning mock boats")
            return self._get_mock_boats()
        
        try:
            boats_ref = self.db.collection('boats')
            all_boats = boats_ref.stream()
            
            cutoff = datetime.utcnow() - timedelta(minutes=stale_threshold_minutes)
            
            active_boats = []
            for doc in all_boats:
                data = doc.to_dict()
                
                # Check last_seen
                last_seen = data.get('last_seen')
                if not last_seen:
                    continue
                
                # Convert to datetime if needed
                if isinstance(last_seen, str):
                    last_seen = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
                
                # Determine status
                if last_seen < cutoff:
                    data['status'] = 'stale'
                else:
                    data['status'] = 'active'
                
                # Format timestamp
                data['last_seen'] = last_seen.isoformat() if hasattr(last_seen, 'isoformat') else str(last_seen)
                
                active_boats.append(data)
            
            logger.info(f"Retrieved {len(active_boats)} boats")
            return active_boats
            
        except Exception as e:
            logger.error(f"Failed to get active boats: {e}")
            return []
    
    def _get_mock_boats(self) -> List[Dict]:
        """Return mock boats for testing"""
        return [
            {
                'boat_id': 'BOAT_01',
                'name': 'Rescue Alpha',
                'type': 'rescue',
                'status': 'active',
                'last_lat': 19.99,
                'last_lng': 73.78,
                'last_seen': datetime.utcnow().isoformat(),
                'battery_pct': 85,
                'speed_knots': 12.5,
                'heading_degrees': 45,
                'assigned_zone': None
            },
            {
                'boat_id': 'BOAT_02',
                'name': 'Medical Beta',
                'type': 'medical',
                'status': 'active',
                'last_lat': 20.01,
                'last_lng': 73.80,
                'last_seen': datetime.utcnow().isoformat(),
                'battery_pct': 92,
                'speed_knots': 8.3,
                'heading_degrees': 180,
                'assigned_zone': 'Zone A'
            }
        ]
