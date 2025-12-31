"""
Configuration for the Autonomous Deep AI Agent - Complete Phase 4
"""

import os
from dataclasses import dataclass
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    """Main configuration class"""
    
    # API Keys
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
    github_token: str = os.getenv("GITHUB_TOKEN", "")
    vercel_token: str = os.getenv("VERCEL_TOKEN", "")
    netlify_token: str = os.getenv("NETLIFY_TOKEN", "")
    
    # Model Settings
    default_model: str = "models/gemini-1.5-flash"
    thinking_model: str = "models/gemini-1.5-flash"
    fast_model: str = "models/gemini-1.5-flash"
    
    # Generation Settings
    max_tokens: int = 8192
    temperature: float = 0.7
    
    # Phase 4: Testing Settings
    enable_testing: bool = True
    enable_security_scan: bool = True
    enable_performance_profiling: bool = False
    enable_integration_tests: bool = True
    
    # Phase 4: Optimization Settings
    enable_auto_refactor: bool = True
    enable_performance_optimization: bool = False
    enable_dependency_optimization: bool = False
    refactor_max_attempts: int = 2
    
    # Phase 4: Human Oversight Settings
    enable_human_approval: bool = False
    auto_approve: bool = True
    collect_feedback: bool = False
    interactive_feedback: bool = False
    enable_interventions: bool = False
    
    # Phase 4: Project Management Settings
    enable_templates: bool = True
    save_as_template: bool = False
    enable_git: bool = True
    create_github_repo: bool = False
    enable_deployment: bool = True
    auto_deploy: bool = False
    deployment_platform: str = "vercel"
    
    # Quality Thresholds
    min_validation_score: int = 60
    max_security_risk: int = 40
    min_performance_score: int = 70
    
    # Output Settings
    output_dir: str = "artifacts"
    debug_mode: bool = os.getenv("DEBUG_MODE", "false").lower() == "true"
    
    def __post_init__(self):
        """Validate configuration"""
        if not self.google_api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")


class FrameworkConfig:
    """Framework-specific configurations"""
    
    model_configs: Dict[str, Dict[str, Any]] = {
        "planning": {
            "model": "models/gemini-1.5-flash",  # ← FIXED: Use stable model
            "temperature": 0.5,
            "max_tokens": 8192,
            "top_p": 0.85,
        },
        "code": {
            "model": "models/gemini-1.5-flash",  # ← FIXED
            "temperature": 0.7,
            "max_tokens": 8192,
            "top_p": 0.9,
        },
        "validation": {
            "model": "models/gemini-1.5-flash",  # ← FIXED: Use stable model
            "temperature": 0.3,
            "max_tokens": 8192,
            "top_p": 0.85,
        },
        "validation_fallback": {
            "model": "models/gemini-1.5-flash",
            "temperature": 0.3,
            "max_tokens": 8192,
            "top_p": 0.85,
        },
        "testing": {
            "model": "models/gemini-1.5-flash",
            "temperature": 0.3,
            "max_tokens": 8192,
            "top_p": 0.85,
        },
        "security": {
            "model": "models/gemini-1.5-flash",
            "temperature": 0.2,
            "max_tokens": 4096,
            "top_p": 0.8,
        },
        "refactor": {
            "model": "models/gemini-1.5-flash",
            "temperature": 0.2,
            "max_tokens": 8192,
            "top_p": 0.85,
        },
    }
    
    supported_frameworks = {
        "frontend": ["react", "nextjs", "vue", "angular", "svelte"],
        "backend": ["nodejs-express", "fastapi", "django", "flask", "nestjs"],
        "mobile": ["flutter", "react-native"],
        "database": ["mongodb", "postgresql", "mysql", "sqlite", "redis"],
    }


# Global config instances
CONFIG = Config()
FRAMEWORK_CONFIG = FrameworkConfig()
