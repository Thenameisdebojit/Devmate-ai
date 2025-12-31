"""
Approval Agent
Manages human approval workflow for critical decisions during code generation.
"""

from typing import Dict, Any, List, Optional
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.table import Table
import logging

logger = logging.getLogger(__name__)
console = Console()


class ApprovalAgent:
    """Agent that manages human approval for critical decisions"""
    
    def __init__(self, auto_approve: bool = False):
        """Initialize approval agent"""
        self.auto_approve = auto_approve
        self.approval_history = []
        logger.info(f"Approval Agent initialized (auto_approve={auto_approve})")
    
    def request_approval(
        self,
        decision_type: str,
        description: str,
        details: Dict[str, Any],
        critical: bool = False
    ) -> Dict[str, Any]:
        """Request human approval for a decision"""
        
        if self.auto_approve and not critical:
            logger.info(f"Auto-approved: {decision_type}")
            return {
                "approved": True,
                "auto_approved": True,
                "feedback": None
            }
        
        # Display approval request
        console.print(f"\n[bold yellow]⏸️  Approval Required: {decision_type}[/bold yellow]")
        console.print(f"[cyan]{description}[/cyan]\n")
        
        # Display details in table
        if details:
            table = Table(show_header=False, box=None)
            table.add_column("Key", style="yellow")
            table.add_column("Value", style="white")
            
            for key, value in details.items():
                table.add_row(str(key), str(value))
            
            console.print(table)
        
        # Request approval
        approved = Confirm.ask("\n[bold]Approve this decision?[/bold]", default=True)
        
        feedback = None
        if not approved:
            feedback = Prompt.ask("[yellow]Feedback/Reason for rejection[/yellow]", default="No reason provided")
        
        result = {
            "approved": approved,
            "auto_approved": False,
            "feedback": feedback,
            "decision_type": decision_type
        }
        
        self.approval_history.append(result)
        
        logger.info(f"Approval decision: {decision_type} - {'Approved' if approved else 'Rejected'}")
        
        return result
    
    def request_tech_stack_approval(self, tech_stack: Dict[str, Any]) -> bool:
        """Request approval for technology stack selection"""
        
        return self.request_approval(
            decision_type="Technology Stack Selection",
            description="The following technology stack has been selected based on your requirements:",
            details={
                "Frontend": tech_stack.get("frontend", {}).get("framework", "N/A"),
                "Backend": tech_stack.get("backend", {}).get("framework", "N/A"),
                "Database": tech_stack.get("database", {}).get("primary", "N/A"),
                "Mobile": tech_stack.get("mobile", {}).get("platform", "N/A"),
            },
            critical=True
        )["approved"]
    
    def request_validation_approval(self, validation_report: Dict[str, Any]) -> bool:
        """Request approval if validation score is low"""
        
        score = validation_report.get("overall_score", 0)
        critical_issues = len([
            i for i in validation_report.get("issues", [])
            if i.get("severity") in ["critical", "high"]
        ])
        
        if score >= 70:
            return True  # Auto-approve good scores
        
        return self.request_approval(
            decision_type="Validation Results",
            description=f"Code validation completed with score {score}/100",
            details={
                "Status": validation_report.get("status", "unknown"),
                "Score": f"{score}/100",
                "Critical/High Issues": critical_issues,
                "Total Issues": len(validation_report.get("issues", [])),
            },
            critical=True
        )["approved"]


def approval_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for human approval"""
    
    # Check if approval is enabled
    config = state.get("config", {})
    if not config.get("enable_human_approval", False):
        return {
            "approval_results": [],
            "logs": [{
                "phase": "human_approval",
                "message": "Human approval disabled",
                "timestamp": state.get("timestamp")
            }]
        }
    
    agent = ApprovalAgent(auto_approve=config.get("auto_approve", False))
    
    try:
        approvals = []
        
        # Tech stack approval
        tech_stack = state.get("tech_stack", {})
        if tech_stack:
            tech_approved = agent.request_tech_stack_approval(tech_stack)
            if not tech_approved:
                return {
                    "approval_results": approvals,
                    "generation_cancelled": True,
                    "logs": [{
                        "phase": "human_approval",
                        "message": "Generation cancelled - Tech stack not approved",
                        "timestamp": state.get("timestamp")
                    }]
                }
        
        # Validation approval (if low score)
        validation_report = state.get("validation_report", {})
        if validation_report:
            val_approved = agent.request_validation_approval(validation_report)
            if not val_approved:
                return {
                    "approval_results": approvals,
                    "generation_cancelled": True,
                    "logs": [{
                        "phase": "human_approval",
                        "message": "Generation cancelled - Validation not approved",
                        "timestamp": state.get("timestamp")
                    }]
                }
        
        return {
            "approval_results": agent.approval_history,
            "logs": [{
                "phase": "human_approval",
                "message": f"Approval process complete: {len(agent.approval_history)} decisions made",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Approval agent error: {e}")
        return {
            "approval_results": [],
            "logs": [{
                "phase": "human_approval",
                "message": f"Approval failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
