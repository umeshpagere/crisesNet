"""
Verification Agent: Cross-validate crisis reports to reduce false alarms
Target: Reduce false alarms from ~25% to <5%
"""

from typing import Dict
from backend.agents.base_agent import BaseAgent
from backend.agents.vertex_client import vertex_client
import math

class VerificationAgent(BaseAgent):
    """Agent 5: Verification - Cross-validates crisis reports"""
    
    def __init__(self, firestore_client=None):
        super().__init__("verification", timeout_seconds=10)
        self.db = firestore_client
    
    def run(self, input_data: Dict) -> Dict:
        """
        Verify crisis report authenticity
        
        Input:
            - location: {lat, lng}
            - reporter_id: string
            - crisis_type: string
            - description: string (optional)
            
        Output:
            - verified: bool
            - confidence: 0.0-1.0
            - corroborating_sources: int
            - false_alarm_probability: 0.0-1.0
            - verification_method: string
        """
        self.validate_input(input_data, ['location', 'reporter_id'])
        
        location = input_data['location']
        reporter_id = input_data['reporter_id']
        crisis_type = input_data.get('crisis_type', 'unknown')
        
        # Query historical data for corroboration
        corroborating_sources = self._check_historical_corroboration(
            location, crisis_type
        )
        
        # Check reporter credibility
        reporter_history = self._get_reporter_history(reporter_id)
        
        # Calculate false alarm probability
        false_alarm_prob = self._calculate_false_alarm_probability(
            corroborating_sources,
            reporter_history
        )
        
        # Determine verification status
        verified = false_alarm_prob < 0.5
        confidence = 1.0 - false_alarm_prob
        
        # Try Vertex AI for pattern matching if available
        verification_method = "rule_based"
        if vertex_client.is_available() and input_data.get('description'):
            ai_verification = self._vertex_pattern_matching(input_data)
            if ai_verification is not None:
                # Blend AI and rule-based scores
                confidence = (confidence + ai_verification) / 2
                verified = confidence > 0.5
                verification_method = "ai_pattern_matching"
        
        # Use multi-source if we have corroboration
        if corroborating_sources >= 2:
            verification_method = "multi_source"
        elif corroborating_sources == 1 and reporter_history >= 3:
            verification_method = "historical_pattern"
        
        return {
            "verified": verified,
            "confidence": round(confidence, 3),
            "corroborating_sources": corroborating_sources,
            "false_alarm_probability": round(false_alarm_prob, 3),
            "verification_method": verification_method
        }
    
    def _check_historical_corroboration(
        self,
        location: Dict,
        crisis_type: str
    ) -> int:
        """
        Check for past events in same geographic zone (±0.05 degrees)
        within last 24 hours
        """
        if self.db is None:
            # Mock mode: return 0 for testing
            return 0
        
        try:
            lat = location['lat']
            lng = location['lng']
            
            # Bounding box: ±0.05 degrees (~5.5 km)
            lat_min, lat_max = lat - 0.05, lat + 0.05
            lng_min, lng_max = lng - 0.05, lng + 0.05
            
            # Query Firestore for recent events in zone
            # Note: Firestore doesn't support geo queries natively,
            # so we filter in memory (acceptable for small datasets)
            events_ref = self.db.collection('events')
            
            # Get events from last 24 hours
            from datetime import datetime, timedelta
            cutoff = datetime.utcnow() - timedelta(hours=24)
            
            recent_events = events_ref.where(
                'timestamp', '>=', cutoff
            ).stream()
            
            corroborating = 0
            for event in recent_events:
                data = event.to_dict()
                event_lat = data.get('location', {}).get('lat')
                event_lng = data.get('location', {}).get('lng')
                
                if event_lat and event_lng:
                    if (lat_min <= event_lat <= lat_max and
                        lng_min <= event_lng <= lng_max):
                        # Same crisis type increases corroboration
                        if data.get('crisis_type') == crisis_type:
                            corroborating += 1
            
            return corroborating
            
        except Exception as e:
            self.logger.error(f"Historical corroboration failed: {e}")
            return 0
    
    def _get_reporter_history(self, reporter_id: str) -> int:
        """Get number of past reports from this reporter"""
        if self.db is None:
            return 0
        
        try:
            reports = self.db.collection('events').where(
                'reporter_id', '==', reporter_id
            ).stream()
            
            return len(list(reports))
        except Exception as e:
            self.logger.error(f"Reporter history check failed: {e}")
            return 0
    
    def _calculate_false_alarm_probability(
        self,
        corroborating_sources: int,
        reporter_history: int
    ) -> float:
        """
        Calculate false alarm probability using heuristics
        
        Logic:
        - 0 corroborating sources + new reporter (< 3 reports) = HIGH risk (0.8)
        - 1 corroborating source = MEDIUM risk (0.4)
        - 2+ corroborating sources = LOW risk (0.1)
        - Trusted reporter (5+ reports) reduces risk by 0.2
        """
        base_prob = 0.8  # Start pessimistic
        
        # Corroboration reduces risk significantly
        if corroborating_sources >= 3:
            base_prob = 0.05
        elif corroborating_sources == 2:
            base_prob = 0.15
        elif corroborating_sources == 1:
            base_prob = 0.4
        
        # Reporter credibility adjustment
        if reporter_history >= 5:
            base_prob -= 0.2
        elif reporter_history >= 3:
            base_prob -= 0.1
        
        return max(0.0, min(1.0, base_prob))
    
    def _vertex_pattern_matching(self, input_data: Dict) -> float:
        """
        Use Vertex AI to detect crisis patterns
        Returns confidence score 0.0-1.0 or None if failed
        """
        try:
            prompt = f"""Analyze this crisis report for authenticity.

Crisis Type: {input_data.get('crisis_type', 'unknown')}
Description: {input_data.get('description', 'No description')}
Location: {input_data['location']}

Assess if this is a genuine crisis or potential false alarm.
Consider: specificity of details, urgency indicators, coherence.

Respond with ONLY a confidence score between 0.0 (definitely false alarm) and 1.0 (definitely genuine).
Example: 0.85"""

            response = vertex_client.generate(
                prompt,
                temperature=0.1,
                max_output_tokens=10
            )
            
            if response:
                # Parse confidence score
                score = float(response.strip())
                return max(0.0, min(1.0, score))
            
            return None
            
        except Exception as e:
            self.logger.warning(f"Vertex pattern matching failed: {e}")
            return None
