"""
Unit Test Generator Agent
Automatically generates unit tests for generated code using Gemini 2.5 Pro.
"""

from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re

logger = logging.getLogger(__name__)


class UnitTestGenerator:
    """Agent that generates unit tests for code"""
    
    def __init__(self):
        """Initialize the unit test generator"""
        model_config = FRAMEWORK_CONFIG.model_configs["code"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.3,  # Lower temperature for consistent test generation
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
        )
        logger.info("Unit Test Generator initialized")
    
    def _extract_json(self, content: str) -> str:
        """Extract JSON from response"""
        if not content:
            return "{}"
        
        json_marker = "```json"
        code_fence = "```"
        
        if json_marker in content:
            parts = content.split(json_marker, 1)
            if len(parts) > 1:
                end_parts = parts[1].split(code_fence, 1)
                content = end_parts[0].strip()
        elif code_fence in content:
            parts = content.split(code_fence, 1)
            if len(parts) > 1:
                end_parts = parts[1].split(code_fence, 1)
                content = end_parts[0].strip()
        
        first_brace = content.find('{')
        last_brace = content.rfind('}')
        if first_brace != -1 and last_brace != -1:
            content = content[first_brace:last_brace+1]
        
        return content.strip()
    
    def generate_tests(
        self,
        generated_code: Dict[str, str],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate unit tests for the provided code"""
        
        if not generated_code:
            logger.warning("No code to generate tests for")
            return {}
        
        frontend_framework = tech_stack.get("frontend", {}).get("framework", "react")
        backend_framework = tech_stack.get("backend", {}).get("framework", "nodejs-express")
        
        # Identify testable files
        testable_files = {}
        for filepath, content in generated_code.items():
            # Skip config and non-code files
            if any(skip in filepath.lower() for skip in ["package.json", "config", ".env", "docker", "readme"]):
                continue
            
            # Focus on component and route files
            if any(pattern in filepath.lower() for pattern in ["component", "route", "api", "service", "model"]):
                testable_files[filepath] = content[:1000]  # First 1000 chars
        
        if not testable_files:
            logger.warning("No testable files found")
            return {}
        
        system_prompt = f"""You are an expert test engineer specializing in {frontend_framework} and {backend_framework}.

Generate comprehensive unit tests as a JSON object where:
- Keys are test file paths (e.g., "frontend/src/__tests__/App.test.tsx")
- Values are complete test file contents

Use appropriate testing frameworks:
- Frontend: Jest + React Testing Library
- Backend: Jest or Mocha/Chai

Include:
- Test setup and teardown
- Happy path tests
- Edge case tests
- Error handling tests
- Mock external dependencies

Output ONLY valid JSON."""
        
        files_summary = "\n".join([f"FILE: {fp}\n{content[:300]}..." for fp, content in list(testable_files.items())[:5]])
        
        user_prompt = f"""Generate unit tests for these files:

{files_summary}

Create comprehensive test suites with:
1. Component rendering tests (frontend)
2. API endpoint tests (backend)
3. Business logic tests
4. Error handling tests

Output as JSON with test file paths as keys."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = getattr(response, "content", str(response))
            
            content = self._extract_json(content)
            
            try:
                test_files = json.loads(content)
                if isinstance(test_files, dict) and test_files:
                    logger.info(f"Generated {len(test_files)} test files")
                    return test_files
                return {}
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse test JSON: {e}")
                return {}
        
        except Exception as e:
            logger.error(f"Error generating tests: {e}")
            return {}


def unit_test_generator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for unit test generation"""
    generator = UnitTestGenerator()
    
    try:
        generated_code = state.get("generated_code", {})
        tech_stack = state.get("tech_stack", {})
        
        if not generated_code:
            logger.info("Skipping test generation - no code generated")
            return {
                "test_files": {},
                "logs": [{
                    "phase": "test_generation",
                    "message": "Skipped test generation - no code available",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        test_files = generator.generate_tests(generated_code, tech_stack)
        
        # Add tests to generated code
        updated_code = state.get("generated_code", {})
        updated_code.update(test_files)
        
        return {
            "generated_code": updated_code,
            "test_files": test_files,
            "logs": [{
                "phase": "test_generation",
                "message": f"Generated {len(test_files)} unit test files",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Test generation node error: {e}")
        return {
            "test_files": {},
            "logs": [{
                "phase": "test_generation",
                "message": f"Test generation failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
