"""
Mobile Code Generation Agent
Generates React Native/Flutter mobile code using Gemini 2.5 Pro.
"""

from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re
import traceback

logger = logging.getLogger(__name__)


class MobileGenerator:
    """Agent that generates mobile app code using Gemini 2.5 Pro"""
    
    def __init__(self):
        """Initialize the mobile generator with Gemini 2.5 Pro"""
        model_config = FRAMEWORK_CONFIG.model_configs["code"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=model_config["temperature"],
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
            top_p=model_config.get("top_p", 0.9),
        )
        logger.info(f"Mobile Generator initialized with {model_config['model']} (Gemini 2.5 Pro)")
    
    def _extract_json(self, content: str) -> str:
        """Extract JSON from response with multiple fallback strategies"""
        if not content:
            return "{}"
        
        # Strategy 1: Remove markdown code fences
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
        
        # Strategy 2: Find JSON object with regex
        json_pattern = r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}"
        matches = re.findall(json_pattern, content, re.DOTALL)
        if matches:
            # Try largest valid JSON
            for match in sorted(matches, key=len, reverse=True):
                try:
                    json.loads(match)
                    return match
                except Exception:
                    continue
        
        return content.strip()
    
    def generate_code(
        self,
        requirements: Dict[str, Any],
        tech_stack: Dict[str, Any],
        architecture: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate mobile code based on requirements using Gemini 2.5 Pro"""
        
        # Add None checks
        if tech_stack is None:
            tech_stack = {}
        if requirements is None:
            requirements = {}
        if architecture is None:
            architecture = {}
        
        mobile_tech = tech_stack.get("mobile")
        
        # Skip mobile generation if not required
        platforms = requirements.get("platforms", [])
        if not mobile_tech and "mobile" not in platforms:
            logger.info("Mobile platform not required, skipping mobile code generation")
            return {}
        
        # Ensure mobile_tech is a dict
        if not isinstance(mobile_tech, dict):
            mobile_tech = {"framework": str(mobile_tech) if mobile_tech else "react-native"}
        
        framework = mobile_tech.get("framework", "react-native")
        
        system_prompt = f"""You are an expert {framework} mobile developer.

Generate mobile app code as a JSON object where:
- Keys are file paths (e.g., "mobile/package.json")
- Values are file contents as strings

Use simple, clean code. Focus on structure over complexity.

Return ONLY the JSON object."""
        
        user_prompt = f"""Create a basic {framework} mobile app with:
- package.json
- App.tsx
- 2 screens

Project: {requirements.get('project_name', 'mobile-app')}

Return simple, valid JSON."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = response.content if hasattr(response, "content") else str(response)
            
            # Extract and clean JSON
            content = self._extract_json(content)
            
            try:
                code_files = json.loads(content)
                if isinstance(code_files, dict):
                    logger.info(f"✓ Gemini 2.5 Pro generated {len(code_files)} mobile files")
                    return code_files
                logger.warning("Mobile response is not a dictionary, returning empty")
                return {}
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse mobile JSON: {e}")
                logger.debug(f"Raw content: {content[:500]}")
                return {}
        
        except Exception as e:
            logger.error(f"Error generating mobile code: {e}")
            traceback.print_exc()
            return {}


def mobile_generator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for mobile generation using Gemini 2.5 Pro"""
    generator = MobileGenerator()
    
    try:
        requirements = state.get("requirements", {})
        if not isinstance(requirements, dict):
            requirements = {}
        
        tech_stack = state.get("tech_stack", {})
        if not isinstance(tech_stack, dict):
            tech_stack = {}
        
        architecture = state.get("architecture", {})
        if not isinstance(architecture, dict):
            architecture = {}
        
        code_files = generator.generate_code(
            requirements,
            tech_stack,
            architecture,
        )
        
        generated_code = state.get("generated_code", {})
        if code_files and isinstance(code_files, dict) and not code_files.get("error"):
            generated_code.update(code_files)
        
        return {
            "generated_code": generated_code,
            "logs": [
                {
                    "phase": "mobile_generation",
                    "message": f"Generated {len(code_files)} mobile files using Gemini 2.5 Pro",
                    "timestamp": state.get("timestamp"),
                }
            ],
        }
    except Exception as e:
        logger.error(f"Mobile generation node error: {e}")
        traceback.print_exc()
        return {
            "generated_code": state.get("generated_code", {}),
            "logs": [
                {
                    "phase": "mobile_generation",
                    "message": f"Skipped mobile generation: {str(e)}",
                    "timestamp": state.get("timestamp"),
                }
            ],
            "errors": state.get("errors", []) + [str(e)],
        }
