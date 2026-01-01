"""
Code Completeness Validator
Validates that sufficient source code files have been generated before proceeding.
Acts as a gatekeeper to ensure complete code generation.
"""

from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


def validate_code_completeness(generated_code: Dict[str, str], requirements: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate that enough source code files have been generated
    
    Returns:
        dict with validation results and recommendations
    """
    if not generated_code:
        return {
            "is_complete": False,
            "reason": "No code files generated",
            "files_count": 0,
            "source_files_count": 0,  # Add missing key
            "frontend_files_count": 0,
            "backend_files_count": 0,
            "config_files_count": 0,
            "docker_files_count": 0,
            "required_minimum": 10,
            "issues": ["No code files generated"],
            "recommendation": "Regenerate code with explicit file requirements"
        }
    
    # Count files by type
    frontend_files = [f for f in generated_code.keys() if f.startswith("frontend/") or "src/" in f or "components" in f or "pages" in f]
    backend_files = [f for f in generated_code.keys() if f.startswith("backend/") or "routes" in f or "api" in f or "server" in f]
    config_files = [f for f in generated_code.keys() if "package.json" in f or "Dockerfile" in f or ".config" in f or "tsconfig" in f or "tailwind" in f]
    docker_files = [f for f in generated_code.keys() if "Dockerfile" in f or "docker-compose" in f]
    k8s_files = [f for f in generated_code.keys() if "k8s" in f or "deployment.yaml" in f]
    
    # Source code files (excluding Docker/K8s)
    source_files = [f for f in generated_code.keys() if f not in docker_files and f not in k8s_files and not f.endswith("VALIDATION_REPORT.json")]
    
    total_files = len(generated_code)
    source_count = len(source_files)
    
    # Determine project type from requirements
    project_type = requirements.get("project_type", "full-stack-web")
    has_frontend = "web" in project_type or "frontend" in str(requirements.get("tech_stack", {})).lower()
    has_backend = "api" in project_type or "backend" in str(requirements.get("tech_stack", {})).lower() or "full-stack" in project_type
    
    # Calculate minimum requirements
    min_files = 10
    if has_frontend and has_backend:
        min_files = 20  # Full-stack needs more files
    elif has_frontend:
        min_files = 12  # Frontend-only needs components, pages, styles, etc.
    elif has_backend:
        min_files = 8   # Backend-only needs routes, models, middleware, etc.
    
    # Check completeness
    issues = []
    
    if source_count < min_files:
        issues.append(f"Only {source_count} source files generated, need at least {min_files}")
    
    if has_frontend and len(frontend_files) < 5:
        issues.append(f"Only {len(frontend_files)} frontend files, need at least 5 (components, pages, styles, configs)")
    
    if has_backend and len(backend_files) < 5:
        issues.append(f"Only {len(backend_files)} backend files, need at least 5 (routes, models, middleware, configs)")
    
    if len(config_files) < 2:
        issues.append("Missing essential config files (package.json, tsconfig.json, etc.)")
    
    # Check if only Dockerfiles were generated
    if len(docker_files) > 0 and source_count < 5:
        issues.append("CRITICAL: Only Dockerfiles/configs generated, no source code files!")
    
    is_complete = len(issues) == 0
    
    return {
        "is_complete": is_complete,
        "files_count": total_files,
        "source_files_count": source_count,
        "frontend_files_count": len(frontend_files),
        "backend_files_count": len(backend_files),
        "config_files_count": len(config_files),
        "docker_files_count": len(docker_files),
        "required_minimum": min_files,
        "issues": issues,
        "recommendation": "Code generation complete" if is_complete else "Regenerate with explicit file requirements - need more source code files"
    }


def code_completeness_validator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node that validates code completeness before proceeding
    """
    generated_code = state.get("generated_code", {})
    requirements = state.get("requirements", {})
    regeneration_count = state.get("regeneration_count", 0)
    
    validation_result = validate_code_completeness(generated_code, requirements)
    
    # Safely access validation result with defaults
    source_files_count = validation_result.get('source_files_count', 0)
    required_minimum = validation_result.get('required_minimum', 10)
    issues = validation_result.get('issues', [])
    
    logger.info(f"Code completeness check: {source_files_count} source files, required: {required_minimum}")
    logger.info(f"Regeneration count: {regeneration_count}")
    
    if not validation_result.get("is_complete", False):
        logger.warning(f"Code incomplete: {issues}")
        
        # Add regeneration instructions to requirements
        if "regeneration_instructions" not in requirements:
            requirements["regeneration_instructions"] = []
        
        requirements["regeneration_instructions"].append(
            f"CRITICAL: Previous generation only created {source_files_count} source files. "
            f"Need at least {required_minimum} files. "
            f"Issues: {', '.join(issues) if issues else 'No code generated'}. "
            f"Generate ALL source code files (components, pages, styles, configs, routes, models) - NOT just Dockerfiles!"
        )
        
        return {
            "code_completeness": validation_result,
            "needs_regeneration": True,
            "regeneration_count": regeneration_count + 1,  # Increment count
            "requirements": requirements,  # Update requirements with regeneration instructions
            "logs": [{
                "phase": "code_completeness_validation",
                "message": f"Code incomplete: {', '.join(issues) if issues else 'No code generated'}. Regenerating (attempt {regeneration_count + 1}/3)...",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [f"Code incomplete: {validation_result.get('recommendation', 'Regenerate code')}"]
        }
    
    return {
        "code_completeness": validation_result,
        "needs_regeneration": False,
        "logs": [{
            "phase": "code_completeness_validation",
            "message": f"Code complete: {source_files_count} source files generated",
            "timestamp": state.get("timestamp")
        }]
    }

