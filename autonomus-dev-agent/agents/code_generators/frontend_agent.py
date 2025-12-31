"""
Frontend Code Generation Agent
Generates React/Next.js frontend code using Gemini 2.5 Pro.
"""

from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re
import traceback
from pathlib import Path

logger = logging.getLogger(__name__)


class FrontendGenerator:
    """Agent that generates frontend code using Gemini 2.5 Pro"""
    
    def __init__(self, debug_mode: bool = False):
        """Initialize the frontend generator with Gemini 2.5 Pro"""
        model_config = FRAMEWORK_CONFIG.model_configs["code"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=model_config["temperature"],
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
            top_p=model_config.get("top_p", 0.9),
        )
        self.debug_mode = debug_mode
        logger.info(f"Frontend Generator initialized with {model_config['model']} (Debug: {debug_mode})")
    
    def _save_debug_response(self, content: str, stage: str):
        """Save response for debugging"""
        if not self.debug_mode:
            return
        
        debug_dir = Path("artifacts/debug")
        debug_dir.mkdir(parents=True, exist_ok=True)
        debug_file = debug_dir / f"frontend_{stage}.txt"
        debug_file.write_text(content, encoding="utf-8")
        logger.debug(f"Saved debug output: {debug_file}")
    
    def _extract_json(self, content: str) -> str:
        """Extract and clean JSON from response with ultra-robust error handling"""
        if not content:
            return "{}"
        
        self._save_debug_response(content, "raw_response")
        original_content = content
        
        # Step 1: Remove markdown code fences
        try:
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
        except Exception:
            pass
        
        content = content.strip()
        self._save_debug_response(content, "after_fence_removal")
        
        # Step 2: Remove any leading/trailing explanatory text
        first_brace = content.find('{')
        last_brace = content.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            content = content[first_brace:last_brace+1]
        
        # Step 3: Remove comments
        try:
            content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        except Exception:
            pass
        
        self._save_debug_response(content, "after_comment_removal")
        
        # Step 4: Fix escape sequences
        try:
            content = content.replace('\\n', '<<<NEWLINE>>>')
            content = content.replace('\\r', '<<<CARRIAGERETURN>>>')
            content = content.replace('\\t', '<<<TAB>>>')
            content = content.replace('\\\\', '<<<BACKSLASH>>>')
            
            content = content.replace('\n', '\\n')
            content = content.replace('\r', '\\r')
            content = content.replace('\t', '\\t')
            
            content = content.replace('<<<NEWLINE>>>', '\\n')
            content = content.replace('<<<CARRIAGERETURN>>>', '\\r')
            content = content.replace('<<<TAB>>>', '\\t')
            content = content.replace('<<<BACKSLASH>>>', '\\\\')
            
            content = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', content)
        except Exception as e:
            logger.debug(f"Error in JSON cleaning: {e}")
            content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
        
        self._save_debug_response(content, "after_escape_fix")
        
        # Step 5: Try to parse
        try:
            json.loads(content)
            logger.debug("JSON parsed successfully")
            return content
        except json.JSONDecodeError as e:
            logger.debug(f"Direct parsing failed: {e}")
            
            # Brace matching fallback
            brace_count = 0
            start_idx = content.find('{')
            
            if start_idx == -1:
                logger.warning("No JSON object found")
                return "{}"
            
            for i in range(start_idx, len(content)):
                if content[i] == '{':
                    brace_count += 1
                elif content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        extracted = content[start_idx:i+1]
                        try:
                            json.loads(extracted)
                            logger.debug("Successfully extracted JSON with brace matching")
                            return extracted
                        except json.JSONDecodeError:
                            break
            
            logger.warning("Could not extract valid JSON")
            return "{}"
    
    def generate_code(
        self,
        requirements: Dict[str, Any],
        tech_stack: Dict[str, Any],
        architecture: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate frontend code based on requirements using Gemini 2.5 Pro"""
        
        if tech_stack is None:
            tech_stack = {}
        if requirements is None:
            requirements = {}
        if architecture is None:
            architecture = {}
        
        frontend_tech = tech_stack.get("frontend", {})
        if not isinstance(frontend_tech, dict):
            frontend_tech = {"framework": str(frontend_tech) if frontend_tech else "react"}
        
        framework = frontend_tech.get("framework", "react")
        
        features = requirements.get("features", [])
        if isinstance(features, list):
            feature_names = []
            for f in features[:3]:
                if isinstance(f, dict):
                    feature_names.append(f.get("name", str(f)))
                else:
                    feature_names.append(str(f))
            features_str = ", ".join(feature_names)
        else:
            features_str = "basic features"
        
        # Extract user requirements
        user_input = requirements.get('user_input', '')
        project_name = requirements.get('project_name', 'app')
        project_description = requirements.get('description', '') or user_input
        
        # Build comprehensive system prompt
        system_prompt = """You are an expert full-stack developer generating production-ready applications.

CRITICAL REQUIREMENTS:
1. Generate COMPLETE, WORKING applications - no placeholders, no TODOs
2. Include ALL necessary files: package.json, configs, components, styles, routing, etc.
3. Use modern best practices and latest framework patterns
4. Include proper error handling, validation, and user feedback
5. Generate clean, maintainable code with helpful comments
6. Make the app fully functional and runnable locally

Output format (ONLY valid JSON, no markdown):
{
  "frontend/package.json": "complete package.json content",
  "frontend/src/App.tsx": "complete App component",
  "frontend/src/index.tsx": "complete entry point",
  "frontend/vite.config.ts": "complete Vite config",
  "frontend/tsconfig.json": "complete TypeScript config",
  "frontend/src/components/...": "all component files",
  "frontend/src/styles/...": "all style files",
  "frontend/README.md": "setup instructions"
}

CRITICAL: Output ONLY the JSON object. No explanations, no markdown code blocks, no comments outside JSON."""
        
        # Build detailed user prompt based on actual requirements
        user_prompt = f"""Generate a COMPLETE, PRODUCTION-READY {framework} application based on these requirements:

PROJECT REQUIREMENTS:
{project_description if project_description else user_input}

FRAMEWORK: {framework}

REQUIRED FILES TO GENERATE:
1. frontend/package.json - Complete with all dependencies, scripts (dev, build, start, test)
2. frontend/src/App.tsx or App.jsx - Main application component with full functionality
3. frontend/src/index.tsx or index.jsx - Entry point with proper setup
4. frontend/vite.config.ts or vite.config.js - Complete Vite configuration
5. frontend/tsconfig.json or jsconfig.json - TypeScript/JavaScript configuration
6. frontend/src/components/ - All necessary component files for the application
7. frontend/src/styles/ or frontend/src/App.css - Complete styling
8. frontend/README.md - Setup and run instructions
9. frontend/.gitignore - Proper gitignore file
10. frontend/.env.example - Environment variables template (if needed)

ADDITIONAL REQUIREMENTS:
- Include proper routing if needed (React Router, Next.js routing, etc.)
- Include state management if complex (Context API, Zustand, Redux, etc.)
- Include form handling and validation if needed
- Include API integration if backend is mentioned
- Include responsive design with modern CSS/Tailwind
- Include error boundaries and loading states
- Make it production-ready with proper build configuration

Project name: {project_name}

Generate ALL files needed for a complete, runnable application. Output ONLY the JSON object with file paths as keys and complete file contents as values."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = getattr(response, "content", str(response))
            
            logger.debug(f"Raw LLM response length: {len(content)} chars")
            
            content = self._extract_json(content)
            
            if not content or content == "{}":
                logger.error("JSON extraction returned empty object")
                return {}
            
            try:
                code_files = json.loads(content)
                if isinstance(code_files, dict) and code_files:
                    logger.info(f"Gemini 2.5 Pro generated {len(code_files)} frontend files")
                    return code_files
                logger.warning("Frontend response is not a valid dictionary")
                return {}
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse frontend JSON: {e}")
                self._save_debug_response(content, "failed_parse")
                return {}
        
        except Exception as e:
            logger.error(f"Error generating frontend code: {e}")
            traceback.print_exc()
            return {}


def frontend_generator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for frontend generation"""
    debug_mode = state.get("debug_mode", False)
    generator = FrontendGenerator(debug_mode=debug_mode)
    
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
                    "phase": "frontend_generation",
                    "message": f"Generated {len(code_files)} frontend files using Gemini 2.5 Pro",
                    "timestamp": state.get("timestamp"),
                }
            ],
        }
    except Exception as e:
        logger.error(f"Frontend generation node error: {e}")
        traceback.print_exc()
        return {
            "generated_code": state.get("generated_code", {}),
            "logs": [
                {
                    "phase": "frontend_generation",
                    "message": f"Frontend generation failed: {str(e)}",
                    "timestamp": state.get("timestamp"),
                }
            ],
            "errors": state.get("errors", []) + [str(e)],
        }
