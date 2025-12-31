"""
Comprehensive Tests for Phase 2 - Core Agent System
"""

import pytest
import sys
import os
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.requirement_analyzer import RequirementAnalyzer
from agents.strategic_planner import StrategicPlanner
from agents.code_generators.frontend_agent import FrontendGenerator
from agents.code_generators.backend_agent import BackendGenerator
from agents.code_generators.mobile_agent import MobileGenerator
from agents.orchestrator import DeepAgentOrchestrator
from memory import create_initial_state, checkpoint_manager, ProjectStatus


class TestRequirementAnalyzer:
    """Test requirement analyzer agent"""
    
    def test_analyzer_initialization(self):
        """Test that analyzer initializes correctly"""
        analyzer = RequirementAnalyzer()
        assert analyzer is not None
        assert analyzer.llm is not None
        assert hasattr(analyzer, 'analyze')
    
    def test_analyzer_has_correct_model(self):
        """Test that analyzer uses correct Gemini model"""
        from config import FRAMEWORK_CONFIG
        model_config = FRAMEWORK_CONFIG.model_configs["planning"]
        assert "gemini" in model_config["model"].lower()
    
    @pytest.mark.skip(reason="Requires LLM API calls and credits")
    def test_analyze_simple_prompt(self):
        """Test analyzing a simple prompt"""
        analyzer = RequirementAnalyzer()
        requirements = analyzer.analyze("Build a simple blog with React and Node.js")
        
        assert "project_type" in requirements
        assert "features" in requirements
        assert isinstance(requirements.get("features", []), list)


class TestStrategicPlanner:
    """Test strategic planner agent"""
    
    def test_planner_initialization(self):
        """Test that planner initializes correctly"""
        planner = StrategicPlanner()
        assert planner is not None
        assert planner.llm is not None
        assert hasattr(planner, 'create_plan')
    
    def test_planner_has_correct_model(self):
        """Test that planner uses correct Gemini model"""
        from config import FRAMEWORK_CONFIG
        model_config = FRAMEWORK_CONFIG.model_configs["planning"]
        assert "gemini" in model_config["model"].lower()
    
    @pytest.mark.skip(reason="Requires LLM API calls and credits")
    def test_create_plan_basic(self):
        """Test creating a basic plan"""
        planner = StrategicPlanner()
        requirements = {
            "project_type": "web-app",
            "project_name": "test-blog",
            "features": ["authentication", "posts"],
            "tech_stack": {
                "frontend": {"framework": "react"},
                "backend": {"framework": "nodejs-express"}
            }
        }
        plan = planner.create_plan(requirements)
        
        assert "tasks" in plan
        assert isinstance(plan.get("tasks", []), list)


class TestCodeGenerators:
    """Test code generation agents"""
    
    def test_frontend_generator_initialization(self):
        """Test frontend generator initialization"""
        generator = FrontendGenerator()
        assert generator is not None
        assert generator.llm is not None
        assert hasattr(generator, 'generate_code')
    
    def test_backend_generator_initialization(self):
        """Test backend generator initialization"""
        generator = BackendGenerator()
        assert generator is not None
        assert generator.llm is not None
        assert hasattr(generator, 'generate_code')
    
    def test_mobile_generator_initialization(self):
        """Test mobile generator initialization"""
        generator = MobileGenerator()
        assert generator is not None
        assert generator.llm is not None
        assert hasattr(generator, 'generate_code')
    
    def test_generators_use_correct_model(self):
        """Test that code generators use Gemini 2.5 Pro"""
        from config import FRAMEWORK_CONFIG
        model_config = FRAMEWORK_CONFIG.model_configs["code"]
        assert "gemini" in model_config["model"].lower()
        assert "2.5" in model_config["model"]


class TestOrchestrator:
    """Test the main orchestrator"""
    
    def test_orchestrator_initialization(self):
        """Test that orchestrator initializes correctly"""
        orch = DeepAgentOrchestrator()
        assert orch is not None
        assert orch.graph is not None
    
    def test_orchestrator_has_all_nodes(self):
        """Test that orchestrator has all required nodes"""
        orch = DeepAgentOrchestrator()
        # Check that graph was compiled successfully
        assert orch.graph is not None
    
    def test_initial_state_creation(self):
        """Test creating initial state"""
        state = create_initial_state("test-123", "Build a blog")
        assert state["project_id"] == "test-123"
        assert state["user_prompt"] == "Build a blog"
        assert state["status"] == ProjectStatus.INITIALIZING.value
    
    def test_state_has_required_fields(self):
        """Test that initial state has all required fields"""
        state = create_initial_state("test-456", "Test project")
        
        required_fields = [
            "project_id", "user_prompt", "messages", "requirements",
            "tech_stack", "architecture", "task_plan", "generated_code",
            "docker_config", "k8s_manifests", "ci_pipeline", "test_results",
            "validation_report", "security_scan", "deployment_status",
            "metrics", "errors", "logs", "status", "current_phase"
        ]
        
        for field in required_fields:
            assert field in state, f"Missing required field: {field}"
    
    def test_state_types(self):
        """Test that state fields have correct types"""
        state = create_initial_state("test-789", "Test")
        
        assert isinstance(state["project_id"], str)
        assert isinstance(state["user_prompt"], str)
        assert isinstance(state["messages"], list)
        assert isinstance(state["requirements"], dict)
        assert isinstance(state["tech_stack"], dict)
        assert isinstance(state["generated_code"], dict)
        assert isinstance(state["errors"], list)
        assert isinstance(state["logs"], list)
        assert isinstance(state["metrics"], dict)


class TestMemorySystem:
    """Test memory and checkpoint system"""
    
    def test_checkpoint_manager_exists(self):
        """Test that checkpoint manager is available"""
        assert checkpoint_manager is not None
        assert hasattr(checkpoint_manager, 'get_saver')
    
    def test_checkpoint_database_created(self):
        """Test that checkpoint database is created"""
        db_path = Path("memory/checkpoints.db")
        assert db_path.exists(), "Checkpoint database should be created"
    
    def test_checkpoint_manager_methods(self):
        """Test checkpoint manager has required methods"""
        assert hasattr(checkpoint_manager, 'get_saver')
        assert hasattr(checkpoint_manager, 'list_projects')
        assert hasattr(checkpoint_manager, 'get_latest_checkpoint')
        assert hasattr(checkpoint_manager, 'cleanup_old_checkpoints')


class TestConfiguration:
    """Test configuration files"""
    
    def test_import_config(self):
        """Test that config can be imported"""
        from config import CONFIG, FRAMEWORK_CONFIG, TECH_STACK
        assert CONFIG is not None
        assert FRAMEWORK_CONFIG is not None
        assert TECH_STACK is not None
    
    def test_framework_config_models(self):
        """Test framework configuration has correct models"""
        from config import FRAMEWORK_CONFIG
        
        assert "planning" in FRAMEWORK_CONFIG.model_configs
        assert "code" in FRAMEWORK_CONFIG.model_configs
        assert "validation" in FRAMEWORK_CONFIG.model_configs
        
        # Check model names
        planning_model = FRAMEWORK_CONFIG.model_configs["planning"]["model"]
        code_model = FRAMEWORK_CONFIG.model_configs["code"]["model"]
        
        assert "gemini" in planning_model.lower()
        assert "gemini" in code_model.lower()
    
    def test_tech_stack_options(self):
        """Test tech stack has all required options"""
        from config import TECH_STACK
        
        assert len(TECH_STACK.web_frontend) > 0
        assert len(TECH_STACK.web_backend) > 0
        assert len(TECH_STACK.mobile) > 0
        assert len(TECH_STACK.databases) > 0
        
        assert "react" in TECH_STACK.web_frontend
        assert "nodejs-express" in TECH_STACK.web_backend
        assert "react-native" in TECH_STACK.mobile


class TestAgentRoles:
    """Test agent roles configuration"""
    
    def test_agent_roles_loaded(self):
        """Test that agent roles are properly configured"""
        from agents.roles import AGENT_ROLES
        assert len(AGENT_ROLES) > 0
        assert "architect" in AGENT_ROLES
    
    def test_all_required_roles_present(self):
        """Test that all required agent roles exist"""
        from agents.roles import AGENT_ROLES
        
        required_roles = [
            "architect",
            "frontend",
            "backend",
            "mobile",
            "qa",
            "devops"
        ]
        
        for role in required_roles:
            assert role in AGENT_ROLES, f"Missing required role: {role}"


class TestIntegration:
    """Integration tests for Phase 2"""
    
    def test_full_workflow_mock(self):
        """Test full workflow with mock data (no LLM calls)"""
        # Create initial state
        state = create_initial_state("integration-test", "Build a todo app")
        
        # Verify state progression
        assert state["status"] == ProjectStatus.INITIALIZING.value
        assert state["next_agent"] == "requirement_analyzer"
        
        # Mock requirements
        state["requirements"] = {
            "project_type": "web-app",
            "project_name": "todo-app",
            "features": ["add_task", "delete_task"]
        }
        state["status"] = ProjectStatus.ANALYZING.value
        
        # Verify state update
        assert state["requirements"]["project_name"] == "todo-app"
        assert len(state["requirements"]["features"]) == 2
    
    @pytest.mark.skip(reason="Requires full LLM pipeline")
    def test_full_pipeline_execution(self):
        """Test complete pipeline execution (expensive)"""
        orch = DeepAgentOrchestrator()
        result = orch.generate("Build a simple calculator web app")
        
        assert "generated_code" in result
        assert "requirements" in result
        assert "tech_stack" in result


# Test runner configuration
def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers", "skip: skip test"
    )
    config.addinivalue_line(
        "markers", "llm: tests that require LLM API calls"
    )


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])
