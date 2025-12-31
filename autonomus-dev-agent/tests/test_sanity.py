"""
Sanity tests to verify basic system functionality
"""

import pytest
import os
from pathlib import Path


class TestEnvironment:
    """Test environment setup and configuration"""
    
    def test_env_file_exists(self):
        """Verify .env file exists"""
        assert Path(".env").exists(), ".env file not found"
    
    def test_required_directories(self):
        """Verify all required directories exist"""
        required_dirs = [
            "agents",
            "config",
            "memory",
            "tools",
            "validators",
            "deployers",
            "tests",
            "artifacts",
            "logs"
        ]
        
        for dir_name in required_dirs:
            assert Path(dir_name).exists(), f"Directory {dir_name}/ not found"


class TestConfiguration:
    """Test configuration loading"""
    
    def test_import_config(self):
        """Test that config can be imported"""
        from config import CONFIG, FRAMEWORK_CONFIG, TECH_STACK
        assert CONFIG is not None
        assert FRAMEWORK_CONFIG is not None
        assert TECH_STACK is not None
    
    def test_agent_roles_loaded(self):
        """Test that agent roles are properly defined"""
        from agents.roles import AGENT_ROLES, AgentRole
        assert len(AGENT_ROLES) > 0
        assert "architect" in AGENT_ROLES
        assert "frontend" in AGENT_ROLES
        assert "backend" in AGENT_ROLES


class TestPackageImports:
    """Test that all packages can be imported"""
    
    def test_import_langgraph(self):
        """Test LangGraph import"""
        import langgraph
        assert langgraph is not None
    
    def test_import_langchain(self):
        """Test LangChain import"""
        import langchain
        assert langchain is not None
    
    def test_import_pydantic(self):
        """Test Pydantic import"""
        import pydantic
        assert pydantic is not None
    
    @pytest.mark.skipif(
        not os.getenv("DOCKER_AVAILABLE"),
        reason="Docker not available"
    )
    def test_import_docker(self):
        """Test Docker SDK import"""
        import docker
        assert docker is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
