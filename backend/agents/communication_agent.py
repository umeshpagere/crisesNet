"""
Communication Agent: Generate human-readable alerts for coordinators and victims
Uses Vertex AI with template fallback
"""

from typing import Dict
from backend.agents.base_agent import BaseAgent
from backend.agents.vertex_client import vertex_client
import json

class CommunicationAgent(BaseAgent):
    """Agent 3: Communication - Generates crisis alerts"""
    
    def __init__(self):
        super().__init__("communication", timeout_seconds=10)
        self._load_prompt_template()
    
    def _load_prompt_template(self):
        """Load communication prompt template"""
        try:
            with open('agents/prompts/communication_prompt.txt', 'r') as f:
                self.prompt_template = f.read()
        except FileNotFoundError:
            self.prompt_template = """Generate crisis communication alerts.

Crisis Type: {crisis_type}
Severity: {severity_score}
Location: {location}
Resources Dispatched: {resources_dispatched}
Estimated Arrival: {min_eta} minutes

Generate three alert messages in JSON format:
{{
  "coordinator_alert": "Action-focused message for NGO coordinators (max 500 chars)",
  "public_alert": "Clear, calm message for affected population (max 200 chars)",
  "sms_alert": "Ultra-concise SMS (max 160 chars)",
  "language": "en",
  "urgency_level": "IMMEDIATE|URGENT|ADVISORY"
}}

Guidelines:
- Use clear, direct language
- Avoid panic-inducing words
- Include specific actions
- State ETA and resource types
- IMMEDIATE: severity > 0.8
- URGENT: severity 0.5-0.8
- ADVISORY: severity < 0.5

Respond with ONLY the JSON object."""
    
    def run(self, input_data: Dict) -> Dict:
        """
        Generate crisis communication alerts
        
        Input:
            - assessment: {severity_score, crisis_type, recommended_response_tier}
            - allocation: {dispatch_plan, total_resources_dispatched}
            - location: {lat, lng} or location name string
            
        Output:
            - coordinator_alert: string (max 500 chars)
            - public_alert: string (max 200 chars)
            - sms_alert: string (max 160 chars)
            - language: string
            - urgency_level: string
        """
        self.validate_input(input_data, ['assessment', 'allocation'])
        
        # Try Vertex AI first
        if vertex_client.is_available():
            ai_result = self._vertex_communication(input_data)
            if ai_result and self._validate_output(ai_result):
                return ai_result
        
        # Fallback to template-based
        self.logger.info("Using template fallback for communication")
        return self._template_communication(input_data)
    
    def _vertex_communication(self, input_data: Dict) -> Dict:
        """Use Vertex AI to generate alerts"""
        try:
            assessment = input_data['assessment']
            allocation = input_data['allocation']
            
            # Calculate minimum ETA
            dispatch_plan = allocation.get('dispatch_plan', [])
            min_eta = min([r['eta_minutes'] for r in dispatch_plan]) if dispatch_plan else 0
            
            # Format location
            location = input_data.get('location', 'Unknown location')
            if isinstance(location, dict):
                location = f"{location.get('lat', 0):.2f}, {location.get('lng', 0):.2f}"
            
            prompt = self.prompt_template.format(
                crisis_type=assessment['crisis_type'],
                severity_score=assessment['severity_score'],
                location=location,
                resources_dispatched=allocation['total_resources_dispatched'],
                min_eta=min_eta
            )
            
            response = vertex_client.generate(
                prompt,
                temperature=0.3,
                max_output_tokens=512
            )
            
            if not response:
                return None
            
            # Parse JSON
            response = response.strip()
            if response.startswith('```'):
                response = response.split('```')[1]
                if response.startswith('json'):
                    response = response[4:]
            response = response.strip()
            
            result = json.loads(response)
            
            return result
            
        except Exception as e:
            self.logger.warning(f"Vertex communication failed: {e}")
            return None
    
    def _template_communication(self, input_data: Dict) -> Dict:
        """Template-based fallback communication"""
        assessment = input_data['assessment']
        allocation = input_data['allocation']
        
        severity = assessment['severity_score']
        crisis_type = assessment['crisis_type']
        tier = assessment['recommended_response_tier']
        resources = allocation['total_resources_dispatched']
        
        # Determine urgency
        if severity >= 0.8:
            urgency = "IMMEDIATE"
        elif severity >= 0.5:
            urgency = "URGENT"
        else:
            urgency = "ADVISORY"
        
        # Get location string
        location = input_data.get('location', 'affected area')
        if isinstance(location, dict):
            location = f"coordinates {location.get('lat', 0):.2f}, {location.get('lng', 0):.2f}"
        
        # Calculate ETA
        dispatch_plan = allocation.get('dispatch_plan', [])
        min_eta = min([r['eta_minutes'] for r in dispatch_plan]) if dispatch_plan else 30
        
        # Coordinator alert (action-focused, max 500 chars)
        coordinator_alert = (
            f"{urgency}: {crisis_type.upper()} at {location}. "
            f"Severity: {severity:.1f}/1.0. "
            f"{resources} resources dispatched, ETA {min_eta} min. "
            f"Response tier: {tier}. "
            f"Coordinate on-ground support and prepare medical facilities."
        )
        
        # Public alert (calm, clear, max 200 chars)
        public_alert = (
            f"{crisis_type.capitalize()} emergency at {location}. "
            f"Help is on the way. ETA {min_eta} minutes. "
            f"Stay calm and follow safety instructions."
        )
        
        # SMS alert (ultra-concise, max 160 chars)
        sms_alert = (
            f"{crisis_type.upper()}: {location}. "
            f"Help arriving in {min_eta}min. "
            f"Stay safe. Follow instructions."
        )
        
        # Ensure length limits
        coordinator_alert = coordinator_alert[:500]
        public_alert = public_alert[:200]
        sms_alert = sms_alert[:160]
        
        return {
            "coordinator_alert": coordinator_alert,
            "public_alert": public_alert,
            "sms_alert": sms_alert,
            "language": "en",
            "urgency_level": urgency
        }
    
    def _validate_output(self, output: Dict) -> bool:
        """Validate communication output meets requirements"""
        required_fields = [
            'coordinator_alert',
            'public_alert',
            'sms_alert',
            'language',
            'urgency_level'
        ]
        
        if not all(f in output for f in required_fields):
            return False
        
        # Check length limits
        if len(output['coordinator_alert']) > 500:
            return False
        if len(output['public_alert']) > 200:
            return False
        if len(output['sms_alert']) > 160:
            return False
        
        # Check urgency level
        if output['urgency_level'] not in ['IMMEDIATE', 'URGENT', 'ADVISORY']:
            return False
        
        return True
