"""
Base Agent Class for CrisisNet Multi-Agent System
Provides common infrastructure for all agents
"""

from abc import ABC, abstractmethod
import time
import logging
from typing import Dict, Tuple

logging.basicConfig(level=logging.INFO)

class BaseAgent(ABC):
    """Abstract base class for all CrisisNet agents"""
    
    def __init__(self, name: str, timeout_seconds: int = 10):
        """
        Initialize base agent
        
        Args:
            name: Agent identifier
            timeout_seconds: Maximum execution time
        """
        self.name = name
        self.timeout = timeout_seconds
        self.logger = logging.getLogger(f"crisisnet.agent.{name}")
        self.logger.setLevel(logging.INFO)

    @abstractmethod
    def run(self, input_data: Dict) -> Dict:
        """
        Execute agent logic
        
        Args:
            input_data: Agent-specific input dictionary
            
        Returns:
            Agent-specific output dictionary
        """
        pass

    def run_with_timing(self, input_data: Dict) -> Tuple[Dict, int]:
        """
        Execute agent with timing measurement
        
        Args:
            input_data: Agent-specific input dictionary
            
        Returns:
            Tuple of (output dictionary, elapsed milliseconds)
        """
        start = time.time()
        try:
            result = self.run(input_data)
            elapsed_ms = int((time.time() - start) * 1000)
            self.logger.info(f"{self.name} completed in {elapsed_ms}ms")
            return result, elapsed_ms
        except Exception as e:
            elapsed_ms = int((time.time() - start) * 1000)
            self.logger.error(f"{self.name} failed after {elapsed_ms}ms: {str(e)}")
            raise

    def validate_input(self, input_data: Dict, required_fields: list) -> None:
        """
        Validate required input fields
        
        Args:
            input_data: Input dictionary to validate
            required_fields: List of required field names
            
        Raises:
            ValueError: If required fields are missing
        """
        missing = [f for f in required_fields if f not in input_data]
        if missing:
            raise ValueError(f"{self.name}: Missing required fields: {missing}")
