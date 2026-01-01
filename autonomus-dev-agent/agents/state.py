"""
State schema for the multi-agent workflow with complete Phase 4 integration
"""

from typing import Dict, Any, List, TypedDict, Optional, Annotated
from datetime import datetime
from operator import add


def merge_dicts(left: Dict, right: Dict) -> Dict:
    """Merge two dictionaries, combining their keys"""
    result = left.copy()
    result.update(right)
    return result


class AgentState(TypedDict):
    """State shared across all agents in the workflow"""
    
    # Input & Configuration
    user_input: str
    project_id: str
    timestamp: str
    debug_mode: bool
    config: Dict[str, Any]
    
    # Phase 1: Requirements & Planning
    requirements: Dict[str, Any]
    tech_stack: Dict[str, Any]
    architecture: Dict[str, Any]
    task_plan: List[Dict[str, Any]]
    
    # Phase 2: Code Generation - FIXED to handle concurrent updates
    generated_code: Annotated[Dict[str, str], merge_dicts]
    code_completeness: Dict[str, Any]
    needs_regeneration: bool
    regeneration_count: int
    
    # Phase 3: Validation & Deployment
    validation_report: Dict[str, Any]
    docker_config: Dict[str, str]
    k8s_manifests: Dict[str, str]
    deployment_status: str
    
    # Phase 4: Testing & Quality Assurance
    test_files: Annotated[Dict[str, str], merge_dicts]
    integration_tests: Annotated[Dict[str, str], merge_dicts]
    integration_test_stats: Dict[str, int]
    performance_tests: Annotated[Dict[str, str], merge_dicts]
    security_report: Dict[str, Any]
    
    # Phase 4: Optimization
    error_analysis: Dict[str, Any]
    refactor_result: Dict[str, Any]
    performance_report: Dict[str, Any]
    performance_optimizations: Annotated[Dict[str, str], merge_dicts]
    dependency_report: Dict[str, Any]
    
    # Phase 4: Human Oversight
    approval_results: Annotated[List[Dict[str, Any]], add]
    user_feedback: Optional[Dict[str, Any]]
    interventions: Annotated[List[Dict[str, Any]], add]
    generation_cancelled: bool
    
    # Phase 4: Project Management
    template_saved: bool
    template_id: Optional[str]
    git_initialized: bool
    git_committed: bool
    github_pushed: bool
    repository_path: Optional[str]
    deployment_url: Optional[str]
    deployment_instructions: Optional[str]
    
    # Metadata & Monitoring
    metrics: Dict[str, Any]
    agent_metrics: Dict[str, Any]
    logs: Annotated[List[Dict[str, Any]], add]
    errors: Annotated[List[str], add]
    
    # Final output
    final_status: str


def create_initial_state(
    user_input: str,
    project_id: str,
    debug_mode: bool = False,
    config: Optional[Dict[str, Any]] = None
) -> AgentState:
    """Create initial state for a new project"""
    
    default_config = {
        # Testing
        "enable_testing": True,
        "enable_security_scan": True,
        "enable_performance_profiling": False,
        
        # Optimization
        "enable_auto_refactor": True,
        "enable_performance_optimization": False,
        "enable_dependency_optimization": False,
        
        # Human Oversight
        "enable_human_approval": False,
        "auto_approve": True,
        "collect_feedback": False,
        "interactive_feedback": False,
        "enable_interventions": False,
        "allow_requirement_modification": False,
        
        # Project Management
        "enable_templates": True,
        "save_as_template": False,
        "enable_git": True,
        "create_github_repo": False,
        "enable_deployment": True,
        "auto_deploy": False,
        "deployment_platform": "vercel",
        
        # General
        "max_retries": 2,
        "timeout_seconds": 300,
    }
    
    if config:
        default_config.update(config)
    
    return AgentState(
        # Input
        user_input=user_input,
        project_id=project_id,
        timestamp=datetime.now().isoformat(),
        debug_mode=debug_mode,
        config=default_config,
        
        # Phase 1
        requirements={},
        tech_stack={},
        architecture={},
        task_plan=[],
        
        # Phase 2
        generated_code={},
        code_completeness={},
        needs_regeneration=False,
        regeneration_count=0,
        
        # Phase 3
        validation_report={},
        docker_config={},
        k8s_manifests={},
        deployment_status="pending",
        
        # Phase 4: Testing
        test_files={},
        integration_tests={},
        integration_test_stats={},
        performance_tests={},
        security_report={},
        
        # Phase 4: Optimization
        error_analysis={},
        refactor_result={},
        performance_report={},
        performance_optimizations={},
        dependency_report={},
        
        # Phase 4: Human Oversight
        approval_results=[],
        user_feedback=None,
        interventions=[],
        generation_cancelled=False,
        
        # Phase 4: Project Management
        template_saved=False,
        template_id=None,
        git_initialized=False,
        git_committed=False,
        github_pushed=False,
        repository_path=None,
        deployment_url=None,
        deployment_instructions=None,
        
        # Metadata
        metrics={},
        agent_metrics={},
        logs=[],
        errors=[],
        
        # Final
        final_status="initializing"
    )
