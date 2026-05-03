"""
Vertex AI Client Singleton for CrisisNet
Shared client for Gemini 1.5 Flash model
"""

import os
import logging
from typing import Optional

try:
    import vertexai
    from vertexai.generative_models import GenerativeModel, GenerationConfig
    VERTEXAI_AVAILABLE = True
except ImportError:
    VERTEXAI_AVAILABLE = False
    GenerativeModel = None
    GenerationConfig = None

logger = logging.getLogger("crisisnet.vertex")

class VertexAIClient:
    """Singleton client for Vertex AI / Gemini"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.project_id = os.getenv('VERTEX_PROJECT_ID', 'crisisnet-2026')
            self.location = os.getenv('VERTEX_LOCATION', 'us-central1')
            self.model_name = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')
            self.model = None
            self._initialize()
            VertexAIClient._initialized = True
    
    def _initialize(self):
        """Initialize Vertex AI and model"""
        if not VERTEXAI_AVAILABLE:
            logger.warning("Vertex AI module not available, running in mock mode")
            self.model = None
            return
            
        try:
            vertexai.init(project=self.project_id, location=self.location)
            self.model = GenerativeModel(self.model_name)
            logger.info(f"Vertex AI initialized: {self.model_name} in {self.location}")
        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI: {str(e)}")
            self.model = None
    
    def generate(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_output_tokens: int = 1024,
        top_p: float = 0.8,
        top_k: int = 40
    ) -> Optional[str]:
        """
        Generate text using Gemini model
        
        Args:
            prompt: Input prompt text
            temperature: Sampling temperature (0.0-1.0)
            max_output_tokens: Maximum tokens to generate
            top_p: Nucleus sampling parameter
            top_k: Top-k sampling parameter
            
        Returns:
            Generated text or None if failed
        """
        if self.model is None:
            logger.warning("Vertex AI not available, returning None")
            return None
        
        try:
            if not VERTEXAI_AVAILABLE or GenerationConfig is None:
                return None
                
            generation_config = GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                top_p=top_p,
                top_k=top_k
            )
            
            response = self.model.generate_content(
                prompt,
                generation_config=generation_config
            )
            
            if response and response.text:
                return response.text.strip()
            else:
                logger.warning("Empty response from Vertex AI")
                return None
                
        except Exception as e:
            logger.error(f"Vertex AI generation failed: {str(e)}")
            return None
    
    def is_available(self) -> bool:
        """Check if Vertex AI is available"""
        return self.model is not None


# Singleton instance
vertex_client = VertexAIClient()
