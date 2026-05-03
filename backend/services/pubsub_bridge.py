"""
Pub/Sub Event Bridge for CrisisNet
Wraps google-cloud-pubsub for publishing crisis events
"""

import os
import json
import logging
from typing import Dict, Optional

try:
    from google.cloud import pubsub_v1
    PUBSUB_AVAILABLE = True
except ImportError:
    PUBSUB_AVAILABLE = False
    pubsub_v1 = None

logger = logging.getLogger("crisisnet.pubsub")

class PubSubBridge:
    """
    Pub/Sub integration for real-time event streaming
    
    Topics:
    - crisisnet-gps-updates: GPS location updates
    - crisisnet-crisis-events: New crisis events
    - crisisnet-hub-decisions: Decision Hub outputs
    - crisisnet-alerts: Generated alerts
    """
    
    TOPICS = [
        'crisisnet-gps-updates',
        'crisisnet-crisis-events',
        'crisisnet-hub-decisions',
        'crisisnet-alerts'
    ]
    
    def __init__(self, project_id: Optional[str] = None):
        """
        Initialize Pub/Sub bridge
        
        Args:
            project_id: GCP project ID (defaults to env var)
        """
        self.project_id = project_id or os.getenv('PUBSUB_PROJECT_ID', 'crisisnet-2026')
        self.publisher = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Pub/Sub publisher client"""
        if not PUBSUB_AVAILABLE:
            logger.warning("Pub/Sub not available, running in mock mode")
            return
        
        try:
            self.publisher = pubsub_v1.PublisherClient()
            logger.info(f"Pub/Sub publisher initialized for project: {self.project_id}")
        except Exception as e:
            logger.error(f"Failed to initialize Pub/Sub: {e}")
            self.publisher = None
    
    def create_topics_if_not_exist(self) -> Dict[str, bool]:
        """
        Create all required topics if they don't exist
        Idempotent operation
        
        Returns:
            Dict mapping topic names to creation status
        """
        if not self.publisher:
            logger.warning("Pub/Sub not available, skipping topic creation")
            return {topic: False for topic in self.TOPICS}
        
        results = {}
        
        for topic_name in self.TOPICS:
            topic_path = self.publisher.topic_path(self.project_id, topic_name)
            
            try:
                # Try to get topic (check if exists)
                self.publisher.get_topic(request={"topic": topic_path})
                results[topic_name] = False  # Already exists
                logger.info(f"Topic exists: {topic_name}")
            except Exception:
                # Topic doesn't exist, create it
                try:
                    self.publisher.create_topic(request={"name": topic_path})
                    results[topic_name] = True  # Created
                    logger.info(f"Topic created: {topic_name}")
                except Exception as e:
                    logger.error(f"Failed to create topic {topic_name}: {e}")
                    results[topic_name] = False
        
        return results
    
    def publish(self, topic_name: str, message_dict: Dict) -> Optional[str]:
        """
        Publish message to Pub/Sub topic
        
        Args:
            topic_name: Topic name (without project prefix)
            message_dict: Message data as dictionary
            
        Returns:
            Message ID if successful, None otherwise
        """
        if not self.publisher:
            logger.warning(f"Pub/Sub not available, mock publishing to {topic_name}")
            return f"mock-{topic_name}-{hash(json.dumps(message_dict))}"
        
        try:
            topic_path = self.publisher.topic_path(self.project_id, topic_name)
            
            # Convert dict to JSON bytes
            message_bytes = json.dumps(message_dict).encode('utf-8')
            
            # Publish message
            future = self.publisher.publish(topic_path, message_bytes)
            message_id = future.result(timeout=5.0)
            
            logger.info(f"Published to {topic_name}: {message_id}")
            return message_id
            
        except Exception as e:
            logger.error(f"Failed to publish to {topic_name}: {e}")
            return None
    
    def is_available(self) -> bool:
        """Check if Pub/Sub is available"""
        return self.publisher is not None


# Singleton instance
pubsub_bridge = PubSubBridge()
