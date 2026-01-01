"""
Strategic Planning Agent
Creates detailed implementation plan with tasks and dependencies.
Uses Gemini 2.5 Pro for advanced planning.
"""

from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re  # ADD THIS

logger = logging.getLogger(__name__)


class StrategicPlanner:
    """Agent that creates strategic implementation plans using Gemini 2.5 Pro"""
    
    def __init__(self):
        """Initialize the strategic planner with Gemini 2.5 Pro"""
        model_config = FRAMEWORK_CONFIG.model_configs["planning"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=model_config["temperature"],
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
            top_p=model_config.get("top_p", 0.95)
        )
        logger.info(f"Strategic Planner initialized with {model_config['model']}")
    
    # ADD THIS METHOD
    def _extract_json(self, content: str) -> str:
        """Extract JSON from response"""
        if not content:
            return "{}"
        
        # Remove markdown code fences
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
    
    def create_plan(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Create detailed implementation plan from requirements"""
        
        # Simplified prompt
        system_prompt = """You are a software architect and project planner.

Create an implementation plan as a JSON object with:
- architecture: {pattern, components[]}
- tech_stack: {frontend, backend, database}
- tasks: [{id, title, agent, dependencies[], complexity, estimated_time}]

Keep it simple and valid JSON."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Plan for: {json.dumps(requirements, indent=2)}\n\nReturn ONLY JSON.")
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = response.content if hasattr(response, 'content') else str(response)
            
            # USE NEW EXTRACTION
            content = self._extract_json(content)
            
            try:
                plan = json.loads(content)
                logger.info(f"Successfully created plan with {len(plan.get('tasks', []))} tasks")
                return plan
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse plan JSON: {e}")
                # Return minimal valid plan
                return {
                    "architecture": {"pattern": "monolithic", "components": []},
                    "tech_stack": requirements.get("tech_stack", {}),
                    "tasks": [],
                    "error": str(e)
                }
            
        except Exception as e:
            logger.error(f"Error creating plan: {e}")
            return {
                "architecture": {},
                "tech_stack": {},
                "tasks": [],
                "error": str(e)
            }


def strategic_planner_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for strategic planning"""
    planner = StrategicPlanner()
    plan = planner.create_plan(state.get("requirements", {}))
    
    # Ensure tech_stack is properly set from requirements if not in plan
    tech_stack = plan.get("tech_stack", {})
    if not tech_stack:
        tech_stack = state.get("requirements", {}).get("tech_stack", {})
    
    # If still empty, infer from requirements
    if not tech_stack:
        requirements = state.get("requirements", {})
        project_type = str(requirements.get("project_type", "")).lower()
        user_input = str(state.get("user_input", "")).lower()
        
        if "web" in project_type or "website" in user_input or "webapp" in user_input:
            if "next" in user_input or "nextjs" in user_input:
                tech_stack["frontend"] = {"framework": "nextjs"}
            else:
                tech_stack["frontend"] = {"framework": "react"}
        
        if "full-stack" in project_type or "backend" in user_input or "api" in user_input:
            if "express" in user_input or "node" in user_input:
                tech_stack["backend"] = {"framework": "nodejs-express"}
            elif "fastapi" in user_input:
                tech_stack["backend"] = {"framework": "fastapi"}
            else:
                tech_stack["backend"] = {"framework": "nodejs-express"}
    
    return {
        "architecture": plan.get("architecture", {}),
        "tech_stack": tech_stack,
        "task_plan": plan.get("tasks", []),
        "logs": [{
            "phase": "strategic_planning",
            "message": f"Created plan with {len(plan.get('tasks', []))} tasks",
            "timestamp": state.get("timestamp")
        }],
        "next_agent": "code_generator"
    }
