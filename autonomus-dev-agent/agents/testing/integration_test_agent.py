"""
Integration Test Agent
Generates integration tests for API endpoints, database interactions,
and component integration testing.
"""

from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re

logger = logging.getLogger(__name__)


class IntegrationTestAgent:
    """Agent that generates integration tests for APIs and components"""
    
    def __init__(self):
        """Initialize the integration test agent"""
        model_config = FRAMEWORK_CONFIG.model_configs["testing"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.3,
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
        )
        logger.info("Integration Test Agent initialized")
    
    def _extract_json(self, content: str) -> str:
        """Extract JSON from response"""
        if not content:
            return "{}"
        
        # Remove markdown code fences
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
        
        # Extract JSON object
        first_brace = content.find('{')
        last_brace = content.rfind('}')
        if first_brace != -1 and last_brace != -1:
            content = content[first_brace:last_brace+1]
        
        return content.strip()
    
    def _identify_api_endpoints(self, generated_code: Dict[str, str]) -> List[Dict[str, Any]]:
        """Identify API endpoints from backend code"""
        endpoints = []
        
        for filepath, content in generated_code.items():
            # Look for route/API files
            if not any(pattern in filepath.lower() for pattern in ["route", "api", "controller", "endpoint"]):
                continue
            
            # Extract route patterns (simplified)
            # Express.js patterns
            express_routes = re.findall(r'(router|app)\.(get|post|put|delete|patch)\(["\']([^"\']+)', content)
            for match in express_routes:
                method = match[1].upper()
                path = match[2]
                endpoints.append({
                    "file": filepath,
                    "method": method,
                    "path": path,
                    "framework": "express"
                })
            
            # FastAPI patterns
            fastapi_routes = re.findall(r'@app\.(get|post|put|delete|patch)\(["\']([^"\']+)', content)
            for match in fastapi_routes:
                method = match[0].upper()
                path = match[1]
                endpoints.append({
                    "file": filepath,
                    "method": method,
                    "path": path,
                    "framework": "fastapi"
                })
        
        return endpoints
    
    def _identify_components(self, generated_code: Dict[str, str]) -> List[Dict[str, Any]]:
        """Identify React/Vue components for integration testing"""
        components = []
        
        for filepath, content in generated_code.items():
            # Look for component files
            if not any(pattern in filepath.lower() for pattern in ["component", "page", ".tsx", ".jsx", ".vue"]):
                continue
            
            # Skip test files
            if "test" in filepath.lower() or "spec" in filepath.lower():
                continue
            
            # Extract component name from filepath
            component_name = filepath.split('/')[-1].replace('.tsx', '').replace('.jsx', '').replace('.vue', '')
            
            components.append({
                "file": filepath,
                "name": component_name,
                "has_props": "props" in content.lower() or "interface" in content.lower(),
                "has_state": "useState" in content or "reactive" in content,
                "has_effects": "useEffect" in content or "onMounted" in content,
            })
        
        return components
    
    def generate_api_tests(
        self,
        generated_code: Dict[str, str],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate integration tests for API endpoints"""
        
        endpoints = self._identify_api_endpoints(generated_code)
        
        if not endpoints:
            logger.info("No API endpoints found for integration testing")
            return {}
        
        backend_framework = tech_stack.get("backend", {}).get("framework", "nodejs-express")
        database = tech_stack.get("database", {}).get("primary", "mongodb")
        
        system_prompt = f"""You are an expert in API integration testing for {backend_framework}.

Generate comprehensive integration tests as a JSON object where:
- Keys are test file paths (e.g., "backend/tests/integration/api.test.js")
- Values are complete test file contents

Use appropriate testing frameworks:
- Express/Node.js: Supertest + Jest/Mocha
- FastAPI: pytest + httpx/TestClient

Include tests for:
1. **HTTP Methods**: GET, POST, PUT, DELETE
2. **Status Codes**: 200, 201, 400, 401, 404, 500
3. **Request/Response**: Headers, body validation, query params
4. **Database Integration**: CRUD operations with {database}
5. **Authentication**: JWT/OAuth token validation
6. **Error Handling**: Invalid input, missing fields, server errors
7. **Edge Cases**: Empty payloads, malformed JSON, rate limiting

Each test should:
- Set up test database/fixtures
- Make actual HTTP requests
- Assert response structure and data
- Clean up after tests

Output ONLY valid JSON."""
        
        endpoints_summary = "\n".join([
            f"- {ep['method']} {ep['path']} (in {ep['file']})"
            for ep in endpoints[:10]
        ])
        
        user_prompt = f"""Generate integration tests for these API endpoints:

**ENDPOINTS:**
{endpoints_summary}

**BACKEND:** {backend_framework}
**DATABASE:** {database}

Create comprehensive integration test suites with:
1. Setup and teardown (database, test server)
2. Happy path tests (valid requests)
3. Error path tests (invalid data, auth failures)
4. Database interaction tests
5. Authentication/authorization tests

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
                    logger.info(f"Generated {len(test_files)} API integration test files")
                    return test_files
                return {}
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse API test JSON: {e}")
                return {}
        
        except Exception as e:
            logger.error(f"Error generating API integration tests: {e}")
            return {}
    
    def generate_component_integration_tests(
        self,
        generated_code: Dict[str, str],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate integration tests for component interactions"""
        
        components = self._identify_components(generated_code)
        
        if not components:
            logger.info("No components found for integration testing")
            return {}
        
        frontend_framework = tech_stack.get("frontend", {}).get("framework", "react")
        
        system_prompt = f"""You are an expert in frontend integration testing for {frontend_framework}.

Generate component integration tests as a JSON object where:
- Keys are test file paths (e.g., "frontend/src/__tests__/integration/App.integration.test.tsx")
- Values are complete test file contents

Use appropriate testing frameworks:
- React: Jest + React Testing Library + MSW (Mock Service Worker)
- Vue: Vitest + Vue Test Utils
- Next.js: Jest + React Testing Library + next/router mocks

Focus on:
1. **Component Interactions**: Parent-child communication, prop drilling
2. **State Management**: Context API, Redux, Pinia
3. **API Integration**: Mock API calls with MSW or jest.mock
4. **User Flows**: Multi-step interactions (form submit → success message)
5. **Routing**: Navigation between pages/components
6. **Side Effects**: useEffect, data fetching, timers
7. **Error Boundaries**: Error handling and fallbacks

Each test should:
- Render component tree (not isolated)
- Simulate real user interactions
- Test data flow between components
- Mock external dependencies (APIs, localStorage)
- Assert on integrated behavior

Output ONLY valid JSON."""
        
        components_summary = "\n".join([
            f"- {comp['name']} (in {comp['file']}): Props={comp['has_props']}, State={comp['has_state']}"
            for comp in components[:8]
        ])
        
        user_prompt = f"""Generate integration tests for these components:

**COMPONENTS:**
{components_summary}

**FRAMEWORK:** {frontend_framework}

Create integration test suites with:
1. Component tree rendering (multiple components)
2. User interaction flows (click → state change → render)
3. API call mocking with MSW
4. Context/state management tests
5. Routing and navigation tests

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
                    logger.info(f"Generated {len(test_files)} component integration test files")
                    return test_files
                return {}
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse component test JSON: {e}")
                return {}
        
        except Exception as e:
            logger.error(f"Error generating component integration tests: {e}")
            return {}
    
    def generate_e2e_tests(
        self,
        requirements: Dict[str, Any],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate end-to-end tests using Playwright/Cypress"""
        
        features = requirements.get("features", [])
        if not features:
            logger.info("No features found for E2E testing")
            return {}
        
        # Extract feature names
        feature_names = []
        for f in features[:5]:
            if isinstance(f, dict):
                feature_names.append(f.get("name", str(f)))
            else:
                feature_names.append(str(f))
        
        system_prompt = """You are an expert in end-to-end testing with Playwright/Cypress.

Generate E2E tests as a JSON object where:
- Keys are test file paths (e.g., "e2e/tests/user-flow.spec.ts")
- Values are complete test file contents

Use Playwright (preferred) or Cypress for:
1. **User Journeys**: Complete workflows from start to finish
2. **Cross-Component Flows**: Navigate between pages/views
3. **Form Submissions**: Fill forms, submit, verify results
4. **Authentication**: Login, logout, protected routes
5. **API Integration**: Real backend calls (with test data)
6. **Visual Testing**: Screenshots, accessibility checks
7. **Browser Actions**: Click, type, scroll, drag-drop

Each test should:
- Start from a clean state (setup)
- Simulate real user behavior
- Test complete workflows end-to-end
- Assert on visible UI changes
- Handle async operations (waitFor)
- Clean up after tests

Include:
- Playwright config (playwright.config.ts)
- Page Object Models for maintainability
- Fixtures and test data setup

Output ONLY valid JSON."""
        
        features_str = ", ".join(feature_names)
        project_name = requirements.get("project_name", "app")
        
        user_prompt = f"""Generate E2E tests for this application:

**PROJECT:** {project_name}
**FEATURES:** {features_str}
**TECH STACK:** {json.dumps(tech_stack, indent=2)}

Create E2E test suites with:
1. User authentication flow (if applicable)
2. Main feature workflows (CRUD operations)
3. Navigation and routing tests
4. Form validation and submission
5. Error handling scenarios

Include:
- playwright.config.ts or cypress.config.js
- Test files for each major feature
- Page Object Models (optional but recommended)

Output as JSON with file paths as keys."""
        
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
                    logger.info(f"Generated {len(test_files)} E2E test files")
                    return test_files
                return {}
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse E2E test JSON: {e}")
                return {}
        
        except Exception as e:
            logger.error(f"Error generating E2E tests: {e}")
            return {}
    
    def generate_all_integration_tests(
        self,
        generated_code: Dict[str, str],
        requirements: Dict[str, Any],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate all types of integration tests"""
        
        all_tests = {}
        
        # 1. API integration tests
        logger.info("Generating API integration tests...")
        api_tests = self.generate_api_tests(generated_code, tech_stack)
        all_tests.update(api_tests)
        
        # 2. Component integration tests
        logger.info("Generating component integration tests...")
        component_tests = self.generate_component_integration_tests(generated_code, tech_stack)
        all_tests.update(component_tests)
        
        # 3. E2E tests
        logger.info("Generating E2E tests...")
        e2e_tests = self.generate_e2e_tests(requirements, tech_stack)
        all_tests.update(e2e_tests)
        
        return all_tests


def integration_test_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for integration test generation"""
    agent = IntegrationTestAgent()
    
    try:
        generated_code = state.get("generated_code", {})
        requirements = state.get("requirements", {})
        tech_stack = state.get("tech_stack", {})
        
        if not generated_code:
            logger.info("Skipping integration test generation - no code generated")
            return {
                "integration_tests": {},
                "logs": [{
                    "phase": "integration_test_generation",
                    "message": "Skipped integration tests - no code available",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        # Generate all types of integration tests
        integration_tests = agent.generate_all_integration_tests(
            generated_code,
            requirements,
            tech_stack
        )
        
        # Add integration tests to generated code
        updated_code = state.get("generated_code", {})
        updated_code.update(integration_tests)
        
        # Count test types
        api_test_count = sum(1 for path in integration_tests.keys() if "api" in path.lower() or "route" in path.lower())
        component_test_count = sum(1 for path in integration_tests.keys() if "component" in path.lower())
        e2e_test_count = sum(1 for path in integration_tests.keys() if "e2e" in path.lower() or "playwright" in path.lower() or "cypress" in path.lower())
        
        return {
            "generated_code": updated_code,
            "integration_tests": integration_tests,
            "integration_test_stats": {
                "total": len(integration_tests),
                "api_tests": api_test_count,
                "component_tests": component_test_count,
                "e2e_tests": e2e_test_count
            },
            "logs": [{
                "phase": "integration_test_generation",
                "message": f"Generated {len(integration_tests)} integration tests (API: {api_test_count}, Component: {component_test_count}, E2E: {e2e_test_count})",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Integration test generation node error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "integration_tests": {},
            "logs": [{
                "phase": "integration_test_generation",
                "message": f"Integration test generation failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
