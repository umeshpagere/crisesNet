"""
Assessment Agent: Triage incoming crisis reports and compute severity score
Uses Vertex AI with rule-based fallback
"""

from typing import Dict
from backend.agents.base_agent import BaseAgent
from backend.agents.vertex_client import vertex_client
import json

class AssessmentAgent(BaseAgent):
    """Agent 1: Assessment - Triages crisis reports"""
    
    def __init__(self):
        super().__init__("assessment", timeout_seconds=10)
        self._load_prompt_template()
    
    def _load_prompt_template(self):
        """Load assessment prompt template"""
        try:
            with open('agents/prompts/assessment_prompt.txt', 'r') as f:
                self.prompt_template = f.read()
        except FileNotFoundError:
            # Inline fallback template
            self.prompt_template = """Assess this crisis report and provide severity scoring.

Crisis Type: {crisis_type}
Reported Casualties: {casualties}
Description: {description}
Location: {location}

Provide assessment in JSON format:
{{
  "severity_score": 0.0-1.0,
  "crisis_type": "flood|earthquake|fire|medical|other",
  "confidence": 0.0-1.0,
  "recommended_response_tier": "critical|high|moderate|low",
  "reasoning": "brief explanation"
}}

Severity guidelines:
- 0.9-1.0: Mass casualty (50+ casualties), immediate threat to life
- 0.7-0.9: Critical (10-50 casualties), major infrastructure damage
- 0.5-0.7: High (5-10 casualties), significant damage
- 0.3-0.5: Moderate (1-5 casualties), localized impact
- 0.0-0.3: Low (0 casualties), minor incident

Respond with ONLY the JSON object, no additional text."""
    
    def run(self, input_data: Dict) -> Dict:
        """
        Assess crisis severity
        
        Input:
            - crisis_type: string
            - reported_casualties: int
            - description: string
            - location: {lat, lng}
            
        Output:
            - severity_score: 0.0-1.0
            - crisis_type: string
            - confidence: 0.0-1.0
            - recommended_response_tier: string
            - reasoning: string
        """
        self.validate_input(input_data, ['crisis_type', 'reported_casualties', 'location'])
        
        # Try Vertex AI first
        if vertex_client.is_available():
            ai_result = self._vertex_assessment(input_data)
            if ai_result:
                return ai_result
        
        # Fallback to rule-based scoring
        self.logger.info("Using rule-based fallback for assessment")
        return self._rule_based_assessment(input_data)
    
    def _vertex_assessment(self, input_data: Dict) -> Dict:
        """Use Vertex AI for assessment"""
        try:
            prompt = self.prompt_template.format(
                crisis_type=input_data['crisis_type'],
                casualties=input_data['reported_casualties'],
                description=input_data.get('description', 'No description provided'),
                location=input_data['location']
            )
            
            response = vertex_client.generate(
                prompt,
                temperature=0.2,
                max_output_tokens=512
            )
            
            if not response:
                return None
            
            # Parse JSON response
            # Clean markdown code blocks if present
            response = response.strip()
            if response.startswith('```'):
                response = response.split('```')[1]
                if response.startswith('json'):
                    response = response[4:]
            response = response.strip()
            
            result = json.loads(response)
            
            # Validate required fields
            required = ['severity_score', 'crisis_type', 'confidence',
                       'recommended_response_tier', 'reasoning']
            if all(k in result for k in required):
                # Ensure scores are in valid range
                result['severity_score'] = max(0.0, min(1.0, float(result['severity_score'])))
                result['confidence'] = max(0.0, min(1.0, float(result['confidence'])))
                return result
            
            return None
            
        except Exception as e:
            self.logger.warning(f"Vertex assessment failed: {e}")
            return None
    
    def _rule_based_assessment(self, input_data: Dict) -> Dict:
        """
        Rule-based fallback assessment
        
        Rules:
        - casualties > 50 → critical (0.9-1.0)
        - casualties 10-50 → critical (0.7-0.9)
        - casualties 5-10 → high (0.5-0.7)
        - casualties 1-5 → moderate (0.3-0.5)
        - casualties 0 → low (0.1-0.3)
        
        Crisis type modifiers:
        - earthquake, flood: +0.1 severity
        - fire, medical: +0.05 severity
        """
        casualties = input_data['reported_casualties']
        crisis_type = input_data['crisis_type'].lower()
        
        # Base severity from casualties
        if casualties >= 50:
            severity = 0.95
            tier = "critical"
        elif casualties >= 10:
            severity = 0.80
            tier = "critical"
        elif casualties >= 5:
            severity = 0.60
            tier = "high"
        elif casualties >= 1:
            severity = 0.40
            tier = "moderate"
        else:
            severity = 0.20
            tier = "low"
        
        # Crisis type modifiers
        if crisis_type in ['earthquake', 'flood']:
            severity = min(1.0, severity + 0.1)
        elif crisis_type in ['fire', 'medical']:
            severity = min(1.0, severity + 0.05)
        
        # Confidence is lower for rule-based (no AI context)
        confidence = 0.7
        
        reasoning = f"Rule-based assessment: {casualties} casualties, {crisis_type} type"
        
        return {
            "severity_score": round(severity, 2),
            "crisis_type": crisis_type,
            "confidence": confidence,
            "recommended_response_tier": tier,
            "reasoning": reasoning
        }
