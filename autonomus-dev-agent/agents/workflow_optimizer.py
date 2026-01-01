"""
Workflow Optimizer - Intelligent routing based on task complexity
Makes the agent skip unnecessary phases for simple tasks
"""

from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


def analyze_task_complexity(requirements: Dict[str, Any], user_input: str) -> Dict[str, Any]:
    """
    Analyze task complexity and determine which phases to skip
    
    Returns:
        dict with optimization recommendations
    """
    user_input_lower = user_input.lower()
    project_type = requirements.get("project_type", "").lower()
    features = requirements.get("features", [])
    
    # Simple heuristics for task complexity
    is_simple = False
    is_medium = False
    is_complex = False
    
    # Simple tasks: calculator, todo app, basic website, single page app
    simple_keywords = [
        "calculator", "todo", "simple", "basic", "html", "css", "javascript",
        "single page", "landing page", "portfolio", "blog", "static"
    ]
    
    # Medium tasks: full-stack with auth, CRUD operations, API integration
    medium_keywords = [
        "full-stack", "authentication", "login", "register", "crud", "api",
        "database", "mongodb", "postgres", "rest api", "express"
    ]
    
    # Complex tasks: microservices, real-time, complex integrations
    complex_keywords = [
        "microservices", "real-time", "websocket", "kubernetes", "docker",
        "microservice", "distributed", "scalable", "enterprise"
    ]
    
    # Check keywords
    if any(keyword in user_input_lower for keyword in simple_keywords):
        is_simple = True
    elif any(keyword in user_input_lower for keyword in complex_keywords):
        is_complex = True
    elif any(keyword in user_input_lower for keyword in medium_keywords):
        is_medium = True
    
    # Check project type
    if "static" in project_type or "website" in project_type:
        is_simple = True
    elif "microservices" in project_type or "enterprise" in project_type:
        is_complex = True
    
    # Check feature count
    feature_count = len(features) if isinstance(features, list) else 0
    if feature_count <= 3 and not is_complex:
        is_simple = True
    elif feature_count > 10:
        is_complex = True
    elif feature_count > 5:
        is_medium = True
    
    # Determine optimization level
    if is_simple:
        optimization_level = "simple"
        skip_testing = True
        skip_performance = True
        skip_security_scan = True
        skip_optimization = True
        skip_project_management = True
    elif is_complex:
        optimization_level = "complex"
        skip_testing = False
        skip_performance = False
        skip_security_scan = False
        skip_optimization = False
        skip_project_management = False
    else:
        optimization_level = "medium"
        skip_testing = False
        skip_performance = True
        skip_security_scan = False
        skip_optimization = True
        skip_project_management = True
    
    logger.info(f"Task complexity: {optimization_level} (simple={is_simple}, medium={is_medium}, complex={is_complex})")
    
    return {
        "optimization_level": optimization_level,
        "skip_testing": skip_testing,
        "skip_performance_profiling": skip_performance,
        "skip_security_scan": skip_security_scan,
        "skip_optimization": skip_optimization,
        "skip_project_management": skip_project_management,
        "skip_dependency_optimization": skip_optimization,
        "skip_template_library": skip_project_management,
        "skip_version_control": skip_project_management,
        "skip_deployment_tracking": skip_project_management,
    }


def workflow_optimizer_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node that analyzes task and sets optimization flags
    """
    requirements = state.get("requirements", {})
    user_input = state.get("user_input", "")
    
    optimization = analyze_task_complexity(requirements, user_input)
    
    # Update config with optimization flags
    config = state.get("config", {})
    config.update(optimization)
    
    # Update config with optimization flags
    updated_config = config.copy() if config else {}
    updated_config.update(optimization)
    
    return {
        "config": updated_config,
        "workflow_optimization": optimization,
        "logs": [{
            "phase": "workflow_optimization",
            "message": f"Task complexity: {optimization['optimization_level']}. Skipping unnecessary phases for faster generation.",
            "timestamp": state.get("timestamp")
        }]
    }

