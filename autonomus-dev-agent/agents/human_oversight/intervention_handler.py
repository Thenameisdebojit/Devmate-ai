"""
Intervention Handler
Allows users to manually override agent decisions and modify generation mid-process.
"""

from typing import Dict, Any, List, Optional
from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.panel import Panel
import logging

logger = logging.getLogger(__name__)
console = Console()


class InterventionHandler:
    """Agent that handles manual interventions during generation"""
    
    def __init__(self):
        """Initialize intervention handler"""
        self.interventions = []
        logger.info("Intervention Handler initialized")
    
    def check_for_intervention(
        self,
        phase: str,
        current_state: Dict[str, Any],
        allow_intervention: bool = True
    ) -> Dict[str, Any]:
        """Check if user wants to intervene at this phase"""
        
        if not allow_intervention:
            return {
                "intervened": False,
                "continue": True
            }
        
        # Quick intervention prompt
        console.print(f"\n[dim]Press Ctrl+C to pause, or wait 3s to continue...[/dim]")
        
        # In production, you'd use proper async input with timeout
        # For now, we'll skip auto-intervention to not block execution
        
        return {
            "intervened": False,
            "continue": True
        }
    
    def handle_requirement_modification(
        self,
        requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Allow user to modify requirements"""
        
        console.print("\n[bold yellow]⚠️  Requirement Modification[/bold yellow]")
        console.print(f"Current project: {requirements.get('project_name', 'Unknown')}")
        console.print(f"Features: {len(requirements.get('features', []))}")
        
        modify = Confirm.ask("\n[cyan]Modify requirements?[/cyan]", default=False)
        
        if not modify:
            return {
                "modified": False,
                "requirements": requirements
            }
        
        # Allow editing project name
        new_name = Prompt.ask(
            "[cyan]New project name[/cyan]",
            default=requirements.get("project_name", "")
        )
        
        # Allow adding features
        add_features = Confirm.ask("[cyan]Add more features?[/cyan]", default=False)
        
        new_features = list(requirements.get("features", []))
        if add_features:
            while True:
                feature = Prompt.ask("[green]Feature to add (or 'done')[/green]")
                if feature.lower() == "done":
                    break
                new_features.append({"name": feature, "priority": "high"})
        
        modified_requirements = requirements.copy()
        modified_requirements["project_name"] = new_name
        modified_requirements["features"] = new_features
        
        intervention = {
            "phase": "requirements",
            "modified": True,
            "changes": {
                "project_name": new_name != requirements.get("project_name"),
                "features_added": len(new_features) - len(requirements.get("features", []))
            }
        }
        
        self.interventions.append(intervention)
        
        return {
            "modified": True,
            "requirements": modified_requirements,
            "intervention": intervention
        }
    
    def handle_tech_stack_override(
        self,
        tech_stack: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Allow user to override technology choices"""
        
        console.print("\n[bold yellow]⚠️  Tech Stack Override[/bold yellow]")
        console.print(f"Frontend: {tech_stack.get('frontend', {}).get('framework', 'N/A')}")
        console.print(f"Backend: {tech_stack.get('backend', {}).get('framework', 'N/A')}")
        console.print(f"Database: {tech_stack.get('database', {}).get('primary', 'N/A')}")
        
        override = Confirm.ask("\n[cyan]Override tech stack?[/cyan]", default=False)
        
        if not override:
            return {
                "modified": False,
                "tech_stack": tech_stack
            }
        
        # Allow changing frontend
        new_frontend = Prompt.ask(
            "[cyan]Frontend framework[/cyan]",
            choices=["react", "vue", "nextjs", "angular", "keep"],
            default="keep"
        )
        
        # Allow changing backend
        new_backend = Prompt.ask(
            "[cyan]Backend framework[/cyan]",
            choices=["nodejs-express", "fastapi", "django", "nestjs", "keep"],
            default="keep"
        )
        
        # Allow changing database
        new_database = Prompt.ask(
            "[cyan]Database[/cyan]",
            choices=["mongodb", "postgresql", "mysql", "sqlite", "keep"],
            default="keep"
        )
        
        modified_stack = tech_stack.copy()
        
        if new_frontend != "keep":
            if "frontend" not in modified_stack:
                modified_stack["frontend"] = {}
            modified_stack["frontend"]["framework"] = new_frontend
        
        if new_backend != "keep":
            if "backend" not in modified_stack:
                modified_stack["backend"] = {}
            modified_stack["backend"]["framework"] = new_backend
        
        if new_database != "keep":
            if "database" not in modified_stack:
                modified_stack["database"] = {}
            modified_stack["database"]["primary"] = new_database
        
        intervention = {
            "phase": "tech_stack",
            "modified": True,
            "changes": {
                "frontend": new_frontend if new_frontend != "keep" else None,
                "backend": new_backend if new_backend != "keep" else None,
                "database": new_database if new_database != "keep" else None
            }
        }
        
        self.interventions.append(intervention)
        
        return {
            "modified": True,
            "tech_stack": modified_stack,
            "intervention": intervention
        }
    
    def handle_validation_failure(
        self,
        validation_report: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle validation failure intervention"""
        
        score = validation_report.get("overall_score", 0)
        
        if score >= 70:
            return {"action": "continue"}
        
        console.print(f"\n[bold red]⚠️  Low Validation Score: {score}/100[/bold red]")
        
        action = Prompt.ask(
            "[cyan]Action to take[/cyan]",
            choices=["continue", "retry", "abort"],
            default="continue"
        )
        
        intervention = {
            "phase": "validation",
            "action": action,
            "score": score
        }
        
        self.interventions.append(intervention)
        
        return {
            "action": action,
            "intervention": intervention
        }


def intervention_handler_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for intervention handling"""
    
    config = state.get("config", {})
    if not config.get("enable_interventions", False):
        return {
            "interventions": [],
            "logs": [{
                "phase": "intervention_handler",
                "message": "Interventions disabled",
                "timestamp": state.get("timestamp")
            }]
        }
    
    handler = InterventionHandler()
    
    try:
        # Check for requirement modifications
        requirements = state.get("requirements", {})
        if requirements and config.get("allow_requirement_modification", False):
            result = handler.handle_requirement_modification(requirements)
            if result["modified"]:
                return {
                    "requirements": result["requirements"],
                    "interventions": handler.interventions,
                    "logs": [{
                        "phase": "intervention_handler",
                        "message": "Requirements modified by user",
                        "timestamp": state.get("timestamp")
                    }]
                }
        
        return {
            "interventions": handler.interventions,
            "logs": [{
                "phase": "intervention_handler",
                "message": f"{len(handler.interventions)} interventions recorded",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Intervention handler error: {e}")
        return {
            "interventions": [],
            "logs": [{
                "phase": "intervention_handler",
                "message": f"Intervention handling failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
