"""
Agent Roles and Responsibilities
Defines all specialist agent roles and their configurations.
"""

from typing import Dict, List, Any
from pydantic import BaseModel
from enum import Enum


class AgentRole(str, Enum):
    """Enumeration of available agent roles"""
    ARCHITECT = "architect"
    FRONTEND = "frontend"
    BACKEND = "backend"
    MOBILE = "mobile"
    QA = "qa"
    DEVOPS = "devops"
    VALIDATOR = "validator"


class AgentConfig(BaseModel):
    """Configuration for a single agent"""
    name: str
    responsibility: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 4000
    outputs: List[str]
    tools: List[str] = []
    dependencies: List[str] = []


# Agent role definitions
AGENT_ROLES: Dict[str, Dict[str, Any]] = {
    "architect": {
        "name": "System Architect",
        "responsibility": "Design system architecture, select tech stack, create DB schema, define security plan",
        "model": "gpt-4-turbo",
        "temperature": 0.7,
        "max_tokens": 4000,
        "outputs": [
            "architecture.md",
            "system_diagram.mermaid",
            "requirements.json",
            "tech_stack.json",
            "db_schema.sql"
        ],
        "tools": ["requirement_parser", "tech_selector", "diagram_generator"],
        "dependencies": []
    },
    
    "frontend": {
        "name": "Frontend Developer",
        "responsibility": "Generate React/Next.js UI, components, routing, SSR/SSG, form validation",
        "model": "claude-3-5-sonnet-20241022",
        "temperature": 0.3,
        "max_tokens": 8000,
        "outputs": [
            "frontend/components/**/*.jsx",
            "frontend/pages/**/*.jsx",
            "frontend/styles/**/*.css",
            "package.json",
            "tailwind.config.js",
            "next.config.js"
        ],
        "tools": ["code_generator", "component_builder", "style_generator"],
        "dependencies": ["architect"]
    },
    
    "backend": {
        "name": "Backend Developer",
        "responsibility": "Generate REST/GraphQL API, data models, ORM migrations, auth (JWT), endpoints",
        "model": "claude-3-5-sonnet-20241022",
        "temperature": 0.3,
        "max_tokens": 8000,
        "outputs": [
            "backend/routes/**/*.py",
            "backend/models/**/*.py",
            "backend/controllers/**/*.py",
            "backend/middleware/**/*.py",
            "requirements.txt",
            "openapi.yaml",
            "alembic/versions/*.py"
        ],
        "tools": ["api_generator", "orm_generator", "auth_builder"],
        "dependencies": ["architect"]
    },
    
    "mobile": {
        "name": "Mobile Developer",
        "responsibility": "Generate React Native/Flutter app, native builds, API integration",
        "model": "claude-3-5-sonnet-20241022",
        "temperature": 0.3,
        "max_tokens": 8000,
        "outputs": [
            "mobile/src/**/*",
            "mobile/ios/**/*",
            "mobile/android/**/*",
            "package.json",
            "app.json",
            "metro.config.js"
        ],
        "tools": ["mobile_generator", "native_builder", "api_client_generator"],
        "dependencies": ["backend"]
    },
    
    "qa": {
        "name": "Quality Assurance Engineer",
        "responsibility": "Create unit tests, integration tests, E2E tests (Playwright/Detox)",
        "model": "gpt-3.5-turbo",
        "temperature": 0.2,
        "max_tokens": 4000,
        "outputs": [
            "tests/unit/**/*.test.js",
            "tests/integration/**/*.test.js",
            "tests/e2e/**/*.spec.js",
            "jest.config.js",
            "playwright.config.js"
        ],
        "tools": ["test_generator", "test_runner", "coverage_analyzer"],
        "dependencies": ["frontend", "backend", "mobile"]
    },
    
    "devops": {
        "name": "DevOps Engineer",
        "responsibility": "Create Dockerfiles, K8s manifests, Helm charts, CI/CD pipelines, health probes",
        "model": "gpt-4-turbo",
        "temperature": 0.4,
        "max_tokens": 4000,
        "outputs": [
            "Dockerfile",
            "docker-compose.yml",
            "k8s/deployment.yaml",
            "k8s/service.yaml",
            "k8s/ingress.yaml",
            "helm/Chart.yaml",
            ".github/workflows/ci-cd.yml",
            "deploy.sh"
        ],
        "tools": ["dockerfile_generator", "k8s_generator", "ci_pipeline_builder"],
        "dependencies": ["frontend", "backend", "mobile"]
    },
    
    "validator": {
        "name": "Code Validator",
        "responsibility": "Run static analysis, security scans, dependency checks, LLM code audits",
        "model": "gpt-3.5-turbo",
        "temperature": 0.1,
        "max_tokens": 2000,
        "outputs": [
            "validation_report.json",
            "security_report.json",
            "lint_results.json"
        ],
        "tools": ["static_analyzer", "security_scanner", "llm_auditor"],
        "dependencies": ["frontend", "backend", "mobile"]
    }
}


def get_agent_config(role: AgentRole) -> Dict[str, Any]:
    """Get configuration for a specific agent role"""
    return AGENT_ROLES.get(role.value, {})


def get_execution_order() -> List[str]:
    """Get optimal execution order based on dependencies"""
    return [
        "architect",
        "frontend",
        "backend",
        "mobile",
        "qa",
        "devops",
        "validator"
    ]
