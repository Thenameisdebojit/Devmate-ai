"""
Tests for Phase 3 - Validation and Deployment
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.validators.code_validator import CodeValidator, code_validator_node
from agents.deployment.devops_agent import DevOpsAgent, devops_agent_node
from agents.artifact_writer import ArtifactWriter, artifact_writer_node


class TestCodeValidator:
    """Test code validation agent"""
    
    def test_validator_initialization(self):
        """Test validator initializes correctly"""
        validator = CodeValidator()
        assert validator is not None
        assert validator.llm is not None
    
    def test_code_summarization(self):
        """Test code summarization for validation"""
        validator = CodeValidator()
        test_code = {
            "frontend/package.json": '{"name": "test"}',
            "frontend/src/App.tsx": "import React from 'react';\n" * 50
        }
        summary = validator._summarize_code(test_code)
        assert "frontend/package.json" in summary
        assert len(summary) < 5000  # Should be summarized


class TestDevOpsAgent:
    """Test DevOps agent"""
    
    def test_devops_initialization(self):
        """Test DevOps agent initializes"""
        agent = DevOpsAgent()
        assert agent is not None
    
    def test_basic_config_generation(self):
        """Test fallback config generation"""
        agent = DevOpsAgent()
        configs = agent._generate_basic_configs("test-app", {})
        assert "dockerfiles" in configs
        assert "docker_compose" in configs


class TestArtifactWriter:
    """Test artifact writer"""
    
    def test_writer_initialization(self):
        """Test writer initializes"""
        writer = ArtifactWriter(output_dir="test_artifacts")
        assert writer.output_dir.exists()
    
    def test_readme_generation(self):
        """Test README generation"""
        writer = ArtifactWriter()
        readme = writer._generate_readme({"status": "ok", "overall_score": 85})
        assert "85/100" in readme
        assert "Setup Instructions" in readme


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
