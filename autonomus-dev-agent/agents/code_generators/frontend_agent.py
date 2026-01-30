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
        
        # Validate API key
        if not CONFIG.google_api_key:
            raise ValueError("GOOGLE_API_KEY not set. Please set it in your .env file or environment variables.")
        
        try:
            self.llm = ChatGoogleGenerativeAI(
                model=model_config["model"],
                temperature=model_config["temperature"],
                max_tokens=model_config["max_tokens"],
                google_api_key=CONFIG.google_api_key,
                top_p=model_config.get("top_p", 0.9),
            )
            self.debug_mode = debug_mode
            logger.info(f"Frontend Generator initialized with {model_config['model']} (Debug: {debug_mode})")
        except Exception as e:
            logger.error(f"Failed to initialize Frontend Generator: {e}")
            raise
    
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
        
        # Check for regeneration instructions
        regeneration_instructions = requirements.get("regeneration_instructions", [])
        if regeneration_instructions:
            logger.warning(f"Regeneration requested: {len(regeneration_instructions)} instructions")
            # Add regeneration context to description
            project_description = f"{project_description}\n\n{' '.join(regeneration_instructions)}"
        
        # Build comprehensive system prompt with stronger enforcement - REplit Agent 3 style
        system_prompt = """You are an elite full-stack developer like Replit Agent 3, generating complete, production-ready, OPTIMIZED applications.

CRITICAL REQUIREMENTS - MUST FOLLOW (Like Replit Agent 3):
1. Generate COMPLETE, WORKING applications - NO placeholders, NO TODOs, NO incomplete code, NO "// TODO" comments
2. Include ALL necessary files: package.json, configs, components, styles, routing, utilities, hooks, etc.
3. Use modern best practices and latest framework patterns
4. Include proper error handling, validation, and user feedback
5. Generate OPTIMIZED, MINIMAL code - comments ONLY for complex logic, keep code concise and production-ready
6. Make the app fully functional and runnable locally - it must WORK when user runs npm install && npm run dev
7. EVERY file must be COMPLETE and FUNCTIONAL - no partial implementations
8. Generate ALL source code files - DO NOT skip any files needed for the application to run
9. Think iteratively - generate files one by one, ensuring each is complete before moving to next
10. OPTIMIZE for performance - use efficient algorithms, avoid unnecessary code, minimize bundle size
11. Comments should be MINIMAL - only add comments when logic is truly complex or non-obvious

MANDATORY FILE REQUIREMENTS (Generate ALL of these):
- frontend/package.json: MUST include all dependencies, scripts (dev, build, start, test), exact versions
- frontend/src/App.tsx or App.jsx: MUST be complete main component with full functionality, all features implemented
- frontend/src/index.tsx or index.jsx: MUST be complete entry point with ReactDOM.render, proper setup
- frontend/vite.config.ts or vite.config.js: MUST be complete Vite configuration with all plugins
- frontend/tsconfig.json or jsconfig.json: MUST be complete TypeScript/JavaScript configuration
- frontend/src/components/: MUST include ALL component files needed (at least 3-5 components for a calculator)
- frontend/src/styles/ or frontend/src/App.css: MUST include complete styling (CSS or Tailwind)
- frontend/src/utils/: MUST include utility functions if needed
- frontend/src/hooks/: MUST include custom hooks if needed
- frontend/README.md: MUST include complete setup and run instructions
- frontend/.gitignore: MUST include proper gitignore
- frontend/.env.example: MUST include environment variables template (if needed)
- frontend/tailwind.config.js: MUST include if using Tailwind
- frontend/postcss.config.js: MUST include if using PostCSS

FOR CALCULATOR APPLICATIONS, YOU MUST GENERATE:
- Calculator component with all operations (add, subtract, multiply, divide)
- Display component
- Button components
- Logic/hooks for calculations
- Complete styling
- All configuration files

Output format (ONLY valid JSON, no markdown):
{
  "frontend/package.json": "complete package.json with ALL dependencies",
  "frontend/src/App.tsx": "complete App component with ALL functionality",
  "frontend/src/index.tsx": "complete entry point",
  "frontend/vite.config.ts": "complete Vite config",
  "frontend/tsconfig.json": "complete TypeScript config",
  "frontend/src/components/Calculator.tsx": "complete calculator component",
  "frontend/src/components/Display.tsx": "complete display component",
  "frontend/src/components/Button.tsx": "complete button component",
  "frontend/src/App.css": "complete styling",
  "frontend/README.md": "setup instructions",
  "frontend/.gitignore": "gitignore file"
}

CRITICAL: 
- Output ONLY the JSON object. No explanations, no markdown code blocks, no comments outside JSON.
- Generate MINIMUM 12-15 files for a complete application
- Each file must be FULLY IMPLEMENTED with no placeholders
- DO NOT generate only Dockerfiles - generate ALL source code files
- Think like Replit Agent 3 - be thorough, iterative, and complete"""
        
        # Check for regeneration instructions
        regeneration_instructions = requirements.get("regeneration_instructions", [])
        regen_context = ""
        if regeneration_instructions:
            regen_context = "\n\n⚠️ REGENERATION REQUEST:\n" + "\n".join(regeneration_instructions) + "\n\nYou MUST generate MORE files this time. Previous attempt was insufficient."
        
        # Build detailed user prompt based on actual requirements - Replit Agent 3 style
        user_prompt = f"""Generate a COMPLETE, PRODUCTION-READY {framework} application based on these requirements:

PROJECT REQUIREMENTS:
{project_description if project_description else user_input}

FRAMEWORK: {framework}
{regen_context}

CRITICAL: You are generating a COMPLETE, WORKING application. Think like Replit Agent 3:
1. Generate ALL source code files needed
2. Each file must be COMPLETE and FUNCTIONAL
3. The app must RUN when user executes: npm install && npm run dev
4. NO placeholders, NO TODOs, NO incomplete code

MANDATORY FILES TO GENERATE (Generate ALL of these):
1. frontend/package.json - Complete with ALL dependencies, exact versions, scripts (dev, build, start, test)
2. frontend/src/App.tsx or App.jsx - Main application component with FULL functionality implemented
3. frontend/src/index.tsx or index.jsx - Entry point with ReactDOM.render, proper setup, error boundaries
4. frontend/vite.config.ts or vite.config.js - Complete Vite configuration with all plugins
5. frontend/tsconfig.json or jsconfig.json - Complete TypeScript/JavaScript configuration
6. frontend/src/components/ - ALL component files needed (generate at least 3-5 components)
7. frontend/src/styles/ or frontend/src/App.css - Complete styling (CSS or Tailwind with all styles)
8. frontend/src/utils/ - Utility functions if needed
9. frontend/src/hooks/ - Custom hooks if needed
10. frontend/README.md - Complete setup and run instructions
11. frontend/.gitignore - Proper gitignore file
12. frontend/.env.example - Environment variables template (if needed)
13. frontend/tailwind.config.js - If using Tailwind
14. frontend/postcss.config.js - If using PostCSS

FOR THIS SPECIFIC PROJECT ({project_description[:100]}):
- Analyze what components are needed
- Generate ALL component files with complete implementation
- Generate ALL styling files
- Generate ALL configuration files
- Make sure EVERYTHING is complete and working

ADDITIONAL REQUIREMENTS:
- Include proper routing if needed (React Router, Next.js routing, etc.)
- Include state management if complex (Context API, Zustand, Redux, etc.)
- Include form handling and validation if needed
- Include API integration if backend is mentioned
- Include responsive design with modern CSS/Tailwind
- Include error boundaries and loading states
- Make it production-ready with proper build configuration

Project name: {project_name}

REMEMBER: Generate ALL source code files. DO NOT skip any files. The application must be COMPLETE and RUNNABLE.
Output ONLY the JSON object with file paths as keys and complete file contents as values."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        # Retry logic for more reliable generation
        max_retries = 3
        for attempt in range(max_retries):
            try:
                logger.info(f"Frontend generation attempt {attempt + 1}/{max_retries}")
                logger.debug(f"Prompt length: {len(user_prompt)} chars, System prompt length: {len(system_prompt)} chars")
                
                # Try to invoke LLM with better error handling
                try:
                    response = self.llm.invoke(messages)
                except Exception as api_error:
                    error_msg = str(api_error)
                    error_type = type(api_error).__name__
                    logger.error(f"LLM API call failed on attempt {attempt + 1}: {error_type}: {error_msg}")
                    
                    # Check for specific error types
                    if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                        logger.error("API quota exceeded. Cannot retry - need to wait or use different API key.")
                        raise  # Re-raise to be caught by outer exception handler
                    elif "401" in error_msg or "unauthorized" in error_msg.lower():
                        logger.error("API key invalid or unauthorized.")
                        raise
                    elif "timeout" in error_msg.lower():
                        logger.warning("API timeout, will retry...")
                        if attempt < max_retries - 1:
                            import time
                            time.sleep(5)  # Wait longer for timeout
                            continue
                        raise
                    
                    # For other errors, retry
                    if attempt < max_retries - 1:
                        import time
                        time.sleep(2)
                        continue
                    raise
                
                content = getattr(response, "content", str(response))
                
                logger.debug(f"Raw LLM response length: {len(content)} chars")
                
                content = self._extract_json(content)
                
                if not content or content == "{}":
                    if attempt < max_retries - 1:
                        logger.warning(f"Empty JSON on attempt {attempt + 1}, retrying...")
                        continue
                    logger.error("JSON extraction returned empty object after all retries")
                    return {}
                
                try:
                    code_files = json.loads(content)
                    if isinstance(code_files, dict) and code_files:
                        file_count = len(code_files)
                        logger.info(f"Gemini 1.5 Pro generated {file_count} frontend files")
                        
                        # Validate minimum file count
                        if file_count < 5:
                            if attempt < max_retries - 1:
                                logger.warning(f"Only {file_count} files generated, retrying for more complete generation...")
                                # Add more explicit instruction for retry
                                retry_prompt = user_prompt + "\n\nIMPORTANT: You must generate AT LEAST 8-10 complete files. The previous attempt only generated " + str(file_count) + " files. Generate MORE files including all necessary components, styles, and configuration files."
                                messages = [
                                    SystemMessage(content=system_prompt),
                                    HumanMessage(content=retry_prompt),
                                ]
                                continue
                            else:
                                logger.warning(f"Only {file_count} files generated after all retries, but returning what we have")
                        
                        return code_files
                    logger.warning("Frontend response is not a valid dictionary")
                    if attempt < max_retries - 1:
                        continue
                    return {}
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse frontend JSON on attempt {attempt + 1}: {e}")
                    self._save_debug_response(content, f"failed_parse_attempt_{attempt + 1}")
                    if attempt < max_retries - 1:
                        logger.info("Retrying with clearer JSON extraction...")
                        continue
                    return {}
            
            except Exception as e:
                error_msg = str(e)
                error_type = type(e).__name__
                logger.error(f"Error generating frontend code on attempt {attempt + 1}: {error_type}: {error_msg}")
                logger.error(f"Full traceback:")
                traceback.print_exc()
                
                # If it's an API error, log more details
                if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                    logger.error("API quota/rate limit error detected. Consider using a different API key or waiting.")
                
                if attempt < max_retries - 1:
                    logger.info(f"Retrying after error (attempt {attempt + 2}/{max_retries})...")
                    import time
                    time.sleep(2)  # Brief delay before retry
                    continue
                
                logger.error(f"All {max_retries} attempts failed for frontend generation")
                return {}
        
        # If we get here, all retries failed
        logger.error("All frontend generation attempts failed")
        return {}


def frontend_generator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for frontend generation"""
    debug_mode = state.get("debug_mode", False)
    generator = FrontendGenerator(debug_mode=debug_mode)
    
    try:
        requirements = state.get("requirements", {})
        if not isinstance(requirements, dict):
            requirements = {}
        
        # Ensure user_input is in requirements
        if 'user_input' not in requirements:
            requirements['user_input'] = state.get('user_input', '')
        if 'description' not in requirements and state.get('user_input'):
            requirements['description'] = state.get('user_input', '')
        
        tech_stack = state.get("tech_stack", {})
        if not isinstance(tech_stack, dict):
            tech_stack = {}
        
        # Ensure frontend tech stack is set
        if "frontend" not in tech_stack:
            # Try to infer from requirements
            project_type = requirements.get("project_type", "")
            user_input_lower = str(state.get('user_input', '')).lower()
            if "next" in user_input_lower or "nextjs" in user_input_lower:
                tech_stack["frontend"] = {"framework": "nextjs"}
            elif "react" in user_input_lower:
                tech_stack["frontend"] = {"framework": "react"}
            else:
                tech_stack["frontend"] = {"framework": "react"}  # Default
        
        architecture = state.get("architecture", {})
        if not isinstance(architecture, dict):
            architecture = {}
        
        logger.info(f"Frontend generator: requirements={bool(requirements)}, tech_stack={bool(tech_stack)}")
        logger.info(f"User input: {state.get('user_input', '')[:100]}")
        
        code_files = generator.generate_code(
            requirements,
            tech_stack,
            architecture,
        )
        
        generated_code = state.get("generated_code", {})
        if code_files and isinstance(code_files, dict) and not code_files.get("error"):
            generated_code.update(code_files)
            logger.info(f"✓ Frontend: Added {len(code_files)} files, total: {len(generated_code)}")
        else:
            logger.warning(f"✗ Frontend: No files generated or error occurred")
        
        return {
            "generated_code": generated_code,
            "logs": [
                {
                    "phase": "frontend_generation",
                    "message": f"Generated {len(code_files) if code_files else 0} frontend files using Gemini 1.5 Pro",
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
