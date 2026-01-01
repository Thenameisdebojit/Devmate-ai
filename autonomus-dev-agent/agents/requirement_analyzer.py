"""
Requirement Analyzer Agent
Extracts and structures requirements from natural language.
Uses Gemini 1.5 Flash for advanced understanding.
"""

from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json

logger = logging.getLogger(__name__)


class RequirementAnalyzer:
    """Agent that analyzes and extracts requirements from user prompts using Gemini 1.5 Flash"""
    
    def __init__(self):
        """Initialize the requirement analyzer with Gemini 1.5 Flash"""
        model_config = FRAMEWORK_CONFIG.model_configs["planning"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=model_config["temperature"],
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
            top_p=model_config.get("top_p", 0.95)
        )
        logger.info(f"Requirement Analyzer initialized with {model_config['model']}")
    
    def analyze(self, user_prompt: str) -> Dict[str, Any]:
        """
        Analyze user prompt and extract structured requirements
        
        Args:
            user_prompt: Natural language description of the project
            
        Returns:
            Structured requirements dictionary
        """
        system_prompt = """You are an elite requirements analyst with expertise in software architecture and product design.

Your task is to deeply analyze the user's project description and extract comprehensive requirements:

1. **Project Classification**: Determine the exact type (web app, mobile app, full-stack, API, microservices, etc.)
2. **Core Features**: List all explicit and implicit features
3. **Technology Preferences**: Identify any tech stack preferences or constraints
4. **Data Requirements**: Database needs, data models, relationships
5. **Authentication & Security**: Auth mechanisms, security requirements, compliance needs
6. **Integration Needs**: Third-party APIs, external services, webhooks
7. **Deployment Strategy**: Cloud platform, scaling requirements, CI/CD preferences
8. **Non-Functional Requirements**: Performance SLAs, security standards, accessibility, scalability
9. **User Experience**: UI/UX requirements, responsive design, accessibility
10. **Business Constraints**: Budget, timeline, team size, maintenance considerations

Return ONLY a valid JSON object with all extracted requirements. DO NOT include any explanatory text before or after the JSON.
Be thorough, intelligent, and infer reasonable professional defaults when information is implicit.

**Output Format (JSON only, no other text):**
{
    "project_type": "full-stack-web" | "mobile-app" | "api-service" | "microservices",
    "project_name": "descriptive-name",
    "description": "Clear project description",
    "platforms": ["web", "mobile", "desktop"],
    "features": [
        {
            "name": "feature_name",
            "description": "Feature description",
            "priority": "high" | "medium" | "low",
            "complexity": "simple" | "moderate" | "complex"
        }
    ],
    "tech_stack": {
        "frontend": {
            "framework": "react",
            "styling": "tailwind",
            "state": "redux",
            "testing": "jest"
        },
        "backend": {
            "framework": "nodejs-express",
            "database": "mongodb",
            "orm": "mongoose",
            "auth": "jwt"
        },
        "mobile": {
            "framework": "react-native",
            "state": "redux"
        }
    },
    "database_requirements": {
        "type": "nosql" | "sql" | "hybrid",
        "primary": "mongodb",
        "cache": "redis",
        "estimated_records": 10000,
        "backup_strategy": "daily"
    },
    "authentication": {
        "type": "jwt" | "oauth2" | "session",
        "providers": ["email", "google", "github"],
        "mfa": false,
        "rbac": true
    },
    "deployment": {
        "target": "kubernetes" | "docker" | "serverless",
        "cloud_provider": "aws" | "gcp" | "azure",
        "regions": ["us-east-1"],
        "scaling": "horizontal",
        "environment": ["development", "staging", "production"]
    },
    "integrations": [
        {
            "name": "stripe",
            "purpose": "payments",
            "required": true
        }
    ],
    "non_functional": {
        "performance": {
            "response_time_ms": 200,
            "concurrent_users": 1000,
            "uptime_percentage": 99.9
        },
        "security": {
            "https": true,
            "encryption": "AES-256",
            "compliance": ["GDPR", "SOC2"]
        },
        "accessibility": "WCAG 2.1 AA"
    },
    "constraints": {
        "budget": "low" | "medium" | "high",
        "timeline": "2-weeks" | "1-month" | "3-months",
        "team_size": 1,
        "scalability_target": "10k-users" | "100k-users" | "1m-users"
    }
}"""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Project Description:\n{user_prompt}")
        ]
        
        try:
            response = self.llm.invoke(messages)
            
            # Extract JSON from response content
            content = response.content
            
            # Handle markdown code blocks - IMPROVED JSON EXTRACTION
            if "```json" in content:
                # Extract content between ```json and ```
                start = content.find("```json") + 7
                end = content.find("```", start)
                if end != -1:
                    content = content[start:end].strip()
            elif "```" in content:
                # Extract content between first ``` blocks
                parts = content.split("```")
                if len(parts) >= 3:
                    content = parts[1].strip()
                    # Remove language identifier if present
                    if content.startswith("json\n"):
                        content = content[5:].strip()
                    elif content.startswith("json "):
                        content = content[5:].strip()
            else:
                # Try to find JSON object directly (no code blocks)
                start = content.find("{")
                end = content.rfind("}")
                if start != -1 and end != -1:
                    content = content[start:end+1]
            
            # Parse JSON
            requirements = json.loads(content)
            
            # Ensure tech_stack is properly structured
            if "tech_stack" not in requirements:
                requirements["tech_stack"] = {}
            
            # For web apps, ensure frontend is set
            project_type = requirements.get("project_type", "").lower()
            user_prompt_lower = user_prompt.lower()
            
            if "web" in project_type or "website" in user_prompt_lower or "webapp" in user_prompt_lower:
                if "frontend" not in requirements["tech_stack"]:
                    # Infer from prompt
                    if "next" in user_prompt_lower or "nextjs" in user_prompt_lower:
                        requirements["tech_stack"]["frontend"] = {"framework": "nextjs"}
                    elif "react" in user_prompt_lower:
                        requirements["tech_stack"]["frontend"] = {"framework": "react"}
                    else:
                        requirements["tech_stack"]["frontend"] = {"framework": "react"}  # Default
            
            # For full-stack or if backend mentioned, ensure backend is set
            if "full-stack" in project_type or "backend" in user_prompt_lower or "api" in user_prompt_lower:
                if "backend" not in requirements["tech_stack"]:
                    if "express" in user_prompt_lower or "node" in user_prompt_lower:
                        requirements["tech_stack"]["backend"] = {"framework": "nodejs-express"}
                    elif "fastapi" in user_prompt_lower:
                        requirements["tech_stack"]["backend"] = {"framework": "fastapi"}
                    else:
                        requirements["tech_stack"]["backend"] = {"framework": "nodejs-express"}  # Default
            
            logger.info(f"Successfully analyzed requirements for: {requirements.get('project_name', 'unnamed project')}")
            logger.info(f"Detected {len(requirements.get('features', []))} features")
            logger.info(f"Tech stack: frontend={requirements.get('tech_stack', {}).get('frontend')}, backend={requirements.get('tech_stack', {}).get('backend')}")
            return requirements
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse requirements JSON: {e}")
            logger.error(f"Raw response: {response.content[:500]}")
            # Return basic structure on error
            return {
                "project_type": "unknown",
                "project_name": "untitled-project",
                "description": user_prompt,
                "features": [],
                "tech_stack": {},
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"Error analyzing requirements: {e}")
            raise


def requirement_analyzer_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node function for requirement analysis
    
    Args:
        state: Current agent state
        
    Returns:
        Updated state with requirements
    """
    analyzer = RequirementAnalyzer()
    
    try:
        # FIX: Changed from state["user_prompt"] to state["user_input"]
        user_input = state.get("user_input", "")
        requirements = analyzer.analyze(user_input)
        
        # Ensure user_input and description are in requirements for code generators
        if "user_input" not in requirements:
            requirements["user_input"] = user_input
        if "description" not in requirements or not requirements.get("description"):
            requirements["description"] = user_input
        
        return {
            "requirements": requirements,
            "logs": [{
                "phase": "requirement_analysis",
                "message": f"Analyzed requirements for {requirements.get('project_name', 'project')}",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Error in requirement analysis node: {e}")
        import traceback
        traceback.print_exc()
        return {
            "requirements": {},
            "logs": [{
                "phase": "requirement_analysis",
                "message": f"Requirement analysis failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
