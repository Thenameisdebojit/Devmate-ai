"""
Configuration package for Autonomous Deep AI Agent
Exports main configuration objects for easy imports.
"""

from .config_manager import CONFIG, SystemConfig
from .tech_stack import (
    FRAMEWORK_CONFIG,
    TECH_STACK,
    ModelTier,
    TechStack,
    FrameworkConfig,
    get_model_with_fallback  # NEW: Export helper function
)


__all__ = [
    "CONFIG",
    "SystemConfig",
    "FRAMEWORK_CONFIG",
    "TECH_STACK",
    "ModelTier",
    "TechStack",
    "FrameworkConfig",
    "get_model_with_fallback",  # NEW: Add to exports
]
