"""
Technology Stack Configuration
Defines supported tech stacks, frameworks, and model tiers with automatic fallback.
"""

from enum import Enum
from typing import Dict, List, Any
from pydantic import BaseModel


class ModelTier(Enum):
    """LLM model tiers for different tasks"""
    PLANNING = "models/gemini-2.5-pro"  # Gemini 2.5 Pro for strategic planning
    CODE_GEN = "models/gemini-2.5-pro"  # Gemini 2.5 Pro for code generation
    VALIDATION = "models/gemini-2.0-flash-thinking-exp"  # Thinking model for validation
    VALIDATION_FALLBACK = "models/gemini-2.5-flash"  # NEW: Fallback when quota exceeded
    SUMMARY = "models/gemini-2.5-flash"  # Fast Gemini for summarization


class TechStack(BaseModel):
    """Supported technology stacks for application generation"""
    web_frontend: List[str] = [
        "react",
        "nextjs",
        "vue",
        "svelte",
        "angular"
    ]
    
    web_backend: List[str] = [
        "nodejs-express",
        "fastapi",
        "django",
        "flask",
        "nestjs"
    ]
    
    mobile: List[str] = [
        "react-native",
        "flutter",
        "expo",
        "native-ios",
        "native-android"
    ]
    
    databases: List[str] = [
        "postgresql",
        "mongodb",
        "mysql",
        "redis",
        "sqlite",
        "supabase",
        "firebase"
    ]
    
    cloud_platforms: List[str] = [
        "kubernetes",
        "docker",
        "docker-compose",
        "aws-ecs",
        "gcp-gke",
        "azure-aks",
        "vercel",
        "netlify"
    ]
    
    ci_cd: List[str] = [
        "github-actions",
        "gitlab-ci",
        "jenkins",
        "circleci",
        "travis-ci"
    ]


class FrameworkConfig(BaseModel):
    """Core framework configuration for the agent system with fallback support"""
    
    # Core orchestration
    orchestration: str = "langgraph"
    state_management: str = "langgraph-checkpoint-sqlite"
    vector_store: str = "chromadb"
    container_runtime: str = "docker"
    orchestrator: str = "kubernetes"
    ci_cd: str = "github-actions"
    
    # Agent architecture patterns
    # Options: "hierarchical-supervisor", "sequential", "map-reduce", "blackboard"
    agent_pattern: str = "hierarchical-supervisor"
    
    # LLM providers for different roles
    llm_providers: Dict[str, str] = {
        "planning": "google",           # Gemini 2.5 Pro for strategic planning (FREE!)
        "code": "google",                # Gemini 2.5 Pro for code generation (FREE!)
        "validation": "google",          # Gemini 2.0 Flash Thinking for validation (FREE!)
        "validation_fallback": "google", # NEW: Gemini 2.5 Flash fallback
        "summary": "google",             # Gemini 2.5 Flash for summarization (FREE!)
    }
    
    # Model configurations with specific models and fallback support
    model_configs: Dict[str, Dict[str, Any]] = {
        "planning": {
            "model": "models/gemini-2.5-pro",
            "temperature": 0.7,
            "max_tokens": 8000,
            "top_p": 0.95,
            "description": "Strategic planning and architecture design"
        },
        "code": {
            "model": "models/gemini-2.5-pro",
            "temperature": 0.3,  # Lower for more deterministic code
            "max_tokens": 8000,
            "top_p": 0.9,
            "description": "Production-ready code generation"
        },
        "validation": {
            "model": "models/gemini-2.0-flash-thinking-exp",
            "temperature": 0.2,  # Very low for consistent validation
            "max_tokens": 8192,
            "top_p": 0.85,
            "description": "Primary model for deep code validation and security analysis",
            "fallback": "validation_fallback"  # NEW: Points to fallback config
        },
        "validation_fallback": {  # NEW: Fallback configuration
            "model": "models/gemini-2.5-flash",
            "temperature": 0.3,
            "max_tokens": 8192,
            "top_p": 0.85,
            "description": "Fallback model when primary validation quota is exceeded"
        },
        "summary": {
            "model": "models/gemini-2.5-flash",
            "temperature": 0.4,
            "max_tokens": 2000,
            "top_p": 0.9,
            "description": "Fast summarization and context compression"
        },
    }
    
    # Agent roles and responsibilities (NEW: Added for better organization)
    agent_roles: Dict[str, Dict[str, Any]] = {
        "requirement_analyzer": {
            "role": "Senior Product Manager",
            "expertise": ["requirement analysis", "user stories", "feature prioritization"],
            "model_tier": "planning",
            "description": "Analyzes natural language requirements and extracts structured specifications"
        },
        "strategic_planner": {
            "role": "Solution Architect",
            "expertise": ["system design", "architecture patterns", "technology selection"],
            "model_tier": "planning",
            "description": "Creates implementation plans with tasks, architecture, and tech stack"
        },
        "code_generator": {
            "role": "Senior Software Engineer",
            "expertise": ["coding", "best practices", "framework expertise"],
            "model_tier": "code",
            "description": "Generates production-ready code for frontend, backend, and mobile"
        },
        "validator": {
            "role": "Senior Code Reviewer & Security Expert",
            "expertise": ["code review", "security audit", "quality assurance"],
            "model_tier": "validation",
            "fallback_tier": "validation_fallback",  # NEW: Fallback tier
            "description": "Validates code quality, security, and completeness with automatic fallback"
        },
        "devops_engineer": {
            "role": "DevOps Engineer",
            "expertise": ["containerization", "orchestration", "CI/CD"],
            "model_tier": "code",
            "description": "Generates Docker, Kubernetes, and deployment configurations"
        }
    }
    
    # Performance settings
    max_concurrent_agents: int = 5
    max_retries: int = 3
    retry_delay_seconds: int = 2  # NEW: Delay between retries
    timeout_seconds: int = 300
    enable_streaming: bool = True
    
    # Memory settings
    max_message_history: int = 20
    enable_summarization: bool = True
    checkpoint_frequency: int = 5  # Save state every N steps
    
    # Code generation settings
    enable_code_review: bool = True
    enable_static_analysis: bool = True
    enable_security_scan: bool = True
    
    # Validation settings (NEW)
    enable_validation_fallback: bool = True  # Automatically use fallback on quota errors
    validation_retry_attempts: int = 5  # Max retry attempts with exponential backoff
    skip_validation_on_failure: bool = False  # Whether to continue if validation fails
    
    # Deployment settings
    auto_deploy: bool = False  # Require manual approval by default
    staging_deploy: bool = True  # Deploy to staging first
    enable_rollback: bool = True
    
    # Quota management (NEW)
    quota_exceeded_behavior: str = "fallback"  # Options: "fallback", "skip", "fail", "retry"
    track_model_usage: bool = True  # Track which models are used


# Initialize global configuration instances
FRAMEWORK_CONFIG = FrameworkConfig()
TECH_STACK = TechStack()


# Helper function to get model config with fallback info
def get_model_with_fallback(tier: str) -> Dict[str, Any]:
    """
    Get model configuration with fallback information
    
    Args:
        tier: Model tier name (e.g., "validation")
        
    Returns:
        Dictionary with model config and fallback details
    """
    config = FRAMEWORK_CONFIG.model_configs.get(tier, {})
    result = {
        "primary": config,
        "has_fallback": "fallback" in config,
    }
    
    if result["has_fallback"]:
        fallback_tier = config["fallback"]
        result["fallback"] = FRAMEWORK_CONFIG.model_configs.get(fallback_tier, {})
    
    return result
