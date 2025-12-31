"""
Feedback Collector
Collects and stores user feedback on generated code for continuous improvement.
"""

from typing import Dict, Any, List, Optional
from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.table import Table
from pathlib import Path
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)
console = Console()


class FeedbackCollector:
    """Agent that collects user feedback on generated projects"""
    
    def __init__(self, feedback_file: str = "memory/user_feedback.json"):
        """Initialize feedback collector"""
        self.feedback_file = Path(feedback_file)
        self.feedback_file.parent.mkdir(parents=True, exist_ok=True)
        self.feedback_history = self._load_feedback()
        logger.info(f"Feedback Collector initialized: {len(self.feedback_history)} past feedbacks")
    
    def _load_feedback(self) -> List[Dict[str, Any]]:
        """Load feedback history from file"""
        if self.feedback_file.exists():
            try:
                with open(self.feedback_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Could not load feedback history: {e}")
                return []
        return []
    
    def _save_feedback(self):
        """Save feedback history to file"""
        try:
            with open(self.feedback_file, 'w', encoding='utf-8') as f:
                json.dump(self.feedback_history, f, indent=2)
            logger.info(f"Saved {len(self.feedback_history)} feedbacks")
        except Exception as e:
            logger.error(f"Could not save feedback: {e}")
    
    def collect_project_feedback(
        self,
        project_id: str,
        metrics: Dict[str, Any],
        generated_files: int,
        interactive: bool = True
    ) -> Dict[str, Any]:
        """Collect feedback on the generated project"""
        
        if not interactive:
            return {
                "collected": False,
                "reason": "Interactive mode disabled"
            }
        
        console.print("\n[bold cyan]📊 Project Generation Complete![/bold cyan]")
        console.print(f"Generated {generated_files} files with quality score {metrics.get('quality_score', 0)}\n")
        
        # Ask if user wants to provide feedback
        wants_feedback = Confirm.ask("[yellow]Would you like to provide feedback?[/yellow]", default=False)
        
        if not wants_feedback:
            return {
                "collected": False,
                "reason": "User declined"
            }
        
        console.print("\n[bold green]Thank you for helping us improve![/bold green]\n")
        
        # Overall satisfaction
        satisfaction = Prompt.ask(
            "[cyan]Overall satisfaction (1-5)[/cyan]",
            choices=["1", "2", "3", "4", "5"],
            default="4"
        )
        
        # Code quality
        code_quality = Prompt.ask(
            "[cyan]Code quality (1-5)[/cyan]",
            choices=["1", "2", "3", "4", "5"],
            default="4"
        )
        
        # Would use again
        would_use_again = Confirm.ask("[cyan]Would you use this tool again?[/cyan]", default=True)
        
        # What worked well
        worked_well = Prompt.ask(
            "[green]What worked well? (optional)[/green]",
            default="N/A"
        )
        
        # What needs improvement
        needs_improvement = Prompt.ask(
            "[yellow]What needs improvement? (optional)[/yellow]",
            default="N/A"
        )
        
        # Missing features
        missing_features = Prompt.ask(
            "[magenta]Any missing features? (optional)[/magenta]",
            default="N/A"
        )
        
        # Compile feedback
        feedback = {
            "project_id": project_id,
            "timestamp": datetime.now().isoformat(),
            "satisfaction": int(satisfaction),
            "code_quality": int(code_quality),
            "would_use_again": would_use_again,
            "worked_well": worked_well,
            "needs_improvement": needs_improvement,
            "missing_features": missing_features,
            "metrics": {
                "files_generated": generated_files,
                "quality_score": metrics.get("quality_score", 0),
                "validation_score": metrics.get("validation_score", 0),
                "security_risk": metrics.get("security_risk", 0),
            }
        }
        
        # Save feedback
        self.feedback_history.append(feedback)
        self._save_feedback()
        
        console.print("\n[bold green]✓ Feedback saved! Thank you![/bold green]\n")
        
        return {
            "collected": True,
            "feedback": feedback
        }
    
    def collect_component_feedback(
        self,
        component_name: str,
        component_output: Any,
        interactive: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Collect feedback on a specific component"""
        
        if not interactive:
            return None
        
        rating = Prompt.ask(
            f"[cyan]Rate {component_name} output (1-5, or skip)[/cyan]",
            choices=["1", "2", "3", "4", "5", "skip"],
            default="skip"
        )
        
        if rating == "skip":
            return None
        
        comments = Prompt.ask(
            f"[yellow]Comments on {component_name}? (optional)[/yellow]",
            default="N/A"
        )
        
        return {
            "component": component_name,
            "rating": int(rating),
            "comments": comments,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_feedback_statistics(self) -> Dict[str, Any]:
        """Get statistics from collected feedback"""
        
        if not self.feedback_history:
            return {
                "total_feedbacks": 0,
                "average_satisfaction": 0,
                "average_code_quality": 0,
                "would_use_again_percentage": 0
            }
        
        total = len(self.feedback_history)
        avg_satisfaction = sum(f["satisfaction"] for f in self.feedback_history) / total
        avg_quality = sum(f["code_quality"] for f in self.feedback_history) / total
        would_use_count = sum(1 for f in self.feedback_history if f["would_use_again"])
        
        return {
            "total_feedbacks": total,
            "average_satisfaction": round(avg_satisfaction, 2),
            "average_code_quality": round(avg_quality, 2),
            "would_use_again_percentage": round((would_use_count / total) * 100, 1)
        }


def feedback_collector_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for feedback collection"""
    
    config = state.get("config", {})
    if not config.get("collect_feedback", False):
        return {
            "user_feedback": None,
            "logs": [{
                "phase": "feedback_collection",
                "message": "Feedback collection disabled",
                "timestamp": state.get("timestamp")
            }]
        }
    
    collector = FeedbackCollector()
    
    try:
        project_id = state.get("project_id", "unknown")
        metrics = state.get("metrics", {})
        generated_files = len(state.get("generated_code", {}))
        
        feedback = collector.collect_project_feedback(
            project_id,
            metrics,
            generated_files,
            interactive=config.get("interactive_feedback", False)
        )
        
        return {
            "user_feedback": feedback,
            "logs": [{
                "phase": "feedback_collection",
                "message": f"Feedback collection: {'collected' if feedback.get('collected') else 'skipped'}",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Feedback collection error: {e}")
        return {
            "user_feedback": None,
            "logs": [{
                "phase": "feedback_collection",
                "message": f"Feedback collection failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
