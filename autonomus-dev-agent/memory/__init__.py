"""
Memory package for state management and persistence
"""

from .state_models import (
    AgentState,
    TaskNode,
    ProjectStatus,
    create_initial_state
)
from .checkpoint_manager import CheckpointManager

# Create global checkpoint manager instance
checkpoint_manager = CheckpointManager()

__all__ = [
    "AgentState",
    "TaskNode",
    "ProjectStatus",
    "create_initial_state",
    "CheckpointManager",
    "checkpoint_manager",
]
