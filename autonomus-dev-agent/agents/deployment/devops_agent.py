"""
DevOps Agent
Generates Docker configurations and Kubernetes manifests for deployment.
"""

from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re

logger = logging.getLogger(__name__)


class DevOpsAgent:
    """Agent that generates deployment configurations"""
    
    def __init__(self):
        """Initialize DevOps agent with Gemini 2.5 Pro"""
        model_config = FRAMEWORK_CONFIG.model_configs["code"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.2,  # Lower for deterministic configs
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
            top_p=0.85,
        )
        logger.info(f"DevOps Agent initialized with {model_config['model']}")
    
    def _extract_json(self, content: str) -> str:
        """Extract JSON from response"""
        if not content:
            return "{}"
        
        if "```json" in content:
            try:
                parts = content.split("```json", 1)
                if len(parts) > 1:
                    end_parts = parts[1].split("```", 1)
                    content = end_parts[0].strip()
            except Exception:
                pass
        elif "```" in content:
            try:
                parts = content.split("```", 1)
                if len(parts) > 1:
                    end_parts = parts[1].split("```", 1)
                    content = end_parts[0].strip()
            except Exception:
                pass
        
        return content.strip()
    
    def generate_deployment_configs(
        self,
        requirements: Dict[str, Any],
        tech_stack: Dict[str, Any],
        generated_code: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate Docker and Kubernetes configurations
        
        Returns:
            Dictionary with docker_config and k8s_manifests
        """
        project_name = requirements.get("project_name", "app")
        
        system_prompt = """You are a DevOps and infrastructure expert.

Generate deployment configurations as a JSON object with:
- Dockerfiles for each service
- docker-compose.yml for local development
- Kubernetes deployment manifests
- CI/CD pipeline configuration

Return JSON with keys: "dockerfiles", "docker_compose", "kubernetes", "ci_cd"."""
        
        user_prompt = f"""Generate deployment configs for:

Project: {project_name}
Tech Stack: {json.dumps(tech_stack, indent=2)}
Files Generated: {list(generated_code.keys())[:10]}

Include:
1. Dockerfiles (frontend, backend, mobile if needed)
2. docker-compose.yml
3. Kubernetes manifests (deployment, service, ingress)
4. GitHub Actions CI/CD workflow

Return valid JSON."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = response.content if hasattr(response, "content") else str(response)
            content = self._extract_json(content)
            
            try:
                configs = json.loads(content)
                logger.info("Generated deployment configurations")
                return configs
            except json.JSONDecodeError:
                logger.warning("Failed to parse deployment configs JSON")
                return self._generate_basic_configs(project_name, tech_stack)
        
        except Exception as e:
            logger.error(f"Error generating deployment configs: {e}")
            return self._generate_basic_configs(project_name, tech_stack)
    
    def _generate_basic_configs(self, project_name: str, tech_stack: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback: generate basic configs without LLM"""
        return {
            "dockerfiles": {
                "frontend/Dockerfile": """FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]""",
                "backend/Dockerfile": """FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]"""
            },
            "docker_compose": """version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
  backend:
    build: ./backend
    ports:
      - "5000:5000"
""",
            "kubernetes": {
                "deployment.yaml": f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {project_name}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {project_name}
  template:
    metadata:
      labels:
        app: {project_name}
    spec:
      containers:
      - name: app
        image: {project_name}:latest
        ports:
        - containerPort: 3000"""
            },
            "ci_cd": {}
        }


def devops_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for deployment configuration generation"""
    agent = DevOpsAgent()
    
    try:
        requirements = state.get("requirements", {})
        tech_stack = state.get("tech_stack", {})
        generated_code = state.get("generated_code", {})
        
        configs = agent.generate_deployment_configs(requirements, tech_stack, generated_code)
        
        return {
            "docker_config": configs.get("dockerfiles", {}),
            "k8s_manifests": configs.get("kubernetes", {}),
            "ci_pipeline": configs.get("ci_cd", {}),
            "logs": [{
                "phase": "deployment_config",
                "message": "Generated Docker and K8s configurations",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"DevOps agent node error: {e}")
        return {
            "docker_config": {},
            "k8s_manifests": {},
            "logs": [{
                "phase": "deployment_config",
                "message": f"Deployment config generation failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
