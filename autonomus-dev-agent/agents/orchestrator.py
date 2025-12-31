"""
Deep Agent Orchestrator - Complete Phase 4 Production Integration
Coordinates all agents using LangGraph workflow with full Phase 4 capabilities.
"""

from typing import Dict, Any, Iterator, Optional  # ← ADD Optional HERE
from langgraph.graph import StateGraph, END
from agents.state import AgentState, create_initial_state

# Phase 1: Requirements & Planning
from agents.requirement_analyzer import requirement_analyzer_node
from agents.strategic_planner import strategic_planner_node

# Phase 2: Code Generation
from agents.code_generators import (
    frontend_generator_node,
    backend_generator_node,
    mobile_generator_node,
)

# Phase 3: Validation & Deployment
from agents.validators.code_validator import code_validator_node
from agents.deployment.devops_agent import devops_agent_node
from agents.artifact_writer import artifact_writer_node

# Phase 4: Testing & Quality Assurance
from agents.testing import (
    unit_test_generator_node,
    integration_test_agent_node,
    security_scanner_node,
    performance_profiler_node,
)

# Phase 4: Optimization
from agents.optimization import (
    error_analyzer_node,
    code_refactor_node,
    performance_optimizer_node,
    dependency_optimizer_node,
)

# Phase 4: Human Oversight
from agents.human_oversight import (
    approval_agent_node,
    feedback_collector_node,
    intervention_handler_node,
)

# Phase 4: Project Management
from agents.project_manager import (
    template_library_node,
    version_controller_node,
    deployment_tracker_node,
)

from memory.checkpoint_manager import CheckpointManager
from ui.dashboard.agent_metrics import AgentMetricsCollector
import logging
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)


class DeepAgentOrchestrator:
    """Orchestrates the complete multi-agent workflow with Phase 4 intelligence"""
    
    def __init__(self):
        """Initialize the orchestrator with complete Phase 4 workflow"""
        self.checkpoint_manager = CheckpointManager()
        self.metrics_collector = AgentMetricsCollector()
        self.workflow = self._build_workflow()
        logger.info("Deep Agent Orchestrator initialized with complete Phase 4 (17 additional components)")
    
    def _build_workflow(self) -> StateGraph:
        """Build the complete LangGraph workflow with all Phase 4 components"""
        workflow = StateGraph(AgentState)
        
        # Phase 1: Requirements & Planning
        workflow.add_node("requirement_analysis", requirement_analyzer_node)
        workflow.add_node("strategic_planning", strategic_planner_node)
        workflow.add_node("human_approval", approval_agent_node)  # NEW
        
        # Phase 2: Code Generation
        workflow.add_node("frontend_generation", frontend_generator_node)
        workflow.add_node("backend_generation", backend_generator_node)
        workflow.add_node("mobile_generation", mobile_generator_node)
        
        # Phase 3: Validation & Deployment
        workflow.add_node("code_validation", code_validator_node)
        workflow.add_node("deployment_config", devops_agent_node)
        
        # Phase 4: Testing & Quality Assurance
        workflow.add_node("test_generation", unit_test_generator_node)
        workflow.add_node("integration_test_generation", integration_test_agent_node)
        workflow.add_node("performance_profiling", performance_profiler_node)  # NEW
        workflow.add_node("security_scan", security_scanner_node)
        
        # Phase 4: Optimization
        workflow.add_node("error_analysis", error_analyzer_node)
        workflow.add_node("code_refactor", code_refactor_node)
        workflow.add_node("performance_optimization", performance_optimizer_node)  # NEW
        workflow.add_node("dependency_optimization", dependency_optimizer_node)  # NEW
        
        # Phase 4: Human Oversight & Feedback
        workflow.add_node("intervention_check", intervention_handler_node)  # NEW
        workflow.add_node("feedback_collection", feedback_collector_node)  # NEW
        
        # Phase 4: Project Management
        workflow.add_node("template_library", template_library_node)  # NEW
        workflow.add_node("version_control", version_controller_node)  # NEW
        workflow.add_node("deployment_tracking", deployment_tracker_node)  # NEW
        
        # Finalization
        workflow.add_node("finalization", artifact_writer_node)
        
        # ========== Define workflow edges ==========
        
        workflow.set_entry_point("requirement_analysis")
        
        # Phase 1 flow
        workflow.add_edge("requirement_analysis", "human_approval")
        
        # Conditional: Continue or cancel after approval
        workflow.add_conditional_edges(
            "human_approval",
            self._check_approval,
            {
                "approved": "strategic_planning",
                "cancelled": END
            }
        )
        
        workflow.add_edge("strategic_planning", "intervention_check")
        
        # Phase 2 flow (parallel code generation)
        workflow.add_edge("intervention_check", "frontend_generation")
        workflow.add_edge("intervention_check", "backend_generation")
        workflow.add_edge("intervention_check", "mobile_generation")
        
        # Wait for all generators to complete before validation
        workflow.add_edge("frontend_generation", "code_validation")
        workflow.add_edge("backend_generation", "code_validation")
        workflow.add_edge("mobile_generation", "code_validation")
        
        # Phase 3 flow
        workflow.add_edge("code_validation", "deployment_config")
        
        # Phase 4: Testing Pipeline (Sequential)
        workflow.add_edge("deployment_config", "test_generation")
        workflow.add_edge("test_generation", "integration_test_generation")
        workflow.add_edge("integration_test_generation", "performance_profiling")
        workflow.add_edge("performance_profiling", "security_scan")
        
        # Phase 4: Optimization Pipeline
        workflow.add_edge("security_scan", "error_analysis")
        
        # Conditional: Refactor if errors found
        workflow.add_conditional_edges(
            "error_analysis",
            self._should_refactor,
            {
                "refactor": "code_refactor",
                "skip_refactor": "performance_optimization"
            }
        )
        
        workflow.add_edge("code_refactor", "performance_optimization")
        workflow.add_edge("performance_optimization", "dependency_optimization")
        
        # Phase 4: Project Management Pipeline
        workflow.add_edge("dependency_optimization", "template_library")
        workflow.add_edge("template_library", "version_control")
        workflow.add_edge("version_control", "deployment_tracking")
        
        # Feedback & Finalization
        workflow.add_edge("deployment_tracking", "feedback_collection")
        workflow.add_edge("feedback_collection", "finalization")
        workflow.add_edge("finalization", END)
        
        compiled_workflow = workflow.compile()
        logger.info("Workflow graph compiled with 24 nodes (complete Phase 4)")
        
        return compiled_workflow
    
    def _check_approval(self, state: AgentState) -> str:
        """Check if generation was approved"""
        if state.get("generation_cancelled", False):
            return "cancelled"
        return "approved"
    
    def _should_refactor(self, state: AgentState) -> str:
        """Determine if code refactoring is needed"""
        error_analysis = state.get("error_analysis", {})
        
        if error_analysis.get("needs_fixes", False):
            suggested_fixes = error_analysis.get("suggested_fixes", [])
            if len(suggested_fixes) > 0:
                logger.info(f"Refactoring needed: {len(suggested_fixes)} fixes suggested")
                return "refactor"
        
        logger.info("Refactoring not needed")
        return "skip_refactor"
    
    def _calculate_quality_score(self, state: AgentState) -> float:
        """Calculate overall quality score (0-1)"""
        validation_score = state.get("validation_report", {}).get("overall_score", 0) / 100
        
        # Factor in security
        security_risk = state.get("security_report", {}).get("risk_score", 0) / 100
        security_score = 1.0 - security_risk
        
        # Factor in test coverage
        has_unit_tests = len(state.get("test_files", {})) > 0
        has_integration_tests = len(state.get("integration_tests", {})) > 0
        test_coverage_bonus = 0.0
        
        if has_unit_tests:
            test_coverage_bonus += 0.05
        if has_integration_tests:
            test_coverage_bonus += 0.05
        
        # Factor in performance
        performance_score = state.get("performance_report", {}).get("performance_score", 80) / 100
        
        # Weighted average
        quality_score = (
            validation_score * 0.4 +
            security_score * 0.3 +
            performance_score * 0.2 +
            test_coverage_bonus
        )
        
        return min(quality_score, 1.0)
    
    def _calculate_completeness_score(self, state: AgentState) -> float:
        """Calculate completeness score based on all Phase 4 components"""
        
        scores = []
        
        # Code generation
        if len(state.get("generated_code", {})) > 0:
            scores.append(1.0)
        else:
            scores.append(0.0)
        
        # Testing
        if len(state.get("test_files", {})) > 0:
            scores.append(1.0)
        else:
            scores.append(0.5)
        
        # Security
        security_status = state.get("security_report", {}).get("status", "error")
        if security_status in ["safe", "optimized"]:
            scores.append(1.0)
        elif security_status == "warnings":
            scores.append(0.7)
        else:
            scores.append(0.5)
        
        # Deployment readiness
        if state.get("deployment_instructions"):
            scores.append(1.0)
        else:
            scores.append(0.5)
        
        # Version control
        if state.get("git_initialized", False):
            scores.append(1.0)
        else:
            scores.append(0.7)
        
        return sum(scores) / len(scores) if scores else 0.0
    
    def generate_project(
        self,
        user_input: str,
        debug_mode: bool = False,
        config: Optional[Dict[str, Any]] = None
    ) -> Iterator[Dict[str, Any]]:
        """
        Generate a complete project from natural language description
        
        Yields status updates throughout execution
        """
        project_id = f"proj-{uuid.uuid4().hex[:8]}"
        logger.info(f"Starting streaming generation for project {project_id}")
        
        # Create initial state
        initial_state = create_initial_state(user_input, project_id, debug_mode, config)
        
        # Stream workflow execution
        try:
            for event in self.workflow.stream(initial_state):
                # Extract state updates
                for node_name, node_output in event.items():
                    if node_name == END:
                        continue
                    
                    # Yield progress update
                    yield {
                        "node": node_name,
                        "status": "completed",
                        "data": node_output,
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    # Save checkpoint
                    self.checkpoint_manager.save_checkpoint(
                        project_id,
                        node_name,
                        node_output
                    )
            
            # Final state
            final_state = self.workflow.invoke(initial_state)
            
            # Check if cancelled
            if final_state.get("generation_cancelled", False):
                yield {
                    "node": "cancellation",
                    "status": "cancelled",
                    "message": "Generation cancelled by user",
                    "timestamp": datetime.now().isoformat()
                }
                return
            
            # Calculate final metrics
            quality_score = self._calculate_quality_score(final_state)
            completeness_score = self._calculate_completeness_score(final_state)
            
            # Get all reports
            validation_report = final_state.get("validation_report", {})
            security_report = final_state.get("security_report", {})
            performance_report = final_state.get("performance_report", {})
            dependency_report = final_state.get("dependency_report", {})
            
            # Count issues
            all_issues = validation_report.get("issues", [])
            critical_issues = [i for i in all_issues if i.get("severity") in ["critical", "high"]]
            
            all_vulnerabilities = security_report.get("vulnerabilities", [])
            critical_vulnerabilities = [v for v in all_vulnerabilities if v.get("severity") in ["critical", "high"]]
            
            # Get integration test stats
            integration_stats = final_state.get("integration_test_stats", {})
            
            # Get refactor results
            refactor_result = final_state.get("refactor_result", {})
            
            # Get project management results
            template_saved = final_state.get("template_saved", False)
            git_initialized = final_state.get("git_initialized", False)
            deployment_url = final_state.get("deployment_url")
            
            # Get feedback
            user_feedback = final_state.get("user_feedback")
            
            final_metrics = {
                "project_id": project_id,
                
                # Code Generation
                "files_generated": len(final_state.get("generated_code", {})),
                
                # Testing
                "tests_generated": len(final_state.get("test_files", {})),
                "integration_test_stats": {
                    "total": integration_stats.get("total", 0),
                    "api_tests": integration_stats.get("api_tests", 0),
                    "component_tests": integration_stats.get("component_tests", 0),
                    "e2e_tests": integration_stats.get("e2e_tests", 0),
                },
                "performance_tests_generated": len(final_state.get("performance_tests", {})),
                
                # Quality Scores
                "validation_score": validation_report.get("overall_score", 0),
                "security_risk": security_report.get("risk_score", 0),
                "performance_score": performance_report.get("performance_score", 0),
                "quality_score": round(quality_score, 2),
                "completeness_score": round(completeness_score, 2),
                
                # Issues
                "issues_found": len(all_issues),
                "critical_issues": len(critical_issues),
                "vulnerabilities_found": len(all_vulnerabilities),
                "critical_vulnerabilities": len(critical_vulnerabilities),
                
                # Optimization
                "refactored": refactor_result.get("refactored", False),
                "refactor_changes": refactor_result.get("changes_made", 0),
                "performance_optimized": len(final_state.get("performance_optimizations", {})) > 0,
                "dependencies_optimized": len(dependency_report.get("unused_dependencies", [])),
                
                # Project Management
                "template_saved": template_saved,
                "git_initialized": git_initialized,
                "github_pushed": final_state.get("github_pushed", False),
                "deployed": deployment_url is not None,
                "deployment_url": deployment_url,
                
                # Human Interaction
                "approvals_requested": len(final_state.get("approval_results", [])),
                "feedback_collected": user_feedback is not None,
                
                # Status
                "status": self._determine_final_status(
                    quality_score,
                    completeness_score,
                    critical_issues,
                    critical_vulnerabilities
                )
            }
            
            yield {
                "node": "finalization",
                "status": "completed",
                "metrics": final_metrics,
                "timestamp": datetime.now().isoformat()
            }
            
            logger.info(
                f"Project finalized: {final_metrics['status']} - "
                f"Files: {final_metrics['files_generated']} - "
                f"Quality: {quality_score:.2f}"
            )
        
        except Exception as e:
            logger.error(f"Error during project generation: {e}")
            import traceback
            traceback.print_exc()
            yield {
                "node": "error",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _determine_final_status(
        self,
        quality_score: float,
        completeness_score: float,
        critical_issues: list,
        critical_vulnerabilities: list
    ) -> str:
        """Determine final project status"""
        
        # Critical failures
        if len(critical_vulnerabilities) > 0:
            return "completed_with_critical_security_issues"
        
        if len(critical_issues) > 5:
            return "completed_with_critical_issues"
        
        # Quality & Completeness based
        if quality_score >= 0.8 and completeness_score >= 0.9:
            return "completed_successfully"
        elif quality_score >= 0.7 and completeness_score >= 0.7:
            return "completed_with_minor_issues"
        elif quality_score >= 0.6:
            return "completed_with_warnings"
        else:
            return "completed_with_errors"


# Global orchestrator instance
orchestrator = DeepAgentOrchestrator()
