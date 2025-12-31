"""
State Models for Agent System
Defines the shared state structure across all agents.
"""

from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langchain_core.messages import BaseMessage
import operator
from datetime import datetime
from enum import Enum


class ProjectStatus(str, Enum):
    """Project lifecycle status"""
    INITIALIZING = "initializing"
    ANALYZING = "analyzing"
    PLANNING = "planning"
    GENERATING = "generating"
    VALIDATING = "validating"
    DEPLOYING = "deploying"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentState(TypedDict):
    """
    Shared state across all agents in the system.
    Uses Annotated with operator.add for message accumulation.
    """
    # Core identification
    project_id: str
    user_prompt: str
    
    # Conversation and context
    messages: Annotated[List[BaseMessage], operator.add]
    
    # Requirements and planning
    requirements: Dict[str, Any]
    tech_stack: Dict[str, str]
    architecture: Dict[str, Any]
    task_plan: List[Dict[str, Any]]
    
    # Generated artifacts
    generated_code: Dict[str, str]  # {file_path: code_content}
    docker_config: Dict[str, Any]
    k8s_manifests: Dict[str, str]
    ci_pipeline: str
    
    # Testing and validation
    test_results: Dict[str, Any]
    validation_report: Dict[str, Any]
    security_scan: Dict[str, Any]
    
    # Deployment
    deployment_status: str
    deployment_url: Optional[str]
    
    # Metrics and tracking
    metrics: Dict[str, float]  # precision, recall, f1, accuracy
    errors: List[str]
    logs: List[Dict[str, str]]
    
    # Status tracking
    status: str
    current_phase: str
    timestamp: str
    
    # Agent execution tracking
    completed_agents: List[str]
    next_agent: Optional[str]


class TaskNode(TypedDict):
    """Individual task in the execution plan"""
    id: str
    title: str
    description: str
    agent: str
    dependencies: List[str]
    status: str  # pending, in_progress, completed, failed
    inputs: Dict[str, Any]
    outputs: Dict[str, Any]
    complexity: str  # low, medium, high
    estimated_time: int  # in seconds


def create_initial_state(project_id: str, user_prompt: str) -> AgentState:
    """Create initial state for a new project"""
    return AgentState(
        project_id=project_id,
        user_prompt=user_prompt,
        messages=[],
        requirements={},
        tech_stack={},
        architecture={},
        task_plan=[],
        generated_code={},
        docker_config={},
        k8s_manifests={},
        ci_pipeline="",
        test_results={},
        validation_report={},
        security_scan={},
        deployment_status="not_started",
        deployment_url=None,
        metrics={"precision": 0.0, "recall": 0.0, "f1": 0.0, "accuracy": 0.0},
        errors=[],
        logs=[],
        status=ProjectStatus.INITIALIZING.value,
        current_phase="initialization",
        timestamp=datetime.now().isoformat(),
        completed_agents=[],
        next_agent="requirement_analyzer"
    )
