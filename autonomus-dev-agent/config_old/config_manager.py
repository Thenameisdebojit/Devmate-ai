"""
System Configuration Manager
Manages global system settings, API keys, and environment variables.
"""

import os
import logging
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator, ConfigDict  # Updated imports

# Load environment variables
load_dotenv()


class SystemConfig(BaseModel):
    """Global system configuration"""
    
    # Pydantic V2 configuration
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    # API Keys
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    anthropic_api_key: str = Field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    google_api_key: str = Field(default_factory=lambda: os.getenv("GOOGLE_API_KEY", ""))
    
    # Docker settings
    docker_registry: str = Field(default_factory=lambda: os.getenv("DOCKER_REGISTRY", "localhost:5000"))
    docker_username: str = Field(default_factory=lambda: os.getenv("DOCKER_USERNAME", ""))
    docker_password: str = Field(default_factory=lambda: os.getenv("DOCKER_PASSWORD", ""))
    
    # Kubernetes settings
    kubeconfig_path: str = Field(default_factory=lambda: os.getenv("KUBECONFIG_PATH", "~/.kube/config"))
    k8s_namespace: str = Field(default_factory=lambda: os.getenv("K8S_NAMESPACE", "dev-agent-apps"))
    
    # System limits
    max_tokens: int = Field(default_factory=lambda: int(os.getenv("MAX_TOKENS_PER_REQUEST", "8000")))
    max_iterations: int = Field(default_factory=lambda: int(os.getenv("MAX_ITERATIONS", "10")))
    timeout_seconds: int = Field(default_factory=lambda: int(os.getenv("TIMEOUT_SECONDS", "300")))
    max_concurrent_agents: int = Field(default_factory=lambda: int(os.getenv("MAX_CONCURRENT_AGENTS", "5")))
    
    # Feature flags
    enable_validation: bool = Field(default_factory=lambda: os.getenv("ENABLE_VALIDATION", "true").lower() == "true")
    enable_auto_deploy: bool = Field(default_factory=lambda: os.getenv("ENABLE_AUTO_DEPLOY", "false").lower() == "true")
    enable_streaming: bool = Field(default_factory=lambda: os.getenv("ENABLE_STREAMING", "true").lower() == "true")
    enable_summarization: bool = Field(default_factory=lambda: os.getenv("ENABLE_SUMMARIZATION", "true").lower() == "true")
    
    # Checkpointing
    checkpoint_frequency: int = Field(default_factory=lambda: int(os.getenv("CHECKPOINT_FREQUENCY", "5")))
    
    # Logging
    log_level: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    log_file: str = Field(default_factory=lambda: os.getenv("LOG_FILE", "logs/agent_system.log"))
    
    # Paths
    artifacts_dir: Path = Field(default=Path("artifacts"))
    logs_dir: Path = Field(default=Path("logs"))
    
    @field_validator("log_level")  # Changed from @validator to @field_validator
    @classmethod  # Added classmethod decorator
    def validate_log_level(cls, v):
        """Validate log level"""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.upper()
    
    def validate_api_keys(self) -> bool:
        """Validate that required API keys are set"""
        # Updated to check for OpenAI OR Google (since we're using Gemini now)
        return bool(self.openai_api_key and (self.google_api_key or self.anthropic_api_key))
    
    def setup_logging(self):
        """Setup logging configuration"""
        # Create logs directory if it doesn't exist
        self.logs_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, self.log_level),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler()
            ]
        )
    
    def setup_directories(self):
        """Create necessary directories"""
        self.artifacts_dir.mkdir(exist_ok=True)
        self.logs_dir.mkdir(exist_ok=True)
    
    def get_model_config(self, role: str) -> dict:
        """Get model configuration for a specific role"""
        from .tech_stack import FRAMEWORK_CONFIG
        return FRAMEWORK_CONFIG.model_configs.get(role, {})


# Global config instance
CONFIG = SystemConfig()

# Setup logging and directories on import
CONFIG.setup_logging()
CONFIG.setup_directories()
